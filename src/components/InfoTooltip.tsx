import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export const DRIVER_PHONE_INFO =
  'This number will be used to send a notification to the driver about your review to ensure mutual agreement.';

interface Props {
  text?: string;
  className?: string;
}

export function InfoTooltip({ text = DRIVER_PHONE_INFO, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span className={`relative inline-flex ${className}`} ref={ref}>
      <button
        type="button"
        className="p-0.5 rounded-full text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
        aria-label="More information"
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-64 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg animate-fade-in"
        >
          {text}
        </span>
      )}
    </span>
  );
}
