import clsx from 'clsx';
import { Star } from 'lucide-react';

export type FavoriteStarButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
};

export const FavoriteStarButton = ({ isFavorite, onToggle }: FavoriteStarButtonProps) => (
  <button
    className={clsx(
      'transition-soft inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10',
      isFavorite
        ? 'bg-accent-500/80 text-charcoal-900'
        : 'bg-charcoal-700/60 text-mist-400 hover:text-white'
    )}
    onClick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
  >
    <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
  </button>
);
