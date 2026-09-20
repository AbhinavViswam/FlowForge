import React from 'react';
import { Workflow } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-10 h-10'
  };

  const textClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} bg-primary text-primary-content rounded-md flex items-center justify-center shadow-sm`}>
        <Workflow className="w-[60%] h-[60%]" strokeWidth={2.5} />
      </div>
      {showText && (
        <span className={`font-bold tracking-tight text-base-content ${textClasses[size]}`}>
          FlowForge
        </span>
      )}
    </div>
  );
}

