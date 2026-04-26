import React, { useState } from "react";

interface GlitchButtonProps {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

const GlitchButton: React.FC<GlitchButtonProps> = ({ 
  label, 
  onClick, 
  className = "", 
  style 
}) => {
  const [displayText, setDisplayText] = useState(label);
  const chars = "X/-_[]<>01BH";
  
  const triggerGlitch = (e: React.MouseEvent) => {
    e.stopPropagation();
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplayText(label.split("").map((_char, i) => {
        if (i < iterations) return label[i];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(""));
      
      iterations += 1/2;
      if (iterations >= label.length) {
        clearInterval(interval);
        setDisplayText(label);
        onClick?.(e);
      }
    }, 40);
  };

  return (
    <button onClick={triggerGlitch} className={className} style={style}>
      {displayText}
    </button>
  );
};

export default GlitchButton;
