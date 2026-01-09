import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

export const Slider = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    type="range"
    className={clsx(
      'h-2 w-full cursor-pointer appearance-none rounded-full bg-charcoal-700/80 accent-accent-400',
      className
    )}
    {...props}
  />
);
