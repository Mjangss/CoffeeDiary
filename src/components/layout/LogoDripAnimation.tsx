import React from "react";
import { motion } from "framer-motion";

const LogoDripAnimation = () => (
  <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center -translate-y-1">
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full overflow-visible">
      <defs>
        <filter id="logo-glow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path d="M0 64H256M0 128H256M0 192H256" stroke="white" strokeOpacity="0.03" strokeWidth="1"/>
      <path d="M64 0V256M128 0V256M192 0V256" stroke="white" strokeOpacity="0.03" strokeWidth="1"/>
      <g filter="url(#logo-glow)">
        <motion.path 
          d="M128 60C160 60 190 90 190 130C190 170 160 200 128 200C96 200 66 170 66 130C66 90 96 60 128 60Z" 
          stroke="var(--point-color)" strokeWidth="1.5" strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1.5 }}
        />
        <motion.path 
          d="M100 80Q128 130 156 180" 
          stroke="var(--point-color)" strokeWidth="3" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.5 }}
        />
      </g>
      <line x1="190" y1="130" x2="220" y2="130" stroke="var(--point-color)" strokeWidth="0.5" strokeOpacity="0.5" />
      <line x1="128" y1="60" x2="128" y2="30" stroke="var(--point-color)" strokeWidth="0.5" strokeOpacity="0.5" />
      <motion.text x="225" y="132" fill="var(--point-color)" fontFamily="monospace" fontSize="10" opacity="0.6" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.5 }}>FLOW</motion.text>
      <motion.text x="132" y="28" fill="var(--point-color)" fontFamily="monospace" fontSize="10" opacity="0.6" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.6 }}>CD-01</motion.text>
    </svg>
  </div>
);

export default LogoDripAnimation;
