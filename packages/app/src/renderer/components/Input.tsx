import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={clsx(
      'transition-soft w-full rounded-xl border border-white/10 bg-charcoal-700/70 px-3 py-1.5 text-xs text-white placeholder:text-mist-500 focus:border-accent-400 focus:outline-none',
      className
    )}
    {...props}
  />
);
