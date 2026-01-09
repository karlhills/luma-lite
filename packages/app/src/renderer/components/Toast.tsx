import clsx from 'clsx';

export type ToastProps = {
  message: string;
  tone?: 'error' | 'info';
  onClose?: () => void;
};

export const Toast = ({ message, tone = 'info', onClose }: ToastProps) => (
  <div
    className={clsx(
      'glass soft-depth flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-3 text-sm',
      tone === 'error' ? 'text-amberlite-500' : 'text-mist-400'
    )}
  >
    <span>{message}</span>
    {onClose ? (
      <button className="text-xs uppercase tracking-wide text-mist-400" onClick={onClose}>
        Dismiss
      </button>
    ) : null}
  </div>
);
