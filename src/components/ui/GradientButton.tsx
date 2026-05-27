import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'yellow' | 'ghost';
  children: React.ReactNode;
}

export const GradientButton: React.FC<GradientButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className, 
  ...props 
}) => {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-brand-pink to-brand-gold text-brand-black font-black',
    secondary: 'border-2 border-brand-gold text-brand-gold bg-transparent',
    yellow: 'bg-brand-gold text-brand-black font-black',
    ghost: 'bg-transparent text-white hover:bg-white/5'
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={cn(
        'px-6 py-3 rounded-2xl font-display uppercase tracking-widest text-xs transition-all duration-300 flex items-center justify-center gap-2',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};
