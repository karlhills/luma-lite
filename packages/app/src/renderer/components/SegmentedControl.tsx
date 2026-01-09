import clsx from 'clsx';

export type SegmentedOption = {
  id: string;
  label: string;
};

export type SegmentedControlProps = {
  value: string;
  options: SegmentedOption[];
  onChange: (id: string) => void;
};

export const SegmentedControl = ({ value, options, onChange }: SegmentedControlProps) => (
  <div className="flex rounded-2xl border border-white/10 bg-charcoal-700/60 p-1">
    {options.map((option) => {
      const isActive = option.id === value;
      return (
        <button
          key={option.id}
          className={clsx(
            'transition-soft flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold',
            isActive ? 'bg-accent-500/80 text-charcoal-900' : 'text-mist-400 hover:text-white'
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
