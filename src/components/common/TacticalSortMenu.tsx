import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TacticalSortMenuProps {
  options: { key: string; label: string }[];
  current: string;
  order?: "asc" | "desc";
  onSelect: (key: any) => void;
}

const TacticalSortMenu: React.FC<TacticalSortMenuProps> = ({ 
  options, 
  current, 
  order,
  onSelect 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        title="ARRANGE.SYS"
        className={`p-2 border transition-all duration-300 active:scale-95 flex items-center justify-center ${isOpen ? 'border-[var(--point-color)] bg-[var(--point-color)]/10 text-[var(--point-color)]' : 'border-[var(--border-main)] bg-[var(--bg-base)] text-[var(--text-muted)] hover:border-zinc-600 hover:text-[var(--text-main)]'}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
          <rect x="3" y="4" width="18" height="4" />
          <rect x="3" y="10" width="18" height="4" />
          <rect x="3" y="16" width="18" height="4" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close menu */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div
              initial={{ opacity: 0, y: -5, x: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, x: 5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 min-w-[150px] border border-[var(--border-main)] bg-[var(--bg-base)] shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1 backdrop-blur-sm"
            >
              <div className="text-[8px] font-mono text-[var(--text-sub)] px-2.5 py-1.5 border-b border-zinc-900 mb-1 uppercase tracking-widest flex justify-between items-center">
                <span>SORT.SYS_v1.0</span>
                <span className="w-1 h-1 bg-zinc-800 rounded-full animate-pulse" />
              </div>
              
              {options.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => {
                    onSelect(opt.key);
                    setIsOpen(false);
                  }}
                  className={`group w-full text-left px-3 py-2 text-[10px] font-mono uppercase transition-all duration-200 flex items-center justify-between border border-transparent ${current === opt.key ? 'text-[var(--point-color)] bg-[var(--point-color)]/5 border-[var(--point-color)]/20' : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-zinc-200'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-1 rounded-full transition-colors ${current === opt.key ? 'bg-[var(--point-color)] shadow-[0_0_8px_var(--point-color)]' : 'bg-zinc-800'}`} />
                    {opt.label}
                  </span>
                  {current === opt.key && (
                    <motion.span 
                      layoutId="active-sort-indicator"
                      className="text-[8px] opacity-60 font-bold flex items-center gap-1"
                    >
                      <span className="text-[var(--point-color)]">{order === 'asc' ? '[ASC_▲]' : '[DESC_▼]'}</span>
                      <span className="opacity-30">[*]</span>
                    </motion.span>
                  )}
                </button>
              ))}
              
              <div className="mt-1 pt-1 border-t border-zinc-900 text-[7px] text-zinc-700 font-mono px-2 py-1 tracking-tighter uppercase text-right">
                ID: CFG_001
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TacticalSortMenu;
