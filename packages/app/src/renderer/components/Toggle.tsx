import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ToggleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  checked: boolean;
};

export const Toggle = ({ checked, className, ...props }: ToggleProps) => (
  <button
    className={clsx(
      'transition-soft relative inline-flex h-7 w-12 items-center rounded-full border border-white/10',
      checked ? 'bg-accent-500/80' : 'bg-charcoal-700/80',
      className
    )}
    {...props}
  >
    <span
      className={clsx(
        'transition-soft inline-block h-5 w-5 rounded-full bg-white/90 shadow-sm',
        checked ? 'translate-x-5' : 'translate-x-1'
      )}
    />
  </button>
);
