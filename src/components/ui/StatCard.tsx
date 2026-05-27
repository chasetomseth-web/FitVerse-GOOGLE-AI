import React from 'react';
import { LucideIcon } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { cn } from '../../lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
  className?: string;
  trend?: {
    value: string;
    label?: string;
    isPositive: boolean;
  };
  footer?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  icon: Icon, 
  label, 
  value, 
  color = 'text-brand-pink', 
  className,
  trend,
  footer
}) => {
  return (
    <GlassCard className={cn('p-4 space-y-2 border-l-2 border-white/5 flex flex-col justify-between', className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Icon className={cn('w-4 h-4', color)} />
          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{label}</span>
        </div>
        <p className="text-lg font-display font-black text-white leading-none uppercase italic">{value}</p>
      </div>
      {(trend || footer) && (
        <div className="flex flex-col gap-0.5 mt-1">
          {trend && (
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest",
                trend.isPositive ? "text-emerald-500" : "text-red-500"
              )}>
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                  {trend.label}
                </span>
              )}
            </div>
          )}
          {footer && (
            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
              {footer}
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
};
