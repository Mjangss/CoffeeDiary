import React from "react";
import { PageKey } from "../../types";

interface NavIconProps {
  type: PageKey;
  active: boolean;
}

const NavIcon: React.FC<NavIconProps> = ({ type, active }) => {
  const strokeWidth = active ? 1.4 : 1.1;
  const color = active ? "var(--point-color)" : "currentColor";
  const glowClass = active ? "drop-shadow-[0_0_4px_var(--point-color)]" : "";

  const NodeDot = ({ cx, cy, pulse = true }: { cx: number, cy: number, pulse?: boolean }) => (
    <circle cx={cx} cy={cy} r={0.7} fill={color} className={(active && pulse) ? "animate-pulse" : "opacity-50"} />
  );

  if (type === "coffee-diary") {
    // Brew Log: Notepad + Technical Pen
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="square">
        <path d="M5 4h11l0 16h-11a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
        <rect x="18" y="4" width="1.5" height="12" />
        <path d="M18.75 16l0.25 4-1-1z" fill={color} />
        <line x1="3.5" y1="7" x2="4.5" y2="7" /> <line x1="3.5" y1="11" x2="4.5" y2="11" /> <line x1="3.5" y1="15" x2="4.5" y2="15" />
        <line x1="7" y1="8" x2="13" y2="8" opacity="0.3" />
        <line x1="7" y1="12" x2="13" y2="12" opacity="0.3" />
        <line x1="7" y1="16" x2="13" y2="16" opacity="0.3" />
        <NodeDot cx={16} cy={4} /><NodeDot cx={16} cy={20} /><NodeDot cx={18.75} cy={4} />
      </svg>
    );
  }
  if (type === "coffee-diary-records") {
    // History: Clock + S-Curve Timeline
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="10" cy="8" r="6" strokeDasharray="1 1" />
        <path d="M10 5v3l3 2" />
        <path d="M4 19h4s2 0 2-2v-4s0-2 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2" />
        <path d="M22 19l-3 3M22 19l-3-3" strokeWidth="0.7" />
        <NodeDot cx={4} cy={19} /><NodeDot cx={10} cy={13} /><NodeDot cx={22} cy={19} />
      </svg>
    );
  }
  if (type === "bean-storage") {
    // Bean Storage: Wireframe Hexes + Central Bean
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M12 4c-4.4 0-8 3.5-8 8s3.6 8 8 8 8-3.5 8-8-3.6-8-8-8z" />
        <path d="M12 4v16" strokeWidth="0.5" opacity="0.6" />
        <path d="M12 4c-2 4-2 12 0 16M12 4c2 4 2 12 0 16" strokeWidth="0.5" opacity="0.3" />
        <path d="M23 7l-3-1.7v3.4l3 1.7z" opacity="0.4" />
        <path d="M4 16l-3-1.7v3.4l3 1.7z" opacity="0.4" />
        <NodeDot cx={12} cy={4} /><NodeDot cx={12} cy={20} pulse={false} />
        <NodeDot cx={23} cy={7} pulse={false} /><NodeDot cx={1} cy={16} pulse={false} />
      </svg>
    );
  }
  if (type === "recipe-storage") {
    // Recipes: Flask + Scale + Funnel
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M7 4h10l-2 15H9z" />
        <line x1="8" y1="8" x2="16" y2="8" strokeDasharray="1 1" opacity="0.3" />
        <line x1="8.5" y1="12" x2="15.5" y2="12" strokeDasharray="1 1" opacity="0.3" />
        <path d="M21 7l-2 3h4l-2 3" opacity="0.6" />
        <circle cx="5" cy="12" r="1.5" />
        <path d="M5 12c-1.5 2 0 4 1.5 4" opacity="0.3" />
        <NodeDot cx={7} cy={4} pulse={false} /><NodeDot cx={17} cy={4} pulse={false} /><NodeDot cx={12} cy={19} />
      </svg>
    );
  }
  if (type === "inventory") {
    // Inventory: Stacked Isometric Boxes + Data pointers
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M12 3l-5 3v6l5 3 5-3V6z" />
        <path d="M7 12l-5 3v6l5 3 5-3v-6z" />
        <path d="M17 12l-5 3v6l5 3 5-3v-6z" />
        <path d="M5 10l-2 0" opacity="0.4" />
        <NodeDot cx={12} cy={3} /><NodeDot cx={12} cy={15} />
        <NodeDot cx={2} cy={15} pulse={false} /><NodeDot cx={22} cy={15} pulse={false} />
      </svg>
    );
  }
  if (type === "settings") {
    // Settings: Gear system + Radar Crosshair
    return (
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${glowClass}`} fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="10" strokeDasharray="2 4" opacity="0.2" />
        <line x1="0" y1="12" x2="24" y2="12" opacity="0.4" />
        <line x1="12" y1="0" x2="12" y2="24" opacity="0.4" />
        <circle cx="9" cy="10" r="4" /> <circle cx="9" cy="10" r="1.5" />
        <circle cx="16" cy="16" r="3" /> <circle cx="16" cy="16" r="1" />
        <NodeDot cx={12} cy={2} /><NodeDot cx={12} cy={22} /><NodeDot cx={2} cy={12} /><NodeDot cx={22} cy={12} />
      </svg>
    );
  }

  return null;
};

export default NavIcon;
