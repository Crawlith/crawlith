import React from 'react';
import { HistoryTrend } from '../../api';

interface TrendChartProps {
  data: HistoryTrend[];
  dataKey: keyof HistoryTrend;
  color?: string;
  height?: number;
  label?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, dataKey, color = '#3b82f6', height = 200, label }) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Not enough data to display trend.
      </div>
    );
  }

  const values = data.map(d => Number(d[dataKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide by zero

  // Add padding to range so lines don't touch edges perfectly
  const paddedMin = Math.max(0, min - (range * 0.1));
  const paddedMax = max + (range * 0.1);
  const paddedRange = paddedMax - paddedMin;

  const width = 100; // viewBox width percent-ish
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const val = Number(d[dataKey]);
    // Invert Y because SVG 0 is top
    const y = 100 - ((val - paddedMin) / paddedRange) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full relative group">
      <div className="absolute top-0 left-0 text-xs font-semibold text-slate-500">{label}</div>
      <svg
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height }}
      >
        {/* Grid lines (simple) */}
        <line x1="0" y1="0" x2="100" y2="0" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" className="dark:stroke-slate-700" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" className="dark:stroke-slate-700" />
        <line x1="0" y1="100" x2="100" y2="100" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" className="dark:stroke-slate-700" />

        {/* The Data Line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points}
          vectorEffect="non-scaling-stroke"
          className="drop-shadow-sm transition-all duration-300"
        />

        {/* Interactive Dots (visible on hover) */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * width;
          const val = Number(d[dataKey]);
          const y = 100 - ((val - paddedMin) / paddedRange) * 100;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3" // increased hit area visually by keeping r small but stroke transparent? No, just simple dot.
              fill={color}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer hover:r-4"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${d.date.split('T')[0]}: ${val}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-2">
        <span>{data[0]?.date.split('T')[0]}</span>
        <span>{data[data.length - 1]?.date.split('T')[0]}</span>
      </div>
    </div>
  );
};
