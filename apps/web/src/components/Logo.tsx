import { Workflow } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const box = { sm: 'w-6 h-6', md: 'w-7 h-7', lg: 'w-10 h-10' }[size];
  const text = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${box} bg-accent text-accent-ink rounded-lg flex items-center justify-center shadow-sm`}>
        <Workflow className="w-[58%] h-[58%]" strokeWidth={2.5} />
      </div>
      {showText && (
        <span className={`font-display font-bold tracking-tight text-ink ${text}`}>FlowForge</span>
      )}
    </div>
  );
}
