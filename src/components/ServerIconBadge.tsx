import React from 'react';
import { Server } from '../types';
import { getServerMonogram } from '../utils/avatars';

interface ServerIconBadgeProps {
  server: Pick<Server, 'name' | 'iconUrl' | 'iconStyle'>;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ServerIconBadge: React.FC<ServerIconBadgeProps> = ({
  server,
  active = false,
  size = 'md',
}) => {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-11 h-11 text-base';
  const radiusClass = active ? 'rounded-2xl' : 'rounded-3xl group-hover:rounded-2xl';

  if (server.iconUrl) {
    return (
      <img
        src={server.iconUrl}
        alt={server.name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} ${radiusClass} object-cover transition-all duration-200 border ${
          active ? 'border-white' : 'border-zinc-700'
        }`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${radiusClass} flex items-center justify-center transition-all duration-200 border select-none ${
        active
          ? 'bg-white text-zinc-950 border-white shadow-sm'
          : 'bg-zinc-900 text-zinc-100 border-zinc-800 group-hover:bg-zinc-800 group-hover:text-white'
      }`}
    >
      <span className="font-display font-bold">{getServerMonogram(server.name)}</span>
    </div>
  );
};
