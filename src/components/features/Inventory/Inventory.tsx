import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { InventoryItem, InventoryStatus } from "../../../types";
import { EMPTY_INVENTORY_FORM } from "../../../constants";
import { 
  getTransitionVariants, 
  calcRestDays, 
  getAgingStatus, 
  getAgingStatusDetail,
  BACKDROP_VARIANTS,
  MODAL_VARIANTS,
} from "../../../utils";
import { Portal } from "../../common/Portal";
import MechanicalButton from "../../common/MechanicalButton";
import SwipeableRow from "../../common/SwipeableRow";
import TacticalNumericInput from "../../common/TacticalNumericInput";
import TacticalSortMenu from "../../common/TacticalSortMenu";

const Inventory: React.FC = () => {
  const {
    inventory,
    setInventory,
    inventoryForm,
    setInventoryForm,
    editingInventoryId,
    setEditingInventoryId,
    inventoryInputValues,
    setInventoryInputValues,
    inventoryPreview,
    setInventoryPreview,
    inventoryStorageView,
    setInventoryStorageView,
    inventorySortMode,
    setInventorySortMode,
    inventorySortOrder,
    setInventorySortOrder,
    showStockLog,
    setShowStockLog,
    unfreezeTarget,
    setUnfreezeTarget,
    beans,
    settings,
    queueCloudSync
  } = useAppContext();

  // const { dispatch } = useBrewContext();

  const sortedInventory = useMemo(() => {
    const list = [...inventory];
    const baseSorted = list.sort((a, b) => {
      if (inventorySortMode === "freshness") {
        const ad = calcRestDays(a.roastDate, a.frozenDurationMs, a.lastFrozenAt, a.status === "FROZEN");
        const bd = calcRestDays(b.roastDate, b.frozenDurationMs, b.lastFrozenAt, b.status === "FROZEN");
        return ad - bd;
      }
      if (inventorySortMode === "weight") {
        return a.remainingWeight - b.remainingWeight;
      }
      if (inventorySortMode === "status") {
        const order: InventoryStatus[] = ["ACTIVE", "RESTING", "FROZEN", "DEPLETED"];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }
      // Default: oldest entry comparison for reverse if needed
      return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
    });

    return inventorySortOrder === "desc" ? baseSorted.reverse() : baseSorted;
  }, [inventory, inventorySortMode, inventorySortOrder]);

  const applyInventoryStatusChange = (id: string, nextStatus: InventoryStatus) => {
    const now = new Date().toISOString();
    setInventory(prev => prev.map(i => {
      if (i.id !== id) return i;
      const prevStatus = i.status;
      let newFrozenDuration = i.frozenDurationMs || 0;
      let newLastFrozenAt = i.lastFrozenAt;

      if (nextStatus === "FROZEN" && prevStatus !== "FROZEN") {
        newLastFrozenAt = now;
      } else if (prevStatus === "FROZEN" && nextStatus !== "FROZEN" && i.lastFrozenAt) {
        const duration = Date.now() - new Date(i.lastFrozenAt).getTime();
        newFrozenDuration += Math.max(0, duration);
        newLastFrozenAt = undefined;
      }

      const updated = { ...i, status: nextStatus, frozenDurationMs: newFrozenDuration, lastFrozenAt: newLastFrozenAt };
      if (updated.lastFrozenAt === undefined) delete updated.lastFrozenAt;
      return updated;
    }));

    setInventoryPreview(prev => {
      if (!prev || prev.id !== id) return prev;
      const prevStatus = prev.status;
      let newFrozenDuration = prev.frozenDurationMs || 0;
      let newLastFrozenAt = prev.lastFrozenAt;

      if (nextStatus === "FROZEN" && prevStatus !== "FROZEN") {
        newLastFrozenAt = now;
      } else if (prevStatus === "FROZEN" && nextStatus !== "FROZEN" && prev.lastFrozenAt) {
        const duration = Date.now() - new Date(prev.lastFrozenAt).getTime();
        newFrozenDuration += Math.max(0, duration);
        newLastFrozenAt = undefined;
      }
      const updated = { ...prev, status: nextStatus, frozenDurationMs: newFrozenDuration, lastFrozenAt: newLastFrozenAt };
      if (updated.lastFrozenAt === undefined) delete updated.lastFrozenAt;
      return updated;
    });

    queueCloudSync();
  };

  const estimatedHeight = useMemo(() => {
    if (inventoryStorageView === "edit") return 1000;
    return 200 + sortedInventory.length * 160;
  }, [sortedInventory.length, inventoryStorageView]);

  return (
    <motion.section 
      key="inventory"
      variants={getTransitionVariants(settings.theme.pageTransition, estimatedHeight)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="inventory" 
      className="relative mx-auto w-full max-w-6xl px-6 pt-10 pb-20 md:px-10 overflow-hidden"
    >
      <div className="mb-10 flex items-end justify-between border-b border-[var(--border-main)] pb-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>SUPPLY DEPOT</span>
          <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">곶간</h2>
        </div>
        <div className="flex items-center gap-2">
          {inventoryStorageView === "list" && (
            <TacticalSortMenu 
              options={[
                { key: "newest", label: "최신순" },
                { key: "freshness", label: "신선도순" },
                { key: "weight", label: "잔량순" },
                { key: "status", label: "상태순" }
              ]}
              current={inventorySortMode}
              order={inventorySortOrder}
              onSelect={(key) => {
                if (inventorySortMode === key) {
                  setInventorySortOrder(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setInventorySortMode(key);
                  setInventorySortOrder("desc");
                }
              }}
            />
          )}
          <button
            onClick={() => setInventoryStorageView(v => v === "list" ? "edit" : "list")}
            className="flex items-center gap-2 border border-[var(--border-main)] bg-[var(--bg-base)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-strong)] transition-all hover:border-zinc-600 hover:bg-[var(--bg-surface)]"
          >
            {inventoryStorageView === "list" ? (
              <span className="flex items-center gap-2">NEW<span className="text-[10px] text-[var(--text-muted)]">▼</span></span>
            ) : (
              <span className="flex items-center gap-2" style={{ color: 'var(--point-color)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square"><polyline points="15 18 9 12 15 6"></polyline></svg>
                BACK.LIST
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout">
          {inventoryStorageView === "list" ? (
            <motion.div
              key="inventory-list"
              initial={{ x: -20, opacity: 0, filter: "blur(4px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: -20, opacity: 0, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full"
            >
              {inventory.length === 0 ? (
                <div className="py-12 text-center text-sm font-mono text-[var(--text-sub)] border border-dashed border-[var(--border-main)] bg-[var(--bg-base)]/30">
                  NO_INVENTORY_FOUND.
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedInventory.map((item) => {
                    const remainPercent = Math.max(0, Math.min(100, (item.remainingWeight / item.initialWeight) * 100));
                    const isLow = remainPercent < 20 && remainPercent > 0;
                    const restDiff = calcRestDays(item.roastDate, item.frozenDurationMs, item.lastFrozenAt, item.status === "FROZEN");
                    
                    let statusBadge = null;
                    if (item.status === "RESTING") statusBadge = <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-bold">RESTING (D+{restDiff})</span>;
                    else if (item.status === "ACTIVE") statusBadge = <span className="bg-[var(--point-color)]/20 text-[var(--point-color)] border border-[var(--point-color)]/30 px-2 py-0.5 text-[10px] font-bold">ACTIVE</span>;
                    else if (item.status === "FROZEN") statusBadge = <span className="bg-cyan-500/20 text-cyan-500 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold">FROZEN</span>;
                    else if (item.status === "DEPLETED" || item.remainingWeight === 0) statusBadge = <span className="bg-zinc-800 text-[var(--text-muted)] border border-[var(--border-hover)] px-2 py-0.5 text-[10px] font-bold">DEPLETED</span>;

                    const matchingBean = beans.find(b => b.name === item.beanName);
                    const agingStatus = matchingBean ? getAgingStatus({ ...matchingBean, roastingDate: item.roastDate }) : "NOT_SET";

                    return (
                      <SwipeableRow
                        key={item.id}
                        onDelete={() => {
                          setInventory(prev => prev.filter(i => i.id !== item.id));
                          queueCloudSync();
                        }}
                      >
                      <div className="flex flex-col w-full p-4 sm:p-5 gap-3 bg-[var(--bg-base)] border border-[var(--border-main)] cursor-pointer" onClick={() => setInventoryPreview(item)}>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold text-[var(--text-strong)] uppercase tracking-tight leading-tight">{item.beanName}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1 font-mono uppercase">
                                <p className="text-xs text-[var(--text-dim)]">
                                  [{item.roastery}] / <span style={{ color: 'var(--point-color)' }} className="font-bold">{item.roastDate} (D+{restDiff})</span>
                                </p>
                                {matchingBean && matchingBean.peakStart !== undefined && (
                                  <div className={`px-1.5 py-0.5 border text-[8px] font-bold leading-none ${
                                    agingStatus === "DEGASSING" ? "border-cyan-900 text-cyan-400 animate-pulse" :
                                    agingStatus === "PEAK" ? "border-[var(--point-color)] text-[var(--point-color)]" :
                                    agingStatus === "PAST_PEAK" ? "border-zinc-700 text-zinc-600" :
                                    "border-zinc-800 text-zinc-500"
                                  }`}>
                                    {agingStatus.replace("_", " ")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {statusBadge}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingInventoryId(item.id);
                                  setInventoryForm({
                                    beanName: item.beanName,
                                    roastery: item.roastery,
                                    purchaseDate: item.purchaseDate,
                                    roastDate: item.roastDate,
                                    initialWeight: item.initialWeight,
                                    remainingWeight: item.remainingWeight,
                                    status: item.status,
                                    memo: item.memo,
                                    manualLogs: item.manualLogs,
                                    frozenDurationMs: item.frozenDurationMs,
                                    lastFrozenAt: item.lastFrozenAt
                                  } as InventoryItem);
                                  setInventoryStorageView("edit");
                                }}
                                className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--point-color)] border border-[var(--border-main)] bg-[var(--bg-surface)]/50 px-2 py-0.5 transition-colors uppercase"
                              >
                                [ edit ]
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-[var(--text-muted)]">0G</span>
                                <div className="flex items-center">
                                  <span className={`${isLow ? 'text-red-500 animate-pulse font-bold' : 'text-[var(--text-dim)]'}`}>
                                    {item.remainingWeight.toFixed(1)}G / {item.initialWeight}G
                                  </span>
                                </div>
                              </div>
                              <div className="h-4 w-full bg-[var(--bg-surface)] border border-[var(--border-main)] overflow-hidden relative">
                                <div className={`absolute inset-y-0 left-0 transition-all duration-500 ${isLow ? 'bg-red-600' : 'bg-emerald-600'}`} style={{ width: `${remainPercent}%` }}>
                                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.5) 5px, rgba(0,0,0,0.5) 10px)' }}></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="shrink-0 flex items-center bg-[var(--bg-base)] border border-[var(--border-main)] h-10 z-30">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const amount = parseFloat(inventoryInputValues[item.id] ?? "18") || 0;
                                  setInventory(prev => prev.map(i => {
                                    if (i.id !== item.id) return i;
                                    const newWeight = Math.max(0, i.remainingWeight - amount);
                                    const newLogs = i.manualLogs ? [...i.manualLogs] : [];
                                    newLogs.push({ date: new Date().toISOString(), amount, type: "DEC" });
                                    return { 
                                      ...i, 
                                      remainingWeight: newWeight, 
                                      status: (newWeight <= 0) ? "DEPLETED" as InventoryStatus : i.status,
                                      manualLogs: newLogs
                                    };
                                  }));
                                  queueCloudSync();
                                }}
                                className="px-3 h-full hover:bg-rose-500/10 text-[var(--text-sub)] hover:text-rose-500 transition-colors border-r border-[var(--border-main)] active:scale-90"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              </button>
                              
                              <div className="relative w-14 h-full">
                                <input 
                                  type="number"
                                  step="0.1"
                                  value={inventoryInputValues[item.id] ?? "18"}
                                  onChange={(e) => setInventoryInputValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full h-full bg-transparent text-center text-[11px] font-mono font-bold text-[var(--text-strong)] outline-none"
                                />
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const amount = parseFloat(inventoryInputValues[item.id] ?? "18") || 0;
                                  setInventory(prev => prev.map(i => {
                                    if (i.id !== item.id) return i;
                                    const newWeight = i.remainingWeight + amount;
                                    const newLogs = i.manualLogs ? [...i.manualLogs] : [];
                                    newLogs.push({ date: new Date().toISOString(), amount, type: "INC" });
                                    return { 
                                      ...i, 
                                      remainingWeight: newWeight, 
                                      status: (newWeight > 0 && i.status === "DEPLETED") ? "ACTIVE" as InventoryStatus : i.status,
                                      manualLogs: newLogs
                                    };
                                  }));
                                  queueCloudSync();
                                }}
                                className="px-3 h-full hover:bg-[var(--point-color)]/10 text-[var(--text-sub)] hover:text-[var(--point-color)] transition-colors border-l border-[var(--border-main)] active:scale-90"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="inventory-edit"
              initial={{ x: 20, opacity: 0, filter: "blur(4px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: 20, opacity: 0, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full bg-[var(--bg-base)] border border-[var(--border-main)] p-6"
            >
              <div className="flex flex-col gap-5">
                <div className="border-l-4 pl-3" style={{ borderColor: 'var(--point-color)' }}>
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--text-strong)]">{editingInventoryId ? "UPDATE SUPPLY" : "ADD SUPPLY"}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{editingInventoryId ? "기존 물자 정보를 수정합니다." : "새로운 원두 물자를 곶간에 등록합니다."}</p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">원두 선택 (LINK.BEAN)</label>
                    <select 
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none"
                      value={inventoryForm.beanName}
                      onChange={(e) => {
                        const selected = beans.find(b => b.name === e.target.value);
                        setInventoryForm(prev => ({ 
                          ...prev, 
                          beanName: e.target.value, 
                          roastery: selected?.roastery || prev.roastery 
                        }));
                      }}
                    >
                      <option value="">-- [원두] 보관함에서 불러오기 --</option>
                      {beans.map(b => (
                        <option key={b.name} value={b.name}>{b.name} ({b.roastery})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">수동 원두명 (MANUAL)</label>
                    <input 
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none"
                      placeholder="직접 입력"
                      value={inventoryForm.beanName}
                      onChange={(e) => setInventoryForm(p => ({ ...p, beanName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">로스터리 (ROASTERY)</label>
                    <input className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none" value={inventoryForm.roastery} onChange={(e) => setInventoryForm(p => ({ ...p, roastery: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">상태 (STATUS)</label>
                    <select className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none" value={inventoryForm.status} onChange={(e) => setInventoryForm(p => ({ ...p, status: e.target.value as InventoryStatus }))}>
                      <option value="RESTING">RESTING</option><option value="ACTIVE">ACTIVE</option><option value="FROZEN">FROZEN</option><option value="DEPLETED">DEPLETED</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">입고일</label>
                    <input type="date" className="w-full min-w-0 max-w-full overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-main)] px-3 py-2.5 text-sm focus:border-[var(--point-color)] outline-none appearance-none" value={inventoryForm.purchaseDate} onChange={(e) => setInventoryForm(p => ({ ...p, purchaseDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">로스팅일</label>
                    <input type="date" className="w-full min-w-0 max-w-full overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-main)] px-3 py-2.5 text-sm focus:border-[var(--point-color)] outline-none appearance-none" value={inventoryForm.roastDate} onChange={(e) => setInventoryForm(p => ({ ...p, roastDate: e.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-dim)]">초기 매입량(g)</label>
                    <TacticalNumericInput value={inventoryForm.initialWeight} onChange={(val) => setInventoryForm(p => ({ ...p, initialWeight: val, remainingWeight: val }))} className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none" min={0} />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[var(--text-dim)]">메모</label>
                  <textarea className="w-full bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 text-sm focus:border-[var(--point-color)] outline-none resize-none h-24" value={inventoryForm.memo} onChange={(e) => setInventoryForm(p => ({ ...p, memo: e.target.value }))} />
                </div>

                <div className="pt-4 border-t border-[var(--border-main)]">
                  <MechanicalButton
                    onClick={() => {
                      if (!inventoryForm.beanName.trim()) return;
                      const nowIso = new Date().toISOString();
                      if (editingInventoryId) {
                        setInventory(prev => prev.map(i => {
                          if (i.id !== editingInventoryId) return i;
                          const prevStatus = i.status;
                          const nextStatus = inventoryForm.status;
                          let newFrozenDuration = i.frozenDurationMs || 0;
                          let newLastFrozenAt = i.lastFrozenAt;
                          
                          if (nextStatus === "FROZEN" && prevStatus !== "FROZEN") {
                            newLastFrozenAt = nowIso;
                          } else if (prevStatus === "FROZEN" && nextStatus !== "FROZEN" && i.lastFrozenAt) {
                            const duration = Date.now() - new Date(i.lastFrozenAt).getTime();
                            newFrozenDuration += Math.max(0, duration);
                            newLastFrozenAt = undefined;
                          }
                          const updated = { ...i, ...inventoryForm, frozenDurationMs: newFrozenDuration, lastFrozenAt: newLastFrozenAt };
                          if (updated.lastFrozenAt === undefined) delete updated.lastFrozenAt;
                          return updated;
                        }));
                        setEditingInventoryId(null);
                      } else {
                        const newItem: InventoryItem = { ...inventoryForm, id: crypto.randomUUID(), createdAt: nowIso };
                        if (newItem.status === "FROZEN") newItem.lastFrozenAt = nowIso;
                        setInventory(prev => [newItem, ...prev]);
                      }
                      setInventoryForm(EMPTY_INVENTORY_FORM as InventoryItem);
                      setInventoryStorageView("list");
                      queueCloudSync();
                    }}
                    className="w-full py-4 text-sm font-bold uppercase tracking-wider text-black transition-colors"
                    style={{ backgroundColor: 'var(--point-color)' }}
                  >
                    {editingInventoryId ? "[ 수정 완료 ]" : "[ 등록 완료 ]"}
                  </MechanicalButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {inventoryPreview && (
          <Portal>
            <motion.div
              variants={BACKDROP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setInventoryPreview(null)}
            >
              <motion.div
                variants={MODAL_VARIANTS}
                className="w-full max-w-xl border border-[var(--border-main)] bg-[var(--bg-base)] shadow-2xl my-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between border-b border-[var(--border-main)] p-6">
                <div>
                  <h3 className="text-xl font-bold tracking-tight uppercase">SUPPLY_REPORT</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">ID: {inventoryPreview.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setInventoryPreview(null); setShowStockLog(false); }} className="cursor-pointer border border-[var(--border-hover)] hover:border-rose-500 px-3 py-1 text-xs text-[var(--text-main)] transition-colors uppercase font-mono">CLOSE.X</button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                 <div className="bg-[var(--bg-surface)]/30 border border-[var(--border-main)] p-5 space-y-4">
                    <h4 className="text-xl font-bold text-[var(--text-strong)] uppercase">{inventoryPreview.beanName}</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Status</p>
                          <select 
                             value={inventoryPreview.status}
                             onChange={(e) => {
                               const nextStatus = e.target.value as InventoryStatus;
                               if (inventoryPreview.status === "FROZEN" && nextStatus !== "FROZEN") {
                                 setUnfreezeTarget({ id: inventoryPreview.id, nextStatus });
                               } else {
                                 applyInventoryStatusChange(inventoryPreview.id, nextStatus);
                               }
                             }}
                             className="w-full bg-[var(--bg-base)] border border-[var(--border-main)] p-2 text-xs font-bold"
                          >
                             <option value="RESTING">● RESTING</option><option value="ACTIVE">● ACTIVE</option><option value="FROZEN">● FROZEN</option><option value="DEPLETED">● DEPLETED</option>
                          </select>
                       </div>
                       <div>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-1">Resting Days</p>
                          <p className="text-xs font-mono text-[var(--point-color)] bg-[var(--bg-base)] p-2 border border-[var(--border-main)] font-bold">
                             D+{calcRestDays(inventoryPreview.roastDate, inventoryPreview.frozenDurationMs, inventoryPreview.lastFrozenAt, inventoryPreview.status === "FROZEN")}
                          </p>
                       </div>
                  </div>

                  <div className="bg-[var(--bg-deep)]/50 p-4 border border-zinc-800 space-y-3">
                    {(() => {
                      const matchingBean = beans.find(b => b.name === inventoryPreview.beanName);
                      const restDays = calcRestDays(inventoryPreview.roastDate, inventoryPreview.frozenDurationMs, inventoryPreview.lastFrozenAt, inventoryPreview.status === "FROZEN");
                      
                      if (!matchingBean) {
                        return (
                          <div className="py-2 border border-dashed border-zinc-800 text-center">
                            <p className="text-[10px] font-mono text-zinc-600 uppercase">NO_RESERVE_STRATEGY_FOUND</p>
                            <p className="text-[8px] font-mono text-zinc-700 mt-1 uppercase">CURRENT_RESTING: {restDays}D</p>
                          </div>
                        );
                      }

                      const status = getAgingStatus(matchingBean, restDays);
                      const detail = getAgingStatusDetail(matchingBean, restDays);
                      
                      let color = "var(--text-dim)";
                      if (status === "DEGASSING") color = "#22d3ee";
                      if (status === "PEAK") color = "var(--point-color)";
                      if (status === "PAST_PEAK") color = "#71717a";

                      return (
                        <>
                          <div className="flex justify-between items-end">
                            <span className="text-[var(--text-muted)] block text-[9px] font-mono uppercase">Aging_Velocity_Index</span>
                            <span className="text-[10px] font-mono font-bold uppercase" style={{ color }}>{status.replace("_", " ")}</span>
                          </div>
                          
                          {matchingBean.peakStart !== undefined && matchingBean.peakEnd !== undefined ? (
                            <div className="space-y-2">
                              <div className="relative h-1.5 w-full bg-zinc-900 overflow-hidden">
                                {(() => {
                                  const start = matchingBean.peakStart!;
                                  const end = matchingBean.peakEnd!;
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
                                <span>{detail}</span>
                                <span>REST_{restDays}D</span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2 border border-dashed border-zinc-800 text-center">
                              <p className="text-[10px] font-mono text-zinc-600 uppercase">NO_AGING_STRATEGY_DEFINED</p>
                              <p className="text-[8px] font-mono text-zinc-700 mt-1 uppercase">CURRENT_RESTING: {restDays}D</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Resource Stock</p>
                      <button onClick={() => setShowStockLog(!showStockLog)} className={`px-2 py-0.5 text-[9px] font-mono border ${showStockLog ? 'bg-[var(--point-color)] text-black' : 'text-[var(--text-muted)]'}`}>
                        {showStockLog ? "[ HIDE_LOG ]" : "[ VIEW_LOG ]"}
                      </button>
                    </div>
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-4">
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-sm font-bold text-[var(--text-strong)]">{inventoryPreview.remainingWeight.toFixed(1)}G <span className="text-[10px] text-[var(--text-muted)] font-normal">REMAINING</span></span>
                          <span className="text-xs font-mono text-[var(--text-muted)]">MAX: {inventoryPreview.initialWeight}G</span>
                       </div>
                       <div className="h-2 w-full bg-[var(--bg-base)] border border-zinc-900 overflow-hidden">
                          <div className="h-full bg-[var(--point-color)] transition-all duration-500" style={{ width: `${(inventoryPreview.remainingWeight / inventoryPreview.initialWeight) * 100}%` }} />
                       </div>

                       <AnimatePresence>
                         {showStockLog && (
                           <motion.div 
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: "auto", opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="overflow-hidden mt-4"
                           >
                             <div className="border-t border-[var(--border-main)]/50 pt-4 space-y-2">
                               <p className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest mb-3">Historical_Logs</p>
                               {inventoryPreview.manualLogs && inventoryPreview.manualLogs.length > 0 ? (
                                 <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                   {inventoryPreview.manualLogs.slice().reverse().map((log, idx) => (
                                     <div key={idx} className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--border-main)]/30 pb-1.5 last:border-0 hover:bg-white/5 transition-colors">
                                       <div className="flex flex-col">
                                         <span className="text-[var(--text-sub)]">{new Date(log.date).toLocaleDateString()}</span>
                                         <span className="text-[8px] text-[var(--text-muted)]">
                                           {new Date(log.date).toLocaleTimeString()}
                                           {log.reason && <span className="ml-2 text-[var(--point-color)]/70 italic">[{log.reason}]</span>}
                                         </span>
                                       </div>
                                       <div className={`font-bold ${log.type === "INC" ? "text-[var(--point-color)]" : "text-rose-500"}`}>
                                         {log.type === "INC" ? "▲" : "▼"} {log.amount.toFixed(1)}G
                                       </div>
                                     </div>
                                   ))}
                                 </div>
                               ) : (
                                 <div className="text-[9px] text-[var(--text-muted)] italic py-2 text-center uppercase tracking-widest opacity-50">NO_RECORDED_CHANGES</div>
                               )}
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Personnel Memo</p>
                    <textarea 
                      value={inventoryPreview.memo}
                      onChange={(e) => {
                         const val = e.target.value;
                         setInventory(prev => prev.map(i => i.id === inventoryPreview.id ? { ...i, memo: val } : i));
                         setInventoryPreview(prev => prev ? { ...prev, memo: val } : null);
                      }}
                      onBlur={() => queueCloudSync()}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border-main)] p-3 text-sm text-[var(--text-main)] outline-none resize-none h-32 italic"
                    />
                 </div>
              </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {unfreezeTarget && (
          <Portal>
            <motion.div
              variants={BACKDROP_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                variants={MODAL_VARIANTS}
                className="w-full max-w-sm border border-[var(--border-main)] bg-[var(--bg-base)] p-8 shadow-2xl space-y-6 my-auto"
              >
                <h3 className="text-xl font-black text-rose-500 uppercase text-center">Warning: Status Change</h3>
                <p className="text-sm text-center">냉동 상태를 해제하시겠습니까?<br/><span className="text-[10px] text-[var(--text-dim)]">냉동 보관 기간만큼 숙성일에서 제외됩니다.</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { applyInventoryStatusChange(unfreezeTarget.id, unfreezeTarget.nextStatus); setUnfreezeTarget(null); }} className="bg-rose-500 text-white py-3 text-xs font-bold uppercase underline-offset-4 hover:underline transition-all">TERMINATE.FROZEN</button>
                  <button onClick={() => setUnfreezeTarget(null)} className="border border-[var(--border-hover)] text-[var(--text-main)] py-3 text-xs font-bold uppercase hover:bg-white/5 transition-all">ABORT.ACTION</button>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export default Inventory;
