import React, { useState } from 'react';

interface PilgrimLogoProps {
  className?: string;
  invertOnDark?: boolean;
}

const WIKIA_PILGRIM_URL =
  'https://static.wikia.nocookie.net/nikke-goddess-of-victory-international/images/1/12/Pilgrim_logo.png/revision/latest?cb=20230527091902';

export const PilgrimLogo: React.FC<PilgrimLogoProps> = ({ className = 'w-8 h-8', invertOnDark = false }) => {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={WIKIA_PILGRIM_URL}
        alt="Pilgrim Emblem"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-contain shrink-0 ${invertOnDark ? 'brightness-0 invert' : ''}`}
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
