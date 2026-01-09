import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx('glass bg-surface soft-depth rounded-2xl p-4 shadow-softGlow', className)}
    {...props}
  />
);
