import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export const IconButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={clsx(
      'transition-soft inline-flex h-8 w-8 items-center justify-center rounded-full bg-charcoal-700/70 text-mist-400 shadow-insetSoft hover:bg-charcoal-600/80 hover:text-white',
      className
    )}
    {...props}
  />
);
