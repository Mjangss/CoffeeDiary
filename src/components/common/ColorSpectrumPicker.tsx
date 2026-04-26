import React, { useRef } from "react";
import { motion } from "framer-motion";

interface ColorSpectrumPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const ColorSpectrumPicker: React.FC<ColorSpectrumPickerProps> = ({ value, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // HSL 값 파싱 로직
  const match = value.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  const hue = match ? parseInt(match[1]) : 0;
  const saturation = match ? parseInt(match[2]) : 90;
  const lightness = match ? parseInt(match[3]) : 50;

  const handleInteract = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // X축: Hue (0 ~ 360)
    let x = (clientX - rect.left) / rect.width;
    x = Math.max(0, Math.min(1, x));
    const newHue = Math.round(x * 360);
    
    // Y축: Saturation (100 ~ 0, 위쪽이 100%)
    let y = (clientY - rect.top) / rect.height;
    y = Math.max(0, Math.min(1, y));
    const newSat = Math.round((1 - y) * 100);
    
    onChange(`hsl(${newHue}, ${newSat}%, ${lightness}%)`);
  };

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef}
        onMouseDown={(e) => {
          handleInteract(e);
          const handleMove = (moe: MouseEvent) => handleInteract(moe as any);
          const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
          };
          window.addEventListener('mousemove', handleMove);
          window.addEventListener('mouseup', handleUp);
        }}
        onTouchMove={handleInteract}
        className="relative w-full h-48 border border-[var(--border-main)] cursor-crosshair overflow-hidden bg-black select-none"
      >
        {/* Hue Gradient (X) */}
        <div 
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}
        />
        {/* Saturation Gradient (Y) */}
        <div 
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent, #808080)' }}
        />
        
        {/* Tactical Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {/* Crosshair & Selector */}
        <motion.div 
          className="absolute pointer-events-none"
          style={{ 
            left: `${(hue / 360) * 100}%`, 
            top: `${100 - saturation}%`,
          }}
        >
          {/* 가로세로 추적선 */}
          <div className="absolute top-[-1000px] left-0 w-[0.5px] h-[2000px] bg-white/30" />
          <div className="absolute left-[-1000px] top-0 h-[0.5px] w-[2000px] bg-white/30" />
          
          {/* 중앙 조준점 */}
          <div className="relative -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center">
             <div className="w-1 h-1 bg-white" />
             <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white whitespace-nowrap bg-black/50 px-1">SAT:{saturation}%</div>
             <div className="absolute top-1/2 -left-12 -translate-y-1/2 text-[8px] font-mono text-white whitespace-nowrap bg-black/50 px-1">HUE:{hue}°</div>
          </div>
        </motion.div>
        
        {/* 모서리 장식 */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/50" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/50" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/50" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/50" />
      </div>

      {/* Digital Readout Panel */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border-main)] font-mono text-[9px] uppercase tracking-tighter">
        <div className="flex flex-col gap-1">
          <span className="text-[var(--text-dim)]">COORDINATE_H</span>
          <span className="text-[var(--text-strong)] font-bold text-xs">{hue.toString().padStart(3, '0')}°</span>
        </div>
        <div className="flex flex-col gap-1 border-x border-[var(--border-main)] px-2">
          <span className="text-[var(--text-dim)]">INTENSITY_S</span>
          <span className="text-[var(--text-strong)] font-bold text-xs">{saturation}%</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="text-[var(--text-dim)]">SYSTEM_CODE</span>
          <span className="text-[var(--point-color)] font-bold text-xs truncate" title={value}>{value.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

export default ColorSpectrumPicker;
