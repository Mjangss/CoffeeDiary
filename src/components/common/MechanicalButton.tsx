import React from "react";
import { motion } from "framer-motion";

interface MechanicalButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const MechanicalButton: React.FC<MechanicalButtonProps> = ({ 
  children, 
  onClick, 
  className = "", 
  style, 
  disabled 
}) => {
  const isPointBg = style?.backgroundColor === 'var(--point-color)';
  const baseStyle = {
    ...style,
    ...(isPointBg ? { color: 'var(--point-foreground)' } : {})
  };

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.95, y: 1 }}
      whileHover={typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches ? (disabled ? {} : { scale: 1.02, y: -1 }) : {}}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden touch-manipulation ${className}`}
      style={baseStyle}
    >
    <div className="relative z-10">{children}</div>
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      whileTap={{ opacity: 0.3, scale: 2 }}
      className="absolute inset-0 bg-[var(--point-color)] rounded-full blur-2xl -z-0"
      transition={{ duration: 0.2 }}
    />
    </motion.button>
  );
};

export default MechanicalButton;
