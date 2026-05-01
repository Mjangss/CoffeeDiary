import React, { useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { useBrewContext } from "../../../context/BrewContext";
import { 
  BrewMethod, 
  Grinder, 
  BrewWater, 
  Dripper, 
  RoastLevel, 
  InventoryStatus, 
  BrewRecord,
  OXOFilterType
} from "../../../types";
import { 
  METHODS, 
  SCORE_FIELDS, 
  MAX_CUP_SCORE, 
  CUP_SCORE_STEP, 
  METHOD_CONFIG 
} from "../../../constants";
import { 
  clamp, 
  round, 
  parseTypedNumber, 
  keyOf, 
  calcRestDays, 
  getTransitionVariants
} from "../../../utils";
import MechanicalButton from "../../common/MechanicalButton";
import TacticalNumericInput from "../../common/TacticalNumericInput";
import RadarChart from "../../common/RadarChart";

const BrewingForm: React.FC = () => {
  const {
    inventory,
    beans,
    recipes,
    settings,
    setRecords,
    setInventory,
    setProfiles,
    editingRecordId,
    setEditingRecordId,
    records,
    persistedPayload
  } = useAppContext();

  const { brewForm, dispatch } = useBrewContext();

  // --- Derived State & Handlers ---
  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes]);

  const selectedBeanInfo = useMemo(() => 
    beans.find((item) => item.name === brewForm.selectedBeanName) ?? null, 
  [beans, brewForm.selectedBeanName]);

  const selectedRecipeInfo = useMemo(() => 
    recipes.find((item) => item.id === brewForm.selectedRecipeId) ?? null, 
  [recipes, brewForm.selectedRecipeId]);

  const averageCupScore = useMemo(
    () => round(Object.values(brewForm.cupScores).reduce((acc: number, value: number) => acc + value, 0) / Object.keys(brewForm.cupScores).length, 1),
    [brewForm.cupScores],
  );

  const canSaveRecord = brewForm.selectedBeanName.trim().length > 0 && brewForm.bean.trim().length > 0;

  const applyBaseClick = (value: number) => {
    const range = settings.grinders[brewForm.grinder] || { min: 0.1, max: 20.0, step: 0.1 };
    const normalized = round(Number.isFinite(value) ? value : METHOD_CONFIG[brewForm.method].baselineClick, 1);
    const clamped = clamp(normalized, range.min, range.max);
    dispatch({ type: "SET_BASE_CLICK", value: clamped });
  };

  const loadInventoryToParams = (id: string) => {
    dispatch({ type: "UPDATE_FIELD", field: "selectedInventoryId", value: id });
    if (!id) {
       dispatch({ type: "SET_METHOD", method: "Brew" });
       dispatch({ type: "UPDATE_FIELD", field: "bean", value: "" });
       dispatch({ type: "UPDATE_FIELD", field: "roastLevel", value: "중배전" });
       dispatch({ type: "UPDATE_FIELD", field: "restDays", value: 0 });
       return;
    }
    const inv = inventory.find(i => i.id === id);
    if (!inv) return;
    
    dispatch({ type: "UPDATE_FIELD", field: "bean", value: inv.beanName });
    dispatch({ type: "UPDATE_FIELD", field: "selectedBeanName", value: inv.beanName });
    
    const foundBean = beans.find(b => b.name === inv.beanName);
    if (foundBean) {
      dispatch({ type: "UPDATE_FIELD", field: "roastLevel", value: foundBean.roastLevel });
    }

    if (inv.roastDate) {
      dispatch({ type: "UPDATE_FIELD", field: "restDays", value: calcRestDays(inv.roastDate) });
    }
  };

  const selectRecipeForInput = (recipeId: string) => {
    const found = recipes.find((item) => item.id === recipeId);
    if (!found) {
      dispatch({ type: "UPDATE_FIELD", field: "selectedRecipeId", value: "" });
      dispatch({ type: "UPDATE_FIELD", field: "recipe", value: "" });
      return;
    }
    dispatch({ type: "APPLY_RECIPE", recipe: found });
  };

  const resetAll = () => {
    dispatch({ type: "RESET_FORM" });
  };

  const abortEdit = () => {
    setEditingRecordId(null);
    resetAll();
  };

  const saveRecord = () => {
    if (!canSaveRecord) return;
    const parsedBaseClick = parseTypedNumber(brewForm.baseClickInput);
    const sanitizedBaseClick = parsedBaseClick === null ? brewForm.baseClick : round(parsedBaseClick, 1);
    const sanitizedBrewSec = brewForm.brewSec > 0 ? clamp(Math.round(brewForm.brewSec), 20, 900) : 31;
    
    if (editingRecordId) {
      const originalRecord = records.find(r => r.id === editingRecordId);
      if (!originalRecord) {
        setEditingRecordId(null);
        return;
      }

      setRecords(prev => prev.map(r => {
        if (r.id !== editingRecordId) return r;
        return {
          ...r,
          bean: brewForm.bean.trim(),
          method: brewForm.method,
          grinder: brewForm.grinder,
          brewWater: brewForm.brewWater,
          brewWaterTemp: brewForm.brewWaterTemp,
          immersionWaterTemp: brewForm.method === "Brew" && brewForm.switchApplied ? brewForm.immersionWaterTemp : null,
          dripper: brewForm.dripper,
          filterPaper: brewForm.filterPaper,
          switchApplied: brewForm.switchApplied,
          roastLevel: brewForm.roastLevel,
          scoreAverage: averageCupScore,
          cupScores: brewForm.cupScores,
          restDays: brewForm.restDays,
          brewSec: sanitizedBrewSec,
          recipe: selectedRecipeInfo?.name ?? (brewForm.recipe || ""),
          baseClick: sanitizedBaseClick,
          memo: brewForm.memo.trim(),
          dose: brewForm.dose,
          oxoUpperFilter: brewForm.method === "OXO" ? brewForm.oxoUpperFilter : undefined,
          oxoLowerFilter: brewForm.method === "OXO" ? brewForm.oxoLowerFilter : undefined,
        };
      }));
      setEditingRecordId(null);
    } else {
      const next: BrewRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        bean: brewForm.bean.trim(),
        method: brewForm.method,
        grinder: brewForm.grinder,
        brewWater: brewForm.brewWater,
        brewWaterTemp: brewForm.brewWaterTemp,
        immersionWaterTemp: brewForm.method === "Brew" && brewForm.switchApplied ? brewForm.immersionWaterTemp : null,
        dripper: brewForm.dripper,
        filterPaper: brewForm.filterPaper,
        switchApplied: brewForm.switchApplied,
        roastLevel: brewForm.roastLevel,
        scoreAverage: averageCupScore,
        cupScores: brewForm.cupScores,
        restDays: brewForm.restDays,
        brewSec: sanitizedBrewSec,
        recipe: selectedRecipeInfo?.name ?? (brewForm.recipe || ""),
        baseClick: sanitizedBaseClick,
        memo: brewForm.memo.trim(),
        inventoryId: brewForm.selectedInventoryId || undefined,
        dose: brewForm.dose,
        oxoUpperFilter: brewForm.method === "OXO" ? brewForm.oxoUpperFilter : undefined,
        oxoLowerFilter: brewForm.method === "OXO" ? brewForm.oxoLowerFilter : undefined,
      };
      setRecords((prev) => [next, ...prev]);

      if (brewForm.selectedInventoryId) {
        setInventory(prev => prev.map(inv => {
          if (inv.id === brewForm.selectedInventoryId) {
            const newWeight = Math.max(0, inv.remainingWeight - brewForm.dose);
            const newLogs = inv.manualLogs ? [...inv.manualLogs] : [];
            newLogs.push({
              date: new Date().toISOString(),
              amount: brewForm.dose,
              type: "DEC",
              reason: "추출에 의한 자동 차감"
            });
            return { 
              ...inv, 
              remainingWeight: newWeight, 
              status: newWeight === 0 ? ("DEPLETED" as InventoryStatus) : inv.status,
              manualLogs: newLogs
            };
          }
          return inv;
        }));
      }

      const k = keyOf(next.bean, next.method, next.grinder, next.dripper, next.switchApplied);
      setProfiles((prev) => {
        const old = prev[k];
        const origin = old?.baseClick ?? METHOD_CONFIG[next.method].baselineClick;
        const sampleCount = old?.sampleCount ?? 0;
        const updatedBase = round((origin * sampleCount + next.baseClick) / (sampleCount + 1));
        return {
          ...prev,
          [k]: {
            bean: next.bean,
            method: next.method,
            grinder: next.grinder,
            dripper: next.dripper,
            switchApplied: next.switchApplied,
            baseClick: updatedBase,
            sampleCount: sampleCount + 1,
            updatedAt: next.createdAt,
          },
        };
      });
    }

    dispatch({ type: "UPDATE_FIELD", field: "memo", value: "" });
    resetAll();
  };

  // --- Effects ---
  useEffect(() => {
    const config = METHOD_CONFIG[brewForm.method];
    const profile = settings.grinders[brewForm.grinder] ? 
      persistedPayload.profiles[keyOf(brewForm.bean, brewForm.method, brewForm.grinder, brewForm.dripper, brewForm.switchApplied)] : undefined;
    applyBaseClick(profile?.baseClick ?? config.baselineClick);
  }, [brewForm.bean, brewForm.method, brewForm.grinder, brewForm.dripper, brewForm.switchApplied]);

  // --- Render ---
  return (
    <motion.section 
      key="coffee-diary"
      variants={getTransitionVariants(settings.theme.pageTransition, 1200)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="coffee-diary" 
      className="mx-auto w-full max-w-6xl px-6 pt-10 pb-32 md:px-10 space-y-5 overflow-hidden"
    >
      <div className="mb-6 flex items-end justify-between border-b border-[var(--border-main)] pb-4">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>DATA_LOG</span>
          <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">기록</h2>
        </div>
      </div>

      <AnimatePresence>
        {editingRecordId && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[var(--point-color)]/10 border border-[var(--point-color)]/30 p-3 mb-4 flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center bg-[var(--point-color)] text-black">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--point-color)] uppercase">ATTENTION: EDIT_MODE_ACTIVE</span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">수정 중인 기록은 저장 시 기존 데이터를 덮어씁니다.</span>
              </div>
            </div>
            <button 
              onClick={abortEdit}
              className="px-3 py-1.5 text-[9px] font-mono font-bold border border-[var(--point-color)]/50 text-[var(--point-color)] hover:bg-[var(--point-color)] hover:text-black transition-all uppercase"
            >
              [ ABORT_EDIT ]
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="grid gap-4 sm:grid-cols-2 bg-[var(--bg-base)] border border-[var(--border-main)] p-4 sm:p-6">
        <label className="flex flex-col space-y-1.5 sm:col-span-2">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">곶간(Inventory)에서 원두 불러오기</span>
          <select value={brewForm.selectedInventoryId} onChange={(e) => loadInventoryToParams(e.target.value)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
            <option value="">-- 곶간에서 원두 및 냉동 원두 선택 --</option>
            {inventory.filter(i => i.status === "ACTIVE" || i.status === "RESTING" || i.status === "FROZEN").map((item) => (
              <option key={item.id} value={item.id}>
                {item.beanName} ({item.remainingWeight.toFixed(1)}g) - {item.status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">추출 방식</span>
          <select value={brewForm.method} onChange={(e) => dispatch({ type: "SET_METHOD", method: e.target.value as BrewMethod })} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">그라인더</span>
          <select value={brewForm.grinder} onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "grinder", value: e.target.value as Grinder })} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
            {Object.keys(settings.grinders).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">추출수</span>
          <select value={brewForm.brewWater} onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "brewWater", value: e.target.value as BrewWater })} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
            {settings.waters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">추출수 온도</span>
            <span style={{ color: "var(--point-color)" }} className="font-bold">{brewForm.brewWaterTemp.toFixed(1)}°{settings.units.temp}</span>
          </div>
          <input
            type="range"
            min={80}
            max={100}
            step={0.5}
            value={brewForm.brewWaterTemp}
            onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "brewWaterTemp", value: clamp(Number(e.target.value) || 80, 80, 100) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-none bg-zinc-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-zinc-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white"
            style={{ "--point-color": "var(--point-color)" } as React.CSSProperties}
          />
        </label>

        {brewForm.method === "Brew" && (
          <>
            <label className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">드리퍼</span>
              <select
                value={brewForm.dripper}
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "dripper", value: e.target.value as Dripper })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium"
              >
                {settings.drippers.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">여과지</span>
              <select
                value={brewForm.filterPaper}
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "filterPaper", value: e.target.value })}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium"
              >
                {settings.filters.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 border border-[var(--border-main)] bg-[var(--bg-surface)] px-4 py-3 sm:col-span-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={brewForm.switchApplied}
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "switchApplied", value: e.target.checked })}
                className="size-4 rounded-none accent-[var(--point-color)]"
                style={{ accentColor: "var(--point-color)" }}
              />
              <span className="text-[var(--text-main)] font-bold uppercase tracking-widest text-xs">스위치 적용</span>
              <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">드리퍼 옵션</span>
            </label>
            <label className="flex flex-col space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">침출수 온도</span>
                <span style={{ color: brewForm.switchApplied ? "var(--point-color)" : "inherit" }} className="font-bold">{brewForm.immersionWaterTemp.toFixed(1)}°{settings.units.temp}</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={0.5}
                value={brewForm.immersionWaterTemp}
                disabled={!brewForm.switchApplied}
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "immersionWaterTemp", value: clamp(Number(e.target.value) || 50, 50, 100) })}
                className="h-2 w-full cursor-pointer appearance-none rounded-none bg-zinc-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-zinc-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ "--point-color": "var(--point-color)" } as React.CSSProperties}
              />
            </label>
          </>
        )}

        {brewForm.method === "OXO" && (
          <div className="grid grid-cols-2 gap-4 sm:col-span-2 mt-2 pt-4 border-t border-[var(--border-main)]/50">
            <label className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">상단 필터 (UPPER_FILTER)</span>
              <select 
                value={brewForm.oxoUpperFilter} 
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "oxoUpperFilter", value: e.target.value as OXOFilterType })} 
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium"
              >
                <option value="종이">종이필터 (PAPER)</option>
                <option value="메탈">메탈필터 (METAL)</option>
                <option value="없음">필터 없음 (NONE)</option>
              </select>
            </label>
            <label className="flex flex-col space-y-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">하단 필터 (LOWER_FILTER)</span>
              <select 
                value={brewForm.oxoLowerFilter} 
                onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "oxoLowerFilter", value: e.target.value as OXOFilterType })} 
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium"
              >
                <option value="종이">종이필터 (PAPER)</option>
                <option value="메탈">메탈필터 (METAL)</option>
                <option value="없음">필터 없음 (NONE)</option>
              </select>
            </label>
          </div>
        )}
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">배전도</span>
          <input value={settings.roastLabels[brewForm.roastLevel as RoastLevel]} readOnly disabled className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm text-[var(--text-dim)] outline-none rounded-none font-medium cursor-not-allowed opacity-70" />
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">숙성일</span>
          <div className="relative">
            <input type="number" min={0} max={365} value={brewForm.restDays} readOnly disabled className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm text-[var(--text-dim)] outline-none rounded-none font-medium cursor-not-allowed opacity-70 font-mono" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-sub)]">DAYS</span>
          </div>
        </label>
        <label className="flex flex-col space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">그라인더 클릭값</span>
            <span style={{ color: "var(--point-color)" }} className="font-bold">{brewForm.baseClick.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-4 bg-[var(--bg-surface)] border border-[var(--border-main)] p-3">
            <span className="text-[10px] text-[var(--text-sub)] font-mono w-6 text-right">{(settings.grinders[brewForm.grinder] || {min:0.1}).min}</span>
            <input
              type="range"
              min={(settings.grinders[brewForm.grinder] || {min:0.1}).min}
              max={(settings.grinders[brewForm.grinder] || {max:20.0}).max}
              step={(settings.grinders[brewForm.grinder] || {step:0.1}).step}
              value={brewForm.baseClick}
              onChange={(e) => applyBaseClick(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-none bg-zinc-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-zinc-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white"
              style={{ "--point-color": "var(--point-color)" } as React.CSSProperties}
            />
            <span className="text-[10px] text-[var(--text-sub)] font-mono w-6">{(settings.grinders[brewForm.grinder] || {max:20.0}).max}</span>
          </div>
        </label>
        <label className="flex flex-col space-y-1.5 sm:col-span-2">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">레시피 (PROTOCOL)</span>
          <select
            value={brewForm.selectedRecipeId}
            onChange={(e) => selectRecipeForInput(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium"
          >
            <option value="">저장된 레시피를 선택하세요</option>
            {sortedRecipes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.drinkType} / {item.dose}g)
              </option>
            ))}
          </select>
          {brewForm.recipe && <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest pt-1">SELECTED: {brewForm.recipe}</p>}
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">원두 사용량 (DOSE)</span>
          <div className="relative">
            <TacticalNumericInput
              value={brewForm.dose}
              onChange={(val) => dispatch({ type: "UPDATE_FIELD", field: "dose", value: val })}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 pr-10 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono"
              min={1}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-muted)]">G</span>
          </div>
        </label>
        <label className="flex flex-col space-y-1.5">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">실측 추출시간(초)</span>
          <div className="relative">
            <TacticalNumericInput
              value={brewForm.brewSec}
              onChange={(val) => dispatch({ type: "UPDATE_FIELD", field: "brewSec", value: val })}
              onBlur={() => {
                if (brewForm.brewSec > 0) dispatch({ type: "UPDATE_FIELD", field: "brewSec", value: clamp(Math.round(brewForm.brewSec), 20, 900) });
              }}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 pr-10 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono"
              min={20}
              max={900}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-muted)]">SEC</span>
          </div>
        </label>
      </div>

      {selectedBeanInfo && (
        <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest mt-2 px-2 border-l border-[var(--border-main)]">
          SELECTED_BEAN: {selectedBeanInfo.name} | {selectedBeanInfo.roastery || "UNKNOWN"} | {selectedBeanInfo.region || "UNKNOWN"} | {selectedBeanInfo.variety || "UNKNOWN"}
        </p>
      )}

      <div className="space-y-4 border-t border-[var(--border-main)] pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--border-main)] pb-2">
          <h3 className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">SENSORY_EVALUATION</h3>
          <p style={{ color: 'var(--point-color)' }} className="text-sm font-bold font-mono">AVG: {averageCupScore.toFixed(1)}</p>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 bg-[var(--bg-base)] border border-[var(--border-main)] p-4 sm:p-6 mt-4">
          {SCORE_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{field.label}</span>
                <span className="text-[10px] text-[var(--text-strong)] font-mono font-bold bg-[var(--bg-surface)] border border-[var(--border-main)] px-1 py-0.5 min-w-[24px] text-center">{brewForm.cupScores[field.key].toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_CUP_SCORE}
                step={CUP_SCORE_STEP}
                value={brewForm.cupScores[field.key]}
                onChange={(e) => dispatch({ type: "UPDATE_CUP_SCORES", scores: { [field.key]: Number(e.target.value) } })}
                className="h-2 w-full cursor-pointer appearance-none rounded-none bg-zinc-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-zinc-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-white"
              />
            </label>
          ))}
          
          <div className="border border-[var(--border-main)] bg-[var(--bg-base)] sm:col-span-2 mt-4 relative">
            <span className="absolute top-2 left-2 text-[10px] text-[var(--text-sub)] font-mono uppercase tracking-widest">RADAR_GRAPH</span>
            <RadarChart scores={brewForm.cupScores} />
          </div>
        </div>
      </div>

      <label className="flex flex-col space-y-1.5 pt-4">
        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">메모 (MEMO)</span>
        <textarea rows={3} value={brewForm.memo} onChange={(e) => dispatch({ type: "UPDATE_FIELD", field: "memo", value: e.target.value })} className="w-full resize-none bg-[var(--bg-base)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-mono" placeholder="특이사항 기록..." />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-8">
        <div className="sm:col-span-3">
          <MechanicalButton
            onClick={saveRecord}
            disabled={!canSaveRecord}
            className="w-full py-4 text-sm font-bold uppercase tracking-wider text-black transition-colors"
            style={{ backgroundColor: 'var(--point-color)' }}
          >
            {editingRecordId ? "[ UPDATE_SESSION_LOG ] 기록 업데이트" : "기록 저장"}
          </MechanicalButton>
        </div>
        
        <div className="h-full">
          <MechanicalButton 
            onClick={resetAll} 
            className="w-full h-full py-4 text-[10px] font-bold tracking-widest text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-main)] hover:text-rose-500 transition-colors"
          >
            초기화
          </MechanicalButton>
        </div>
        
        {!canSaveRecord && (
          <p className="sm:col-span-4 text-[10px] font-mono animate-pulse uppercase" style={{ color: 'var(--point-color)' }}>REQUIRED: 원두 정보 누락</p>
        )}
      </div>
    </motion.section>
  );
};

export default BrewingForm;
