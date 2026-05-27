import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface SkeletonLoaderProps {
  variant?: 'card' | 'text' | 'circle' | 'bar';
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  variant = 'card', 
  className 
}) => {
  const variantStyles = {
    card: 'w-full h-48 rounded-3xl',
    text: 'w-3/4 h-4 rounded-lg',
    circle: 'w-12 h-12 rounded-full',
    bar: 'w-full h-8 rounded-xl'
  };

  return (
    <motion.div
      animate={{ 
        opacity: [0.3, 0.6, 0.3],
        scale: [0.98, 1, 0.98]
      }}
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: 'easeInOut' 
      }}
      className={cn(
        'bg-gradient-to-r from-brand-pink/10 to-brand-gold/10 border border-white/5',
        variantStyles[variant],
        className
      )}
    />
  );
};
