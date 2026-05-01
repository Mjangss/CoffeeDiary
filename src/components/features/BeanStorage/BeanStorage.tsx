import React, { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { useBrewContext } from "../../../context/BrewContext";
import { BeanInfo, RoastLevel } from "../../../types";
import { EMPTY_BEAN_FORM, ROAST_LEVELS } from "../../../constants";
import { 
  getTransitionVariants, 
  calcRestDays, 
  getAgingStatus, 
  getAgingStatusDetail, 
  handleDownloadScreenshot,
  BACKDROP_VARIANTS,
  MODAL_VARIANTS
} from "../../../utils";
import { Portal } from "../../common/Portal";
import MechanicalButton from "../../common/MechanicalButton";
import GlitchButton from "../../common/GlitchButton";
import SwipeableRow from "../../common/SwipeableRow";
import TacticalNumericInput from "../../common/TacticalNumericInput";
import TacticalSortMenu from "../../common/TacticalSortMenu";

const BeanStorage: React.FC = () => {
  const {
    beans,
    setBeans,
    beanForm,
    setBeanForm,
    beanStorageView,
    setBeanStorageView,
    beanSortMode,
    setBeanSortMode,
    beanSortOrder,
    setBeanSortOrder,
    beanPreview,
    setBeanPreview,
    settings,
    queueCloudSync
  } = useAppContext();

  const { brewForm, dispatch } = useBrewContext();
  const beanPopupRef = useRef<HTMLDivElement>(null);

  const sortedBeans = useMemo(() => {
    const baseSorted = [...beans].sort((a, b) => {
      if (beanSortMode === "name") return a.name.localeCompare(b.name);
      if (beanSortMode === "roast") return ROAST_LEVELS.indexOf(a.roastLevel) - ROAST_LEVELS.indexOf(b.roastLevel);
      // Default / newest: compare roasting dates
      return new Date(a.roastingDate).getTime() - new Date(b.roastingDate).getTime();
    });
    
    return beanSortOrder === "desc" ? baseSorted.reverse() : baseSorted;
  }, [beans, beanSortMode, beanSortOrder]);

  const updateBeanForm = (key: keyof BeanInfo, value: any) => {
    setBeanForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadBeanToForm = (target: BeanInfo) => {
    setBeanForm({ ...target });
    setBeanStorageView("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveBeanInfo = () => {
    if (!beanForm.name.trim()) {
      alert("⚠️ 원두 이름을 입력해주세요.");
      return;
    }
    
    setBeans((prev) => {
      const filtered = prev.filter((b) => b.name !== beanForm.name);
      return [beanForm, ...filtered];
    });

    // If currently brewing with this bean, update basic info in form
    if (brewForm.selectedBeanName === beanForm.name) {
      dispatch({ type: "UPDATE_FIELD", field: "roastLevel", value: beanForm.roastLevel });
      dispatch({ type: "UPDATE_FIELD", field: "restDays", value: calcRestDays(beanForm.roastingDate) });
    }

    setBeanStorageView("list");
    queueCloudSync();
  };

  const removeBeanInfo = (beanName: string) => {
    setBeans((prev) => prev.filter((item) => item.name !== beanName));
    if (brewForm.selectedBeanName === beanName) {
      dispatch({ type: "UPDATE_FIELD", field: "selectedBeanName", value: "" });
      dispatch({ type: "SET_METHOD", method: "Brew" });
      dispatch({ type: "UPDATE_FIELD", field: "bean", value: "" });
      dispatch({ type: "UPDATE_FIELD", field: "roastLevel", value: "중배전" });
      dispatch({ type: "UPDATE_FIELD", field: "restDays", value: 0 });
    }
    queueCloudSync();
  };

  const estimatedHeight = useMemo(() => 200 + sortedBeans.length * 150, [sortedBeans.length]);

  return (
    <motion.section 
      key="bean-storage"
      variants={getTransitionVariants(settings.theme.pageTransition, estimatedHeight, settings.theme.uiScale)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="bean-storage" 
      className="mx-auto w-full max-w-6xl px-6 pt-10 pb-20 md:px-10"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between border-b border-[var(--border-main)] pb-4 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>RAW_MATERIAL</span>
          <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">원두</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-[10px] text-[var(--text-muted)] font-mono text-right mr-2 leading-tight">
            OVERWRITE_IF_SAME_NAME<br/>
            <span className="text-[var(--text-sub)]">원두 이름이 같다면 데이터를 덮어씁니다</span>
          </div>
          {beanStorageView === "list" && (
            <TacticalSortMenu 
              options={[
                { key: "newest", label: "최신순" },
                { key: "name", label: "이름순" },
                { key: "roast", label: "배전도순" }
              ]}
              current={beanSortMode}
              order={beanSortOrder}
              onSelect={(key) => {
                if (beanSortMode === key) {
                  setBeanSortOrder(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setBeanSortMode(key);
                  setBeanSortOrder("desc");
                }
              }}
            />
          )}
          {beanStorageView === "list" ? (
            <MechanicalButton
              onClick={() => {
                setBeanForm(EMPTY_BEAN_FORM as BeanInfo);
                setBeanStorageView("edit");
              }}
              className="w-10 h-10 flex items-center justify-center p-0"
              style={{ backgroundColor: 'var(--point-color)' }}
            >
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </MechanicalButton>
          ) : (
            <MechanicalButton
              onClick={() => setBeanStorageView("list")}
              className="w-10 h-10 flex items-center justify-center p-0"
              style={{ backgroundColor: 'var(--point-color)' }}
            >
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </MechanicalButton>
          )}
        </div>
      </div>

      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          {beanStorageView === "edit" ? (
            <motion.div
              key="bean-edit"
              initial={{ x: 50, opacity: 0, filter: "blur(5px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -50, opacity: 0, filter: "blur(5px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 bg-[var(--bg-base)] border border-[var(--border-main)] p-4 sm:p-6">
                <label className="flex flex-col space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">원두명 (REQUIRED)</span>
                  <input value={beanForm.name} onChange={(e) => updateBeanForm("name", e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" placeholder="원두명 입력" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">로스터리</span>
                  <input value={beanForm.roastery} onChange={(e) => updateBeanForm("roastery", e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">로스팅일</span>
                  <input type="date" value={beanForm.roastingDate} onChange={(e) => updateBeanForm("roastingDate", e.target.value)} className="w-full min-w-0 max-w-full overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-main)] px-3 py-2.5 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono appearance-none" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">지역</span>
                  <input value={beanForm.region} onChange={(e) => updateBeanForm("region", e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">품종</span>
                  <input value={beanForm.variety} onChange={(e) => updateBeanForm("variety", e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">고도 (ALTITUDE)</span>
                  <input value={beanForm.altitude} onChange={(e) => updateBeanForm("altitude", e.target.value)} placeholder="e.g., 1800m" className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">가공법 (PROCESS)</span>
                  <input value={beanForm.process} onChange={(e) => updateBeanForm("process", e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">배전도 (ROAST_LEVEL)</span>
                  <select value={beanForm.roastLevel} onChange={(e) => updateBeanForm("roastLevel", e.target.value as RoastLevel)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
                    {ROAST_LEVELS.map((item) => (
                      <option key={item} value={item}>
                        {settings.roastLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 bg-[var(--bg-base)] border border-[var(--border-main)] p-4 sm:p-6 mt-4">
                 <div className="sm:col-span-2 border-b border-[var(--border-main)] pb-2 flex items-center justify-between">
                   <h3 className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest pl-2 border-l-2 border-[var(--point-color)]">Aging_Strategy (Target_Peak)</h3>
                   <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase">ROAST_DATE_REF: {beanForm.roastingDate || "N/A"}</span>
                 </div>
                 <label className="flex flex-col space-y-1.5">
                   <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">Peak Start (Days after roast)</span>
                   <div className="relative">
                     <TacticalNumericInput
                       value={beanForm.peakStart || 0}
                       onChange={(val) => updateBeanForm("peakStart", val)}
                       min={0}
                       max={100}
                       className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 pr-10 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono"
                     />
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-muted)]">D</span>
                   </div>
                 </label>
                 <label className="flex flex-col space-y-1.5">
                   <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">Peak End (Days after roast)</span>
                   <div className="relative">
                     <TacticalNumericInput
                       value={beanForm.peakEnd || 0}
                       onChange={(val) => updateBeanForm("peakEnd", val)}
                       min={0}
                       max={200}
                       className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 pr-10 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono"
                     />
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-muted)]">D</span>
                   </div>
                 </label>
                 <p className="sm:col-span-2 text-[10px] font-mono text-[var(--text-dim)] uppercase leading-relaxed">
                   * 각 원두만의 개별적인 최적 풍미 기간을 설정합니다. 피크 시작 전은 [DEGASSING], 피크 기간은 [PEAK], 피크 종료 후는 [PAST_PEAK]로 추적됩니다.
                 </p>
              </div>
              
              <label className="flex flex-col space-y-1.5 mt-4">
                <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">로스터 노트 (NOTES)</span>
                <textarea rows={3} value={beanForm.roasterNote} onChange={(e) => updateBeanForm("roasterNote", e.target.value)} className="w-full resize-none bg-[var(--bg-base)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-mono" placeholder="로스터의 테이스팅 노트 또는 특징 입력..." />
              </label>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <MechanicalButton 
                  onClick={saveBeanInfo} 
                  className="flex-1 py-4 text-sm font-bold uppercase tracking-wider text-black transition-colors min-w-[200px]" 
                  style={{ backgroundColor: 'var(--point-color)' }}
                >
                  [ SAVE_DATA ] 원두 저장
                </MechanicalButton>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="bean-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pt-2"
            >
              <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-widest pb-2 border-b border-[var(--border-main)]">TOTAL_STORED_BEANS: {beans.length}</p>
              {sortedBeans.length === 0 && (
                <div className="py-12 text-center text-sm font-mono text-[var(--text-sub)] border border-dashed border-[var(--border-main)] bg-[var(--bg-base)]/30">
                  NO_RECORDS_FOUND
                </div>
              )}
              {sortedBeans.map((item) => (
                <SwipeableRow 
                  key={item.name} 
                  onDelete={() => removeBeanInfo(item.name)}
                  onEdit={() => loadBeanToForm(item)}
                >
                  <div className="flex flex-col w-full p-4 sm:p-5 gap-3 bg-[var(--bg-base)] border border-[var(--border-main)] group cursor-pointer" onClick={() => setBeanPreview(item)}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--text-strong)] uppercase tracking-tight leading-tight">{item.name}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1 uppercase font-bold tracking-widest leading-relaxed">NOTES: {item.roasterNote || "NO_DATA"}</p>
                      </div>
                      {(() => {
                        const status = getAgingStatus(item);
                        const detail = getAgingStatusDetail(item);
                        let style = "border-zinc-800 text-zinc-500";
                        if (status === "DEGASSING") style = "border-cyan-900 text-cyan-400 animate-pulse";
                        if (status === "PEAK") style = "border-[var(--point-color)] text-[var(--point-color)] shadow-[0_0_10px_rgba(var(--point-color-rgb),0.2)]";
                        if (status === "PAST_PEAK") style = "border-zinc-700 text-zinc-600";
                        
                        return (
                          <div className={`shrink-0 px-2 py-0.5 border text-[9px] font-mono font-bold uppercase tracking-tighter ${style}`} title={detail}>
                            {status.replace("_", " ")}
                          </div>
                        );
                      })()}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 border-t border-[var(--border-main)]/50 pt-3">
                      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex items-center gap-1.5"><span className="text-[var(--text-sub)]">ROASTERY</span>{item.roastery || "UNKNOWN"}</span>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex items-center gap-1.5"><span className="text-[var(--text-sub)]">LEVEL</span>{settings.roastLabels[item.roastLevel]}</span>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex items-center gap-1.5"><span className="text-[var(--text-sub)]">DATE</span>{item.roastingDate}</span>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2 border-l border-[var(--border-main)] pl-4">
                        <GlitchButton 
                          label="EDIT"
                          onClick={(e) => { e.stopPropagation(); loadBeanToForm(item); }}
                          className="px-3 py-1.5 text-[9px] border border-[var(--border-hover)] hover:border-[var(--point-color)] transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bean Preview Modal */}
      <AnimatePresence>
        {beanPreview && (
          <Portal>
            <motion.div
              variants={BACKDROP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setBeanPreview(null)}
            >
              <motion.div
                ref={beanPopupRef}
                variants={MODAL_VARIANTS}
                className="w-full max-w-2xl border border-[var(--border-main)] bg-[var(--bg-base)] shadow-2xl my-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between border-b border-[var(--border-main)] p-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight uppercase">RAW_MATERIAL_DETAILS</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1 uppercase">ARCHIVE_TYPE: BEAN_INFO</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownloadScreenshot(beanPopupRef, "BEAN_REPORT")}
                    className="group relative cursor-pointer border border-[var(--border-main)] hover:border-[var(--point-color)] bg-[var(--bg-surface)]/30 p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--point-color)]/5"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M19 7v2M19 7h-2"/>
                    </svg>
                  </button>
                  <button onClick={() => setBeanPreview(null)} className="cursor-pointer border border-[var(--border-hover)] hover:border-[var(--point-color)] px-3 py-1 text-xs text-[var(--text-main)] transition-colors uppercase font-mono">
                    CLOSE.X
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Reference Name</p>
                      <div className="bg-[var(--bg-surface)]/50 p-3 border border-zinc-900">
                        <p className="text-sm font-bold text-[var(--text-strong)]">{beanPreview.name}</p>
                        <p className="text-[10px] text-[var(--text-dim)] font-mono mt-1 uppercase">Roastery: {beanPreview.roastery || "UNKNOWN"}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Roasting Metrics</p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] block text-[9px] uppercase">Level</span>
                          <span style={{ color: "var(--point-color)" }} className="font-bold">{settings.roastLabels[beanPreview.roastLevel]}</span>
                        </div>
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] block text-[9px] uppercase">Roast Date</span>
                          <span className="font-bold">{beanPreview.roastingDate || "N/A"}</span>
                        </div>
                        <div className="bg-[var(--bg-deep)]/50 p-3 border border-zinc-800 col-span-2 space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[var(--text-muted)] block text-[9px] font-mono uppercase">Aging_Velocity_Index</span>
                            {(() => {
                              const status = getAgingStatus(beanPreview);
                              let color = "var(--text-dim)";
                              if (status === "DEGASSING") color = "#22d3ee";
                              if (status === "PEAK") color = "var(--point-color)";
                              if (status === "PAST_PEAK") color = "#71717a";
                              return <span className="text-[10px] font-mono font-bold uppercase" style={{ color }}>{status.replace("_", " ")}</span>;
                            })()}
                          </div>
                          
                          {beanPreview.peakStart !== undefined && beanPreview.peakEnd !== undefined ? (
                            <div className="space-y-2">
                              <div className="relative h-1.5 w-full bg-zinc-900 overflow-hidden">
                                {(() => {
                                  const restDays = calcRestDays(beanPreview.roastingDate);
                                  const start = beanPreview.peakStart!;
                                  const end = beanPreview.peakEnd!;
                                  const max = Math.max(end + 7, restDays + 5);
                                  const peakStartPct = (start / max) * 100;
                                  const peakEndPct = (end / max) * 100;
                                  const currentPct = (restDays / max) * 100;
                                  
                                  return (
                                    <>
                                      <div className="absolute h-full opacity-20" style={{ left: `${peakStartPct}%`, width: `${peakEndPct - peakStartPct}%`, backgroundColor: 'var(--point-color)' }} />
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${currentPct}%` }} className="absolute h-full bg-zinc-700 opacity-50" />
                                      <div className="absolute h-full w-0.5 bg-white z-10 shadow-[0_0_10px_white]" style={{ left: `${currentPct}%` }} />
                                      <div className="absolute top-0 h-1 w-px bg-zinc-500" style={{ left: `${peakStartPct}%` }} />
                                      <div className="absolute top-0 h-1 w-px bg-zinc-500" style={{ left: `${peakEndPct}%` }} />
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="flex justify-between text-[8px] font-mono text-[var(--text-dim)] uppercase">
                                <span>R+0D</span>
                                <span>{getAgingStatusDetail(beanPreview)}</span>
                                <span>REST_{calcRestDays(beanPreview.roastingDate)}D</span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 border border-dashed border-zinc-800 text-center">
                              <p className="text-[10px] font-mono text-zinc-600 uppercase">NO_AGING_STRATEGY_DEFINED</p>
                              <p className="text-[8px] font-mono text-zinc-700 mt-1 uppercase">CURRENT_RESTING: {calcRestDays(beanPreview.roastingDate)}D</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Origin Profile</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] font-mono block text-[9px] uppercase">Region</span>
                          <span className="font-bold truncate">{beanPreview.region || "-"}</span>
                        </div>
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] font-mono block text-[9px] uppercase">Variety</span>
                          <span className="font-bold truncate">{beanPreview.variety || "-"}</span>
                        </div>
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] font-mono block text-[9px] uppercase">Altitude</span>
                          <span className="font-bold font-mono">{beanPreview.altitude || "-"}</span>
                        </div>
                        <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                          <span className="text-[var(--text-muted)] font-mono block text-[9px] uppercase">Process</span>
                          <span className="font-bold truncate">{beanPreview.process || "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Notes / Characteristics</p>
                      <div className="bg-[var(--bg-deep)] p-3 border border-zinc-900 min-h-[60px]">
                        <p className="text-xs text-[var(--text-dim)] leading-relaxed italic">
                          {beanPreview.roasterNote || "NO_TASTING_NOTES_AVAILABLE"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <MechanicalButton
                  onClick={() => setBeanPreview(null)}
                  className="w-full py-4 text-xs font-bold tracking-widest uppercase transition-colors"
                  style={{ backgroundColor: 'var(--point-color)' }}
                >
                  [ OK ] TERMINATE_VIEW
                </MechanicalButton>
              </div>
            </motion.div>
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export default BeanStorage;
