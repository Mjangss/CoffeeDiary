import React, { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { RecipeInfo, RecipePour, RecipeDrinkType, PourSwitchState, BrewMethod, OXOFilterType } from "../../../types";
import { EMPTY_RECIPE_FORM, METHODS } from "../../../constants";
import { 
  getTransitionVariants, 
  handleDownloadScreenshot,
  calculateRatioText,
  parseDilutionAmount,
  parseTimeToSeconds,
  BACKDROP_VARIANTS,
  MODAL_VARIANTS
} from "../../../utils";
import { Portal } from "../../common/Portal";
import MechanicalButton from "../../common/MechanicalButton";
import GlitchButton from "../../common/GlitchButton";
import SwipeableRow from "../../common/SwipeableRow";
import TacticalNumericInput from "../../common/TacticalNumericInput";
import TacticalSortMenu from "../../common/TacticalSortMenu";

const MINUTE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);
const SECOND_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

const RecipeStorage: React.FC = () => {
  const {
    recipes,
    setRecipes,
    recipeForm,
    setRecipeForm,
    recipePreview,
    setRecipePreview,
    recipeStorageView,
    setRecipeStorageView,
    recipeSortMode,
    setRecipeSortMode,
    recipeSortOrder,
    setRecipeSortOrder,
    setActiveRecipeForTimer,
    setActivePage,
    settings,
    queueCloudSync
  } = useAppContext();

  const recipePopupRef = useRef<HTMLDivElement>(null);

  const sortedRecipes = useMemo(() => {
    const list = [...recipes];
    const baseSorted = list.sort((a, b) => {
      if (recipeSortMode === "name") return a.name.localeCompare(b.name);
      if (recipeSortMode === "dose") return a.dose - b.dose;
      // Default / newest
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return recipeSortOrder === "desc" ? baseSorted.reverse() : baseSorted;
  }, [recipes, recipeSortMode, recipeSortOrder]);

  const updateRecipeForm = (key: keyof RecipeInfo, value: any) => {
    setRecipeForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateRecipePour = (idx: number, key: keyof RecipePour, value: any) => {
    setRecipeForm((prev) => {
      const newPours = [...prev.pours];
      newPours[idx] = { ...newPours[idx], [key]: value };
      return { ...prev, pours: newPours };
    });
  };

  const parseClockParts = (clock: string) => {
    const [m, s] = clock.split(":").map(Number);
    return { mm: isNaN(m) ? 0 : m, ss: isNaN(s) ? 0 : s };
  };

  const updateRecipeClockPart = (idx: number, field: "start" | "end", part: "mm" | "ss", value: number) => {
    setRecipeForm((prev) => {
      const newPours = [...prev.pours];
      const clock = newPours[idx][field];
      const parts = parseClockParts(clock);
      parts[part] = value;
      const newClock = `${parts.mm.toString().padStart(2, "0")}:${parts.ss.toString().padStart(2, "0")}`;
      
      newPours[idx] = { ...newPours[idx], [field]: newClock };
      
      // Chaining: If END time changes, automatically set NEXT START time
      if (field === "end" && idx < newPours.length - 1) {
        newPours[idx + 1] = { ...newPours[idx + 1], start: newClock };
      }
      
      return { ...prev, pours: newPours };
    });
  };


  const totalRecipePourWater = useMemo(() => {
    return recipeForm.pours.reduce((sum, p) => sum + p.waterMl, 0);
  }, [recipeForm.pours]);

  const recipeRatioText = useMemo(() => {
    const dilutionVals = parseDilutionAmount(recipeForm.dilutionGuide);
    return calculateRatioText(recipeForm.dose, totalRecipePourWater, dilutionVals);
  }, [totalRecipePourWater, recipeForm.dose, recipeForm.dilutionGuide]);

  const saveRecipeInfo = () => {
    if (!recipeForm.name.trim()) {
      alert("⚠️ 레시피 이름을 입력해주세요.");
      return;
    }
    
    // Filter out invalid pours and SORT them by start time to ensure consistency
    const finalPours = recipeForm.pours
      .filter(p => p.end !== "00:00")
      .sort((a, b) => {
        const aSec = parseTimeToSeconds(a.start);
        const bSec = parseTimeToSeconds(b.start);
        return aSec - bSec;
      })
      .map((p, idx) => ({ ...p, order: idx + 1 }));

    const recipeToSave: RecipeInfo = {
      ...recipeForm,
      id: recipeForm.id || crypto.randomUUID(),
      createdAt: recipeForm.createdAt || new Date().toISOString(),
      pours: finalPours
    };

    setRecipes((prev) => {
      const filtered = prev.filter((r) => r.id !== recipeToSave.id && r.name !== recipeToSave.name);
      return [recipeToSave, ...filtered];
    });

    setRecipeStorageView("list");
    queueCloudSync();
  };

  const removeRecipeInfo = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    queueCloudSync();
  };

  const loadSavedRecipe = (recipe: RecipeInfo) => {
    // Deep clone to prevent reference contamination
    const cloned: RecipeInfo = JSON.parse(JSON.stringify(recipe));
    while (cloned.pours.length < 5) {
      cloned.pours.push({ order: cloned.pours.length + 1, start: "00:00", end: "00:00", waterMl: 0, switchState: "닫힘" });
    }
    setRecipeForm(cloned);
    setRecipeStorageView("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const estimatedHeight = useMemo(() => {
    if (recipeStorageView === "edit") return 1200;
    return 200 + sortedRecipes.length * 110;
  }, [sortedRecipes.length, recipeStorageView]);

  return (
    <motion.section 
      key="recipe-storage"
      variants={getTransitionVariants(settings.theme.pageTransition, estimatedHeight, settings.theme.uiScale)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="recipe-storage" 
      className="mx-auto w-full max-w-6xl px-6 pt-10 pb-20 md:px-10"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between border-b border-[var(--border-main)] pb-4 gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>PROTOCOL</span>
          <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">레시피</h2>
        </div>
        <div className="flex items-center gap-2">
          {recipeStorageView === "list" && (
            <TacticalSortMenu 
              options={[
                { key: "newest", label: "최신순" },
                { key: "name", label: "이름순" },
                { key: "dose", label: "사용량순" }
              ]}
              current={recipeSortMode}
              order={recipeSortOrder}
              onSelect={(key) => {
                if (recipeSortMode === key) {
                  setRecipeSortOrder(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setRecipeSortMode(key);
                  setRecipeSortOrder("desc");
                }
              }}
            />
          )}
          <MechanicalButton
            onClick={() => {
              if (recipeStorageView === "list") {
                const empty = { ...EMPTY_RECIPE_FORM, id: "", createdAt: "" };
                // Add 5 empty pours for editing
                empty.pours = Array.from({ length: 5 }, (_, i) => ({
                  order: i + 1, start: "00:00", end: "00:00", waterMl: 0, switchState: "닫힘" as PourSwitchState
                }));
                setRecipeForm(empty);
                setRecipeStorageView("edit");
              } else {
                setRecipeStorageView("list");
              }
            }}
            className="w-10 h-10 flex items-center justify-center p-0"
            style={{ backgroundColor: 'var(--point-color)' }}
          >
            {recipeStorageView === "list" ? (
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            )}
          </MechanicalButton>
        </div>
      </div>

      <div className="overflow-hidden relative">
        <AnimatePresence mode="wait">
          {recipeStorageView === "edit" ? (
            <motion.div
              key="recipe-edit"
              initial={{ x: 50, opacity: 0, filter: "blur(5px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -50, opacity: 0, filter: "blur(5px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-[var(--bg-base)] border border-[var(--border-main)] p-4 sm:p-6">
                <label className="flex flex-col space-y-1.5 lg:col-span-2">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">레시피 이름 (REQUIRED)</span>
                  <input value={recipeForm.name} onChange={(e) => updateRecipeForm("name", e.target.value)} placeholder="e.g., 데일리 V60 3푸어" className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium" />
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">추출 방식 (METHOD)</span>
                  <select value={recipeForm.method} onChange={(e) => updateRecipeForm("method", e.target.value as BrewMethod)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium uppercase font-mono">
                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">타입 (HOT_ICE)</span>
                  <select value={recipeForm.drinkType} onChange={(e) => updateRecipeForm("drinkType", e.target.value as RecipeDrinkType)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium uppercase font-mono">
                    <option value="hot">HOT</option><option value="ice">ICE</option>
                  </select>
                </label>
                <label className="flex flex-col space-y-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">원두량 (DOSE)</span>
                  <div className="relative">
                    <TacticalNumericInput value={recipeForm.dose} onChange={(val) => updateRecipeForm("dose", val)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 pr-8 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium font-mono" min={1} max={100} step={0.1} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--text-muted)]">G</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 border border-[var(--border-main)] bg-[var(--bg-surface)] px-4 py-3 sm:col-span-2 lg:col-span-4 cursor-pointer select-none">
                  <input type="checkbox" checked={recipeForm.useSwitch} onChange={(e) => updateRecipeForm("useSwitch", e.target.checked)} className="size-4 rounded-none accent-[var(--point-color)]" />
                  <span className="text-[var(--text-main)] font-bold uppercase tracking-widest text-xs">스위치 사용 (IMMERSION)</span>
                </label>
                
                {recipeForm.method === "OXO" && (
                  <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-4 mt-2 pt-4 border-t border-[var(--border-main)]/50">
                    <label className="flex flex-col space-y-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">상단 필터 (UPPER_FILTER)</span>
                      <select value={recipeForm.oxoUpperFilter} onChange={(e) => updateRecipeForm("oxoUpperFilter", e.target.value as OXOFilterType)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
                        <option value="종이">종이필터 (PAPER)</option>
                        <option value="메탈">메탈필터 (METAL)</option>
                        <option value="없음">필터 없음 (NONE)</option>
                      </select>
                    </label>
                    <label className="flex flex-col space-y-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">하단 필터 (LOWER_FILTER)</span>
                      <select value={recipeForm.oxoLowerFilter} onChange={(e) => updateRecipeForm("oxoLowerFilter", e.target.value as OXOFilterType)} className="w-full bg-[var(--bg-surface)] border border(--border-main) p-3 text-sm focus:border-[var(--point-color)] outline-none rounded-none text-[var(--text-strong)] font-medium">
                        <option value="종이">종이필터 (PAPER)</option>
                        <option value="메탈">메탈필터 (METAL)</option>
                        <option value="없음">필터 없음 (NONE)</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-[var(--border-main)] pt-6">
                <h3 className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest pl-2 border-l-2 border-[var(--border-hover)]">TIMELINE_POURS</h3>
                <div className="space-y-2">
                  {recipeForm.pours.map((pour, idx) => {
                    const isEnabled = idx === 0 || recipeForm.pours[idx - 1].waterMl > 0;
                    const startParts = parseClockParts(pour.start);
                    const endParts = parseClockParts(pour.end);
                    return (
                      <div key={pour.order} className={`grid gap-2 border border-[var(--border-main)] bg-[var(--bg-base)] p-4 text-sm sm:grid-cols-[80px_1fr_1fr_100px_90px] ${isEnabled ? "" : "opacity-40 grayscale"}`}>
                        <p className="self-center text-xs font-bold font-mono tracking-widest text-[var(--text-main)]">[{pour.order}] POUR</p>
                        <label className="flex flex-col space-y-1.5">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">START (MM:SS)</span>
                          <div className="grid grid-cols-2 gap-1">
                            <select value={startParts.mm} disabled={!isEnabled || idx > 0} onChange={(e) => updateRecipeClockPart(idx, "start", "mm", Number(e.target.value))} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none rounded-none">{MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}</option>)}</select>
                            <select value={startParts.ss} disabled={!isEnabled || idx > 0} onChange={(e) => updateRecipeClockPart(idx, "start", "ss", Number(e.target.value))} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none rounded-none">{SECOND_OPTIONS.map(s => <option key={s} value={s}>{s.toString().padStart(2,"0")}</option>)}</select>
                          </div>
                        </label>
                        <label className="flex flex-col space-y-1.5">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">END (MM:SS)</span>
                          <div className="grid grid-cols-2 gap-1">
                            <select value={endParts.mm} disabled={!isEnabled} onChange={(e) => updateRecipeClockPart(idx, "end", "mm", Number(e.target.value))} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none rounded-none">{MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m.toString().padStart(2,"0")}</option>)}</select>
                            <select value={endParts.ss} disabled={!isEnabled} onChange={(e) => updateRecipeClockPart(idx, "end", "ss", Number(e.target.value))} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none rounded-none">{SECOND_OPTIONS.map(s => <option key={s} value={s}>{s.toString().padStart(2,"0")}</option>)}</select>
                          </div>
                        </label>
                        <label className="flex flex-col space-y-1.5">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">WATER (ml)</span>
                          <TacticalNumericInput value={pour.waterMl} onChange={(val) => updateRecipePour(idx, "waterMl", val)} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-sm font-mono text-center outline-none" min={0} max={2000} disabled={!isEnabled} />
                        </label>
                        {recipeForm.useSwitch ? (
                          <label className="flex flex-col space-y-1.5">
                            <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">SWITCH</span>
                            <select value={pour.switchState} disabled={!isEnabled} onChange={(e) => updateRecipePour(idx, "switchState", e.target.value)} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 text-xs font-mono outline-none"><option value="닫힘">CLOSED</option><option value="열림">OPEN</option></select>
                          </label>
                        ) : <div className="flex flex-col justify-end pb-2"><span className="text-[10px] text-[var(--text-muted)] font-mono text-center block w-full bg-[var(--bg-surface)] border border-[var(--border-main)] py-2">DISABLED</span></div>}
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-4 border border-[var(--border-main)] bg-[var(--bg-base)] p-4 sm:grid-cols-2 mt-4">
                  <label className="flex flex-col space-y-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">가수 추천량 (ml)</span>
                    <input value={recipeForm.dilutionGuide} onChange={(e) => updateRecipeForm("dilutionGuide", e.target.value)} placeholder="e.g., 70-100ml" className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none" />
                  </label>
                  <label className="flex flex-col space-y-1.5 sm:col-span-2">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">메모</span>
                    <textarea rows={2} value={recipeForm.memo} onChange={(e) => updateRecipeForm("memo", e.target.value)} className="w-full resize-none bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none" />
                  </label>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 sm:col-span-2 flex items-center justify-between font-mono">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">TOTAL_WATER: <span style={{ color: 'var(--point-color)' }}>{totalRecipePourWater.toFixed(1)}ml</span></span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">TARGET_RATIO: <span style={{ color: 'var(--point-color)' }}>{recipeRatioText}</span></span>
                  </div>
                </div>
              </div>

              <MechanicalButton onClick={saveRecipeInfo} className="w-full py-4 text-sm font-bold uppercase tracking-wider transition-colors" style={{ backgroundColor: 'var(--point-color)' }}>[ SAVE_PROTOCOL ] 레시피 저장</MechanicalButton>
            </motion.div>
          ) : (
            <motion.div
              key="recipe-list"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 10, opacity: 0 }}
              className="grid gap-3 pt-2"
            >
              <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-widest pb-2 border-b border-[var(--border-main)]">TOTAL_STORED_RECIPES: {recipes.length}</p>
              {sortedRecipes.length === 0 && <div className="py-12 text-center text-sm font-mono text-[var(--text-sub)] border border-dashed border-[var(--border-main)] bg-[var(--bg-base)]/30">NO_RECIPES_ENCODED</div>}
              {sortedRecipes.map((item) => (
                <SwipeableRow key={item.id} onDelete={() => removeRecipeInfo(item.id)}>
                  <div className="flex flex-col w-full p-4 sm:p-5 gap-3 bg-[var(--bg-base)] border border-[var(--border-main)] group cursor-pointer" onClick={() => setRecipePreview(JSON.parse(JSON.stringify(item)))}>
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-[var(--text-strong)] uppercase tracking-tight leading-tight">{item.name}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1 uppercase font-bold tracking-widest">RECIPE_ID: {item.id.substring(0,8).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 border-t border-[var(--border-main)]/50 pt-3">
                      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex gap-1.5 align-baseline">
                          <span className="text-[var(--text-sub)]">TYPE</span>
                          <span style={{ color: 'var(--point-color)' }} className="font-bold">{item.drinkType.toUpperCase()}</span>
                        </span>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex gap-1.5 align-baseline">
                          <span className="text-[var(--text-sub)]">DOSE</span>
                          <span style={{ color: 'var(--point-color)' }} className="font-bold">{item.dose}G</span>
                        </span>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-widest flex gap-1.5 align-baseline text-nowrap">
                          <span className="text-[var(--text-sub)]">RATIO</span>
                          <span style={{ color: 'var(--point-color)' }} className="font-bold">
                            {(() => {
                              const total = item.pours.reduce((sum, p) => sum + p.waterMl, 0);
                              const dVals = parseDilutionAmount(item.dilutionGuide);
                              return calculateRatioText(item.dose, total, dVals);
                            })()}
                          </span>
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 border-l border-[var(--border-main)] pl-4">
                        <GlitchButton label="EDIT" onClick={(e) => { e.stopPropagation(); loadSavedRecipe(item); }} className="px-3 py-1.5 text-[9px] border border-[var(--border-hover)]" />
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {recipePreview && (
          <Portal>
            <motion.div
              variants={BACKDROP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setRecipePreview(null)}
            >
              <motion.div
                ref={recipePopupRef}
                variants={MODAL_VARIANTS}
                className="w-full max-w-2xl border border-[var(--border-main)] bg-[var(--bg-base)] shadow-2xl my-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between border-b border-[var(--border-main)] p-6">
                <div><h3 className="text-xl font-bold tracking-tight uppercase">PROTOCOL_REPORT</h3><p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">ID: {recipePreview.id.substring(0,12)}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownloadScreenshot(recipePopupRef, "RECIPE_REPORT")} className="border border-[var(--border-main)] p-2 text-[var(--text-muted)] hover:border-[var(--point-color)] transition-all cursor-pointer"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M19 7v2M19 7h-2"/></svg></button>
                  <button onClick={() => setRecipePreview(null)} className="cursor-pointer border border-[var(--border-hover)] px-3 py-1 text-xs uppercase font-mono">CLOSE.X</button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                 <div className="bg-[var(--bg-surface)]/50 p-4 border border-zinc-900 group">
                    <h4 className="text-xl font-bold uppercase text-[var(--text-strong)]">{recipePreview.name}</h4>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-[10px] font-mono text-[var(--text-dim)] uppercase">
                      <span>Method: {recipePreview.method}</span>
                      <span>Type: {recipePreview.drinkType}</span>
                      <span>Dose: {recipePreview.dose}g</span>
                      <span>Ratio: {(() => {
                        const total = recipePreview.pours.reduce((s: number, p: any) => s + p.waterMl, 0);
                        const dilutionVals = parseDilutionAmount(recipePreview.dilutionGuide);
                        return calculateRatioText(recipePreview.dose, total, dilutionVals);
                      })()}</span>
                    </div>
                    {recipePreview.method === "OXO" && (
                      <div className="mt-3 flex gap-4 pt-3 border-t border-zinc-900">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-[var(--text-muted)] tracking-tighter">UPPER_FILTER</span>
                          <span className="text-[10px] text-[var(--point-color)] font-bold">[{recipePreview.oxoUpperFilter}]</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-[var(--text-muted)] tracking-tighter">LOWER_FILTER</span>
                          <span className="text-[10px] text-[var(--point-color)] font-bold">[{recipePreview.oxoLowerFilter}]</span>
                        </div>
                      </div>
                    )}
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest pl-2 border-l-2 border-[var(--point-color)]">Extraction Timeline</p>
                    <div className="space-y-2">
                       {recipePreview.pours.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-[var(--bg-deep)]/50 p-3 border border-zinc-900">
                             <div className="flex flex-col"><span className="text-[9px] font-mono text-[var(--text-muted)]">POUR {p.order}</span><span className="text-xs font-bold font-mono text-[var(--text-strong)]">{p.start} - {p.end}</span></div>
                             <div className="flex items-center gap-4">
                                {recipePreview.useSwitch && <div className="text-right"><span className="text-[9px] font-mono text-[var(--text-muted)] block">VALVE</span><span className={`text-[9px] font-bold px-1.5 py-0.5 border ${p.switchState === '열림' ? 'border-emerald-900 text-emerald-500' : 'border-rose-900 text-rose-500'}`}>{p.switchState === '열림' ? 'OPEN' : 'CLOSED'}</span></div>}
                                <div className="text-right"><span className="text-[9px] font-mono text-[var(--text-muted)] block">TARGET</span><span className="text-sm font-bold font-mono text-[var(--point-color)]">{p.waterMl}ml</span></div>
                             </div>
                          </div>
                       ))}
                       <div className="mt-4 p-3 bg-[var(--bg-base)] border border-dashed border-zinc-800 text-center"><span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Total Water: {recipePreview.pours.reduce((s,p)=>s+p.waterMl,0)}ml</span></div>
                    </div>
                 </div>
                 {recipePreview.dilutionGuide && <div className="space-y-1"><p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Dilution Guide</p><div className="bg-zinc-900/50 p-3 border border-zinc-800"><p className="text-xs font-mono text-emerald-500">{recipePreview.dilutionGuide}</p></div></div>}
                 {recipePreview.memo && <div className="space-y-1"><p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Protocol Notes</p><div className="bg-[var(--bg-surface)] p-3 border border-zinc-800 italic"><p className="text-xs text-[var(--text-dim)]">{recipePreview.memo}</p></div></div>}
              </div>
              <div className="p-6 pt-0 grid grid-cols-2 gap-3">
                <MechanicalButton 
                  onClick={() => {
                    setActiveRecipeForTimer(JSON.parse(JSON.stringify(recipePreview)));
                    setActivePage("brewing-timer");
                    setRecipePreview(null);
                  }} 
                  className="w-full py-4 text-xs font-bold uppercase tracking-widest text-black" 
                  style={{ backgroundColor: 'var(--point-color)' }}
                >
                  [ DEPLOY_MISSION ]
                </MechanicalButton>
                <MechanicalButton 
                  onClick={() => setRecipePreview(null)} 
                  className="w-full py-4 text-xs font-bold uppercase tracking-widest border border-[var(--border-main)] bg-[var(--bg-surface)] hover:bg-[var(--bg-base)]"
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

export default RecipeStorage;
