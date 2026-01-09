import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ToggleSwitchProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  checked: boolean;
};

export const ToggleSwitch = ({ checked, className, ...props }: ToggleSwitchProps) => (
  <button
    className={clsx(
      'transition-soft relative inline-flex h-6 w-10 items-center rounded-full border border-white/10',
      checked ? 'bg-accent-500/80' : 'bg-charcoal-700/80',
      className
    )}
    {...props}
  >
    <span
      className={clsx(
        'transition-soft inline-block h-4 w-4 rounded-full bg-white/90 shadow-sm',
        checked ? 'translate-x-5' : 'translate-x-1'
      )}
    />
  </button>
);
