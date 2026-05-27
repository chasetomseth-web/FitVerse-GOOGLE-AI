import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'pink' | 'gold' | 'none';
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  glow = 'none', 
  children, 
  className, 
  ...props 
}) => {
  const glowStyles = {
    pink: 'shadow-[0_0_20px_rgba(227,63,112,0.15)] border-brand-pink/20',
    gold: 'shadow-[0_0_20px_rgba(226,181,92,0.15)] border-brand-gold/20',
    none: 'border-white/12'
  };

  return (
    <div 
      className={cn(
        'bg-white/5 backdrop-blur-[12px] rounded-2xl border transition-all duration-300',
        glowStyles[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
