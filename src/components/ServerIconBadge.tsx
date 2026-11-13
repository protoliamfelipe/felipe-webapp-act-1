import React from 'react';
import { Shield, Crosshair, Swords, Crown, Compass } from 'lucide-react';
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
    size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-11 h-11 text-sm';
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

  const renderIcon = () => {
    const iconCls = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
    switch (server.iconStyle) {
      case 'crosshair':
        return <Crosshair className={iconCls} />;
      case 'sword':
        return <Swords className={iconCls} />;
      case 'shield':
        return <Shield className={iconCls} />;
      case 'crown':
        return <Crown className={iconCls} />;
      case 'compass':
        return <Compass className={iconCls} />;
      default:
        return <span className="font-display font-bold">{getServerMonogram(server.name)}</span>;
    }
  };

  return (
    <div
      className={`${sizeClass} ${radiusClass} flex items-center justify-center transition-all duration-200 border ${
        active
          ? 'bg-white text-zinc-950 border-white shadow-sm'
          : 'bg-zinc-900 text-zinc-200 border-zinc-800 group-hover:bg-zinc-800 group-hover:text-white'
      }`}
    >
      {renderIcon()}
    </div>
  );
};
