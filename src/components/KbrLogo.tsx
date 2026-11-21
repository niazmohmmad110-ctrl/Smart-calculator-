import React from 'react';

interface KbrLogoProps {
  size?: number;
  className?: string;
}

export const KbrLogo: React.FC<KbrLogoProps> = ({ size = 36, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="KBR Tech Logo"
    >
      <defs>
        <linearGradient id="kbrObsidian" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1B1B21" />
          <stop offset="100%" stopColor="#070709" />
        </linearGradient>
        <linearGradient id="kbrGold" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FCE38A" />
          <stop offset="50%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9A7618" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#kbrObsidian)" />
      <rect
        x="2.5"
        y="2.5"
        width="59"
        height="59"
        rx="13.5"
        stroke="url(#kbrGold)"
        strokeWidth="1.5"
        strokeOpacity="0.65"
      />
      <path
        d="M20 18H44L37.5 25H29L36 32L29 39H38L44.5 46H20L31 32L20 18Z"
        fill="url(#kbrGold)"
      />
      <circle cx="45" cy="18" r="2" fill="#FCE38A" />
      <circle cx="45" cy="46" r="2" fill="#D4AF37" />
    </svg>
  );
};
