import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCloudSync, useDiaryData } from "../../../context/AppContext";
import { calibrationKey, clickForMicrons, clickValues, hasCalibration, micronsForClick } from "../../../lib/grinderCalibration";

const sourceStyle = {
  user: "text-[var(--point-color)]",
  estimated: "text-sky-400",
  default: "text-[var(--text-muted)]",
  missing: "text-rose-400",
};

const GrinderCalibration: React.FC = () => {
  const { settings, setSettings } = useDiaryData();
  const { queueCloudSync } = useCloudSync();
  const grinders = Object.keys(settings.grinders);
  const [baseGrinder, setBaseGrinder] = useState(grinders[0] ?? "");
  const [baseClick, setBaseClick] = useState(settings.grinders[grinders[0]]?.min ?? 0);
  const baseRange = settings.grinders[baseGrinder];
  const clicks = useMemo(() => baseRange ? clickValues(baseRange) : [], [baseRange]);
  const precision = baseRange?.step && baseRange.step < 1 ? 1 : 0;

  useEffect(() => {
    if (!baseRange && grinders[0]) {
      setBaseGrinder(grinders[0]);
      setBaseClick(settings.grinders[grinders[0]].min);
    }
  }, [baseRange, grinders, settings.grinders]);

  const setDirectMicrons = (click: number, value: string) => {
    setSettings(current => {
      const points = { ...(current.grinderCalibrations[baseGrinder] ?? {}) };
      const key = calibrationKey(click);
      const um = Number(value);
      if (!value || !Number.isFinite(um) || um <= 0) delete points[key];
      else points[key] = um;
      return { ...current, grinderCalibrations: { ...current.grinderCalibrations, [baseGrinder]: points } };
    });
    queueCloudSync();
  };

  const baseResult = baseRange ? micronsForClick(baseGrinder, baseClick, settings.grinderCalibrations) : null;
  const equivalent = (target: string) => {
    if (!baseResult || !hasCalibration(target, settings.grinderCalibrations)) return null;
    const range = settings.grinders[target];
    const raw = clickForMicrons(target, baseResult.um, settings.grinderCalibrations);
    if (raw === null || raw < range.min || raw > range.max) return null;
    const click = Number((range.min + Math.round((raw - range.min) / range.step) * range.step).toFixed(6));
    return { click, result: micronsForClick(target, click, settings.grinderCalibrations) };
  };

  if (!baseRange) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto px-6 font-mono pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-4 w-1 bg-[var(--point-color)]" />
        <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-strong)]">Grinder Calibration</h2>
      </div>
      <div className="bg-[var(--bg-surface)] p-5 border border-[var(--border-main)] rounded-xl shadow-lg mb-6 space-y-4">
        <div><h3 className="text-[11px] font-bold text-[var(--point-color)] tracking-widest uppercase">개인 보정표</h3><p className="text-xs text-[var(--text-muted)] mt-2">입도 측정값을 입력하면 다른 클릭은 선형 추정합니다. 직접값이 두 개 미만인 새 장비는 환산하지 않습니다.</p></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" aria-label="입도 값 표시 기준">
          <span className={sourceStyle.user}>● 직접 입력</span><span className={sourceStyle.estimated}>● 자동 추정</span><span className={sourceStyle.default}>● 기본값</span><span className={sourceStyle.missing}>● 입력 필요</span>
        </div>
        <label className="block text-[10px] text-[var(--text-muted)] uppercase">보정할 그라인더
          <select value={baseGrinder} onChange={(event) => { const grinder = event.target.value; setBaseGrinder(grinder); setBaseClick(settings.grinders[grinder].min); }} className="mt-1.5 w-full bg-[var(--bg-base)] border border-[var(--border-main)] text-[var(--text-main)] text-sm p-3 rounded-lg">
            {grinders.map(grinder => <option key={grinder} value={grinder}>{grinder}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div className="bg-[var(--bg-surface)] p-5 border border-[var(--border-main)] rounded-xl h-fit">
          <h3 className="text-[11px] font-bold text-[var(--point-color)] tracking-widest uppercase mb-4">기준 클릭</h3>
          <label className="block text-[10px] text-[var(--text-muted)] mb-2">{baseRange.min} ~ {baseRange.max}</label>
          <input type="range" min={baseRange.min} max={baseRange.max} step={baseRange.step} value={baseClick} onChange={event => setBaseClick(Number(event.target.value))} className="w-full accent-[var(--point-color)]" />
          <div className="mt-4 flex justify-between items-end"><span className="text-2xl font-black text-[var(--text-strong)]">{baseClick.toFixed(precision)}</span><span className={`text-sm font-bold ${baseResult ? sourceStyle[baseResult.source] : sourceStyle.missing}`}>{baseResult ? `~ ${Math.round(baseResult.um)} μm` : "입도 입력 필요"}</span></div>
          <div className="mt-6 border-t border-[var(--border-main)] pt-4 space-y-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase">환산 결과</p>
            {grinders.filter(grinder => grinder !== baseGrinder).map(grinder => {
              const result = equivalent(grinder);
              return <div key={grinder} className="flex justify-between gap-3 text-xs"><span className="text-[var(--text-main)]">{grinder}</span><span className={result?.result ? sourceStyle[result.result.source] : sourceStyle.missing}>{result?.result ? `${result.click.toFixed(settings.grinders[grinder].step < 1 ? 1 : 0)} click · ~ ${Math.round(result.result.um)} μm` : "환산 데이터 부족 또는 범위 초과"}</span></div>;
            })}
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[var(--border-main)]"><h3 className="text-[11px] font-bold text-[var(--point-color)] tracking-widest uppercase">클릭별 입도</h3><p className="text-[10px] text-[var(--text-muted)] mt-1">값을 입력하면 개인 보정값으로 저장됩니다. 비우면 기본값 또는 자동 추정으로 되돌립니다.</p></div>
          <div className="max-h-[34rem] overflow-y-auto divide-y divide-[var(--border-main)]">
            {clicks.map(click => {
              const key = calibrationKey(click);
              const direct = settings.grinderCalibrations[baseGrinder]?.[key];
              const result = micronsForClick(baseGrinder, click, settings.grinderCalibrations);
              return <div key={key} className="grid grid-cols-[5rem_1fr_5.5rem] items-center gap-3 p-3 text-xs">
                <span className="text-[var(--text-muted)]">{click.toFixed(precision)} click</span>
                <input type="number" min="0" step="1" value={direct ?? ""} placeholder={result ? String(Math.round(result.um)) : "입력 필요"} onChange={event => setDirectMicrons(click, event.target.value)} aria-label={`${click.toFixed(precision)} 클릭의 직접 입력 입도`} className={`w-full bg-[var(--bg-base)] border border-[var(--border-main)] p-2 outline-none focus:border-[var(--point-color)] ${direct ? sourceStyle.user : "text-[var(--text-main)]"}`} />
                <span className={`text-right ${result ? sourceStyle[result.source] : sourceStyle.missing}`}>{result ? `${Math.round(result.um)} μm` : "입력 필요"}</span>
              </div>;
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default GrinderCalibration;
