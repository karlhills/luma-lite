import clsx from 'clsx';
import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

export const SearchInput = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <div
    className={clsx(
      'flex items-center gap-2 rounded-2xl border border-white/10 bg-charcoal-700/60 px-3 py-1.5 text-xs text-mist-400',
      className
    )}
  >
    <Search size={14} className="text-mist-500" />
    <input
      className="w-full bg-transparent text-white placeholder:text-mist-500 focus:outline-none"
      {...props}
    />
  </div>
);
