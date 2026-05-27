import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ProgressRingProps {
  value?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ 
  value, 
  size = 120, 
  strokeWidth = 8, 
  label, 
  className 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const displayValue = value ?? 0;
  const offset = circumference - (displayValue / 100) * circumference;

  const getColor = (val: number) => {
    if (val === 0 && value === undefined) return 'text-white/10';
    if (val < 50) return 'text-red-500';
    if (val < 70) return 'text-orange-500';
    if (val < 85) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-white/5"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <motion.circle
          className={cn('transition-all duration-1000 ease-out', getColor(displayValue))}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-display font-black text-white italic leading-none">
          {value !== undefined ? `${Math.round(value)}%` : '--'}
        </span>
        {label && <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1">{label}</span>}
      </div>
    </div>
  );
};
