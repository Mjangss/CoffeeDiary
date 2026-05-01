import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { useBrewContext } from "../../../context/BrewContext";
import { BrewRecord, BrewMethod } from "../../../types";
import { METHODS } from "../../../constants";
import { getTransitionVariants } from "../../../utils";
import SwipeableRow from "../../common/SwipeableRow";
import TacticalSortMenu from "../../common/TacticalSortMenu";
import RecordPreview from "./RecordPreview";

const RecordsList: React.FC = () => {
  const {
    records,
    setRecords,
    search,
    setSearch,
    methodFilter,
    setMethodFilter,
    settings,
    setEditingRecordId,
    setActivePage,
    recordPreview,
    setRecordPreview,
    recipes
  } = useAppContext();

  const { dispatch } = useBrewContext();

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      const byMethod = methodFilter === "All" || record.method === methodFilter;
      const bySearch = q.length === 0 || 
                       record.bean.toLowerCase().includes(q) || 
                       record.memo.toLowerCase().includes(q);
      return byMethod && bySearch;
    });
  }, [records, search, methodFilter]);

  const removeRecord = (recordId: string) => {
    setRecords((prev) => prev.filter((item) => item.id !== recordId));
  };

  const loadRecordToDiary = (target: BrewRecord) => {
    dispatch({ type: "LOAD_RECORD", record: target, recipes });
    setEditingRecordId(target.id);
    setActivePage("coffee-diary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const estimatedHeight = useMemo(() => 200 + filteredRecords.length * 150, [filteredRecords.length]);

  return (
    <motion.section 
      key="coffee-diary-records"
      variants={getTransitionVariants(settings.theme.pageTransition, estimatedHeight, settings.theme.uiScale)}
      initial="initial"
      animate="animate"
      exit="exit"
      id="coffee-diary-records" 
      className="mx-auto w-full max-w-6xl px-6 pt-10 pb-32 md:px-10 overflow-hidden"
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-wrap items-end justify-between border-b border-[var(--border-main)] pb-4 gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em]" style={{ color: 'var(--point-color)' }}>CHRONICLE</span>
            <h2 className="text-3xl font-bold uppercase tracking-tight text-[var(--text-strong)] mt-1">기록 보관소</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="SEARCH_LOG..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-2 pl-8 text-xs font-mono outline-none focus:border-[var(--point-color)] text-[var(--text-strong)] w-full sm:w-48"
              />
              <svg className="absolute left-2 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            
            <TacticalSortMenu 
              options={[{ key: "All", label: "전체 추출" }, ...METHODS.map(m => ({ key: m, label: m }))]}
              current={methodFilter}
              onSelect={(val) => setMethodFilter(val as BrewMethod | "All")}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <AnimatePresence mode="popLayout">
            {filteredRecords.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-12 text-center border border-dashed border-[var(--border-main)]/30 bg-[var(--bg-base)]/30"
              >
                <p className="font-mono text-[var(--text-muted)] uppercase text-xs">No_Records_Found_In_Database</p>
              </motion.div>
            ) : (
              filteredRecords.map((record) => (
                <SwipeableRow 
                  key={record.id} 
                  onDelete={() => removeRecord(record.id)}
                  onEdit={() => loadRecordToDiary(record)}
                >
                  <button 
                    onClick={() => setRecordPreview(record)}
                    className="w-full flex items-start justify-between bg-[var(--bg-surface)] border border-[var(--border-main)] transition-all hover:border-[var(--point-color)] group relative p-4 sm:p-5"
                  >
                    <div className="flex flex-col items-start gap-1 z-10 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--point-color)] opacity-70">[{record.method.toUpperCase()}]</span>
                        <span className="text-[9px] font-mono text-[var(--text-muted)]">{new Date(record.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-strong)] uppercase group-hover:text-[var(--point-color)] transition-colors">{record.bean}</h4>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-[var(--border-main)]/30 w-full overflow-hidden">
                        <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-tighter shrink-0">
                          <span className="text-[var(--text-muted)] mr-1">GRD:</span> {record.grinder}
                        </span>
                        <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-tighter shrink-0">
                          <span className="text-[var(--text-muted)] mr-1">DRP:</span> {record.dripper}
                        </span>
                        {record.recipe && (
                          <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-tighter truncate max-w-[150px]">
                            <span className="text-[var(--text-muted)] mr-1">REC:</span> {record.recipe}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end z-10">
                      <div className="text-xl font-black italic tracking-tighter" style={{ color: 'var(--point-color)' }}>
                         {record.scoreAverage.toFixed(1)}
                      </div>
                      <span className="text-[8px] font-mono text-[var(--text-dim)] uppercase">Avg_Score</span>
                    </div>

                    <div className="absolute right-0 top-0 h-full w-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: 'var(--point-color)' }} />
                  </button>
                </SwipeableRow>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {recordPreview && (
          <RecordPreview 
            record={recordPreview} 
            onClose={() => setRecordPreview(null)}
            onEdit={(rec) => {
              setRecordPreview(null);
              loadRecordToDiary(rec);
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export default RecordsList;
