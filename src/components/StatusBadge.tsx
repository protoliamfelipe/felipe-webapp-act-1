import React from 'react';
import { UserStatus } from '../types';

interface StatusBadgeProps {
  status?: UserStatus | 'offline';
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'online',
  size = 'sm',
  className = '',
}) => {
  const dim = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  if (status === 'online') {
    return (
      <span
        title="Online"
        className={`inline-block rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 ${dim} ${className}`}
      />
    );
  }

  if (status === 'idle') {
    return (
      <span
        title="Idle"
        className={`inline-flex items-center justify-center rounded-full bg-zinc-950 border-2 border-white dark:border-zinc-950 ${dim} ${className}`}
      >
        <svg viewBox="0 0 12 12" className="w-full h-full">
          <path
            d="M8.8 7.7A3.9 3.9 0 0 1 4.3 3.2c0-.5.1-.9.3-1.3A4.2 4.2 0 1 0 10.1 7.4c-.4.2-.8.3-1.3.3Z"
            fill="#f59e0b"
          />
        </svg>
      </span>
    );
  }

  if (status === 'dnd') {
    return (
      <span
        title="Do Not Disturb"
        className={`inline-flex items-center justify-center rounded-full bg-red-500 border-2 border-white dark:border-zinc-950 ${dim} ${className}`}
      >
        <span className="w-1.5 h-[2px] bg-zinc-950 rounded-full block" />
      </span>
    );
  }

  // invisible or offline -> gray hollow ring
  return (
    <span
      title={status === 'invisible' ? 'Invisible' : 'Offline'}
      className={`inline-flex items-center justify-center rounded-full bg-zinc-500 border-2 border-white dark:border-zinc-950 ${dim} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 block" />
    </span>
  );
};
