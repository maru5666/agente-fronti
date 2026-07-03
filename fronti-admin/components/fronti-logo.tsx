type FrontiLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  compact?: boolean;
};

export function FrontiMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Isotipo Fronti AI"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="18" fill="#05060A" />
      <rect x="1" y="1" width="62" height="62" rx="17" stroke="url(#fronti-border)" strokeOpacity="0.9" />
      <path d="M18 17h30l-5.8 8.2H26.8V32H39l-5.5 7.8h-6.7V48H18V17Z" fill="url(#fronti-core)" />
      <path d="M41.5 32.2 48 26v21.5h-6.5V32.2Z" fill="#8B5CF6" fillOpacity="0.88" />
      <path d="M30.2 47.8 48 47.5l-6.6-7.7h-7.1l-4.1 8Z" fill="#22D3EE" fillOpacity="0.95" />
      <path d="M20.5 17.5h25.8" stroke="#F8FAFC" strokeOpacity="0.72" strokeWidth="1.2" strokeLinecap="round" />
      <defs>
        <linearGradient id="fronti-core" x1="16" y1="16" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="0.52" stopColor="#E9D5FF" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="fronti-border" x1="8" y1="5" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" stopOpacity="0.36" />
          <stop offset="0.45" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FrontiLogo({
  className = '',
  markClassName = 'h-12 w-12',
  showWordmark = true,
  compact = false,
}: FrontiLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <FrontiMark className={`${markClassName} drop-shadow-[0_18px_42px_rgba(139,92,246,0.26)]`} />
      {showWordmark ? (
        <div className={compact ? 'hidden' : ''}>
          <p className="text-sm font-semibold tracking-[0.32em] text-ink">FRONTI</p>
          <p className="text-xs font-medium text-muted">Business AI OS</p>
        </div>
      ) : null}
    </div>
  );
}
