import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

export const Button = ({ variant = 'primary', className, ...props }: ButtonProps) => {
  const base =
    'transition-soft inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold';
  const styles = {
    primary: 'bg-accent-500/90 text-charcoal-900 shadow-soft hover:bg-accent-400',
    secondary:
      'bg-charcoal-700/70 text-white shadow-insetSoft hover:bg-charcoal-600/80 border border-white/5',
    ghost: 'bg-transparent text-mist-400 hover:text-white'
  };

  return <button className={clsx(base, styles[variant], className)} {...props} />;
};
