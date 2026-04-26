import React from "react";

interface TacticalNumericInputProps {
  value: number;
  onChange: (val: number) => void;
  onBlur?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
}

const TacticalNumericInput: React.FC<TacticalNumericInputProps> = ({ 
  value, 
  onChange, 
  onBlur, 
  onFocus, 
  className = "", 
  placeholder, 
  min, 
  max, 
  step, 
  disabled 
}) => (
  <input
    type="number"
    value={value === 0 ? "" : value}
    onFocus={(e) => {
      e.target.select();
      onFocus?.(e);
    }}
    onChange={(e) => {
      const val = e.target.value;
      if (val === "") {
        onChange(0);
        return;
      }
      const parsed = parseFloat(val);
      onChange(isNaN(parsed) ? 0 : parsed);
    }}
    onBlur={onBlur}
    className={className}
    placeholder={placeholder}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
  />
);

export default TacticalNumericInput;
