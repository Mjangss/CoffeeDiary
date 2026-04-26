import React, { useMemo } from "react";
import { CupScores } from "../../types";
import { SCORE_FIELDS, MAX_CUP_SCORE } from "../../constants";

interface RadarChartProps {
  scores: CupScores;
  size?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ scores, size = 300 }) => {
  const cupRadar = useMemo(() => {
    const center = size / 2;
    const radius = size * 0.35;
    const fields = SCORE_FIELDS;
    const angleStep = (Math.PI * 2) / fields.length;

    const axes = fields.map((f, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return {
        key: f.key,
        label: f.label,
        end: {
          x: center + radius * Math.cos(angle),
          y: center + radius * Math.sin(angle),
        },
        labelPos: {
          x: center + (radius + 20) * Math.cos(angle),
          y: center + (radius + 20) * Math.sin(angle),
        },
      };
    });

    const levelPolygons = [0.2, 0.4, 0.6, 0.8, 1.0].map((level) => {
      return fields
        .map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const currR = radius * level;
          return `${center + currR * Math.cos(angle)},${center + currR * Math.sin(angle)}`;
        })
        .join(" ");
    });

    const dataPolygon = fields
      .map((f, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const val = scores[f.key];
        const currR = radius * (val / MAX_CUP_SCORE);
        return `${center + currR * Math.cos(angle)},${center + currR * Math.sin(angle)}`;
      })
      .join(" ");

    return { size, center, axes, levelPolygons, dataPolygon };
  }, [scores, size]);

  return (
    <div className="flex justify-center py-4">
      <svg viewBox={`0 0 ${cupRadar.size} ${cupRadar.size}`} className="h-72 w-full max-w-md">
        {cupRadar.levelPolygons.map((points, idx) => (
          <polygon key={`grid-${idx + 1}`} points={points} fill="none" stroke="#27272a" strokeWidth="1" strokeDasharray="2 2" />
        ))}
        {cupRadar.axes.map((axis) => (
          <line key={`axis-${axis.key}`} x1={cupRadar.center} y1={cupRadar.center} x2={axis.end.x} y2={axis.end.y} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        <polygon points={cupRadar.dataPolygon} fill="var(--point-color)" fillOpacity="0.15" stroke="var(--point-color)" strokeWidth="1.5" />
        {cupRadar.axes.map((axis) => (
          <text key={`label-${axis.key}`} x={axis.labelPos.x} y={axis.labelPos.y} textAnchor="middle" dominantBaseline="middle" fill="#a1a1aa" fontSize="10" fontFamily="monospace">
            {axis.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default RadarChart;
