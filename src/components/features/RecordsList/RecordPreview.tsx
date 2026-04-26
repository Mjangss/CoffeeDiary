import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useAppContext } from "../../../context/AppContext";
import { BrewRecord } from "../../../types";
import { SCORE_FIELDS } from "../../../constants";
import { 
  BACKDROP_VARIANTS, 
  MODAL_VARIANTS, 
  handleDownloadScreenshot 
} from "../../../utils";
import { Portal } from "../../common/Portal";
import MechanicalButton from "../../common/MechanicalButton";

interface RecordPreviewProps {
  record: BrewRecord;
  onClose: () => void;
  onEdit: (record: BrewRecord) => void;
}

const RecordPreview: React.FC<RecordPreviewProps> = ({ record, onClose, onEdit }) => {
  const { settings } = useAppContext();
  const recordPopupRef = useRef<HTMLDivElement>(null);

  return (
    <Portal>
      <motion.div
        variants={BACKDROP_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          ref={recordPopupRef}
          variants={MODAL_VARIANTS}
          className="w-full max-w-2xl border border-[var(--border-main)] bg-[var(--bg-base)] p-6 shadow-2xl my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-main)] pb-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight">BREW_LOG_DETAILS</h3>
            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">{record.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleDownloadScreenshot(recordPopupRef, "BREW_LOG")}
              className="group relative cursor-pointer border border-[var(--border-main)] hover:border-[var(--point-color)] bg-[var(--bg-surface)]/30 p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--point-color)]/5"
              title="DOWNLOAD_SCREENSHOT"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19 7v2M19 7h-2"/>
              </svg>
            </button>
            <button 
              onClick={onClose} 
              className="cursor-pointer border border-[var(--border-hover)] hover:border-[var(--point-color)] px-3 py-1 text-xs text-[var(--text-main)] transition-colors uppercase font-mono"
            >
              CLOSE.X
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Bean Configuration</p>
              <div className="bg-[var(--bg-surface)]/50 p-3 border border-zinc-900">
                <p className="text-sm font-medium">{record.bean}</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">{settings.roastLabels[record.roastLevel]} | {record.restDays}일 숙성</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Extraction Setup</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                  <span className="text-[var(--text-muted)] block">Grinder</span>
                  <span>{record.grinder} ({record.baseClick.toFixed(1)})</span>
                </div>
                <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                  <span className="text-[var(--text-muted)] block">Dripper</span>
                  <span>{record.dripper}</span>
                </div>
                <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                  <span className="text-[var(--text-muted)] block">Water</span>
                  <span>{record.brewWater} ({record.brewWaterTemp}°C)</span>
                </div>
                {record.immersionWaterTemp !== null && (
                  <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                    <span className="text-[var(--text-muted)] block">Immersion</span>
                    <span>{record.immersionWaterTemp}°C</span>
                  </div>
                )}
                <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                  <span className="text-[var(--text-muted)] block">Time</span>
                  <span>{record.brewSec}s</span>
                </div>
                <div className="bg-[var(--bg-surface)]/50 p-2 border border-zinc-900">
                  <span className="text-[var(--text-muted)] block">Dose</span>
                  <span>{record.dose}g</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Recipe Summary</p>
              <div className="bg-[var(--bg-surface)]/50 p-3 border border-zinc-900">
                <p className="text-xs text-[var(--text-main)] leading-relaxed">{record.recipe || "NO_RECIPE_LINKED"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Cup Evaluation</p>
                <div className="text-sm font-bold" style={{ color: 'var(--point-color)' }}>AVG: {record.scoreAverage.toFixed(1)}</div>
              </div>
              <div className="bg-[var(--bg-deep)] p-4 border border-zinc-900">
                 <div className="grid grid-cols-3 gap-x-4 gap-y-1 w-full">
                    {SCORE_FIELDS.map(f => (
                      <div key={f.key} className="flex justify-between text-[9px] font-mono border-b border-white/5">
                        <span className="text-[var(--text-dim)]">{f.label.substring(0,3)}</span>
                        <span className="text-[var(--point-color)] font-bold">{record.cupScores[f.key]}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>

        {record.memo && (
          <div className="mt-4 pt-4 border-t border-[var(--border-main)]">
            <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase mb-2">Technical Notes</p>
            <div className="text-sm text-[var(--text-dim)] italic bg-[var(--bg-surface)]/30 p-3 border border-zinc-900/50">
              {record.memo}
            </div>
          </div>
        )}

        <div className="p-4 pt-0 mt-4">
          <MechanicalButton
            onClick={() => {
              onEdit(record);
            }}
            className="w-full py-4 text-sm font-bold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: 'var(--point-color)' }}
          >
            [ EDIT_PROTOCOL ] 기록 수정하기
          </MechanicalButton>
        </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

export default RecordPreview;
