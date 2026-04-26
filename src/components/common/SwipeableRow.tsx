import React, { useState } from "react";
import { motion } from "framer-motion";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit?: () => void;
  onClick?: () => void;
  className?: string;
}

const SwipeableRow: React.FC<SwipeableRowProps> = ({ 
  children, 
  onDelete, 
  onEdit,
  onClick, 
  className = "" 
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  
  return (
    <motion.div 
      className={`relative group mb-1 last:mb-0 h-auto ${className}`}
    >
      {/* Hazard Background Layer */}
      <motion.div 
        initial={false}
        animate={{ opacity: isConfirming ? 1 : 0.4 }}
        className="absolute inset-0 bg-hazard flex items-center justify-end pr-4 z-0 pointer-events-none" 
      />
      
      {/* Action Area (Edit/Delete) */}
      <motion.div 
        initial={false}
        animate={{ 
          width: isConfirming ? "100%" : "140px",
          opacity: 1
        }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="absolute inset-y-0 right-0 flex items-center z-10"
      >
        {!isConfirming ? (
          <div className="flex w-full h-full">
            {onEdit && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="flex-1 h-full bg-zinc-800 uppercase font-mono text-[10px] font-bold text-[var(--text-strong)] hover:bg-zinc-700 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                Edit
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} 
              className="flex-1 h-full bg-rose-600/90 uppercase font-mono text-[10px] font-bold text-[var(--text-strong)] hover:bg-rose-500 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 sm:gap-8 text-[var(--text-strong)] w-full px-4 bg-rose-600/90 h-full">
            <span className="font-mono text-[9px] sm:text-xs font-bold tracking-widest animate-pulse whitespace-nowrap">PROTOCOL_DELETION_REQUIRED?</span>
            <div className="flex gap-3 shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); setIsConfirming(false); }}
                className="bg-white text-rose-600 px-4 py-1.5 text-[10px] font-bold uppercase border border-white active:bg-transparent active:text-[var(--text-strong)] transition-all h-8 flex items-center"
              >
                [YES]
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
                className="border border-white text-[var(--text-strong)] px-4 py-1.5 text-[10px] font-bold uppercase active:bg-white active:text-rose-600 transition-all h-8 flex items-center"
              >
                [NO]
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        drag={isConfirming ? false : "x"}
        dragConstraints={{ right: 0, left: -140 }}
        dragElastic={0.1}
        animate={isConfirming ? { x: -100, opacity: 0, pointerEvents: 'none' as any } : { x: 0, opacity: 1, pointerEvents: 'auto' as any }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -100) setIsConfirming(true);
        }}
        onClick={onClick}
        className={`relative z-20 bg-[var(--bg-base)] border border-[var(--border-main)] cursor-pointer active:cursor-grabbing ${className}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default SwipeableRow;
