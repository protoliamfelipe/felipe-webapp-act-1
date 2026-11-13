import React, { useState } from 'react';

interface PilgrimLogoProps {
  className?: string;
  invertOnDark?: boolean;
}

const PILGRIM_LOGO_URL = '/assets/pilgrim-logo.webp';

export const PilgrimLogo: React.FC<PilgrimLogoProps> = ({ className = 'w-8 h-8', invertOnDark = false }) => {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={PILGRIM_LOGO_URL}
        alt="Pilgrim Emblem"
        onError={() => setFailed(true)}
        className={`${className} object-contain shrink-0 ${invertOnDark ? 'mix-blend-screen' : 'brightness-0 invert mix-blend-multiply'}`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} shrink-0`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pilgrim Emblem"
    >
      <path
        d="M32 8L50 20L43 48L32 56L21 48L14 20L32 8Z"
        stroke={invertOnDark ? '#FFFFFF' : '#09090B'}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 25L32 17L42 25L32 43L22 25Z"
        fill={invertOnDark ? '#E4E4E7' : '#27272A'}
      />
    </svg>
  );
};
