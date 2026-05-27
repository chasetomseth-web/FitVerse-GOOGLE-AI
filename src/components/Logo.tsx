import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-10',
    md: 'h-16',
    lg: 'h-32',
    xl: 'h-48'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src="https://storage.cloud.google.com/imageslogo/FitVerse%20Logo%20(2).png" 
        alt="FitVerse Logo" 
        className={`${sizeClasses[size]} w-auto object-contain`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
