import React from 'react';

interface PilgrimLogoProps {
  className?: string;
  invertOnDark?: boolean;
}

/**
 * Pilgrim official geometric emblem matching Pilgrim Image.png:
 * Angular twin-peak chevron crest tapering to twin downward blades with a central visor cutout.
 */
const PILGRIM_EMBLEM_PATH =
  // Outer silhouette
  'M50 18.2 L75.4 43.8 L53.6 81.5 L53.6 62.2 L57.4 55.3 L50 48.0 L42.6 55.3 L46.4 62.2 L46.4 81.5 L24.6 43.8 Z ' +
  // Inner upper chevron cutout (evenodd negative space)
  'M50 29.5 L35.8 43.7 L38.6 48.5 L50 37.1 L61.4 48.5 L64.2 43.7 Z';

export const PilgrimLogo: React.FC<PilgrimLogoProps> = ({
  className = 'w-8 h-8',
  invertOnDark = false,
}) => {
  if (invertOnDark) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`${className} shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Pilgrim Emblem"
      >
        <path
          d={PILGRIM_EMBLEM_PATH}
          fill="#FFFFFF"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} shrink-0`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pilgrim Emblem"
    >
      <rect width="100" height="100" rx="22" fill="#09090B" />
      <path
        d={PILGRIM_EMBLEM_PATH}
        fill="#FFFFFF"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
};
