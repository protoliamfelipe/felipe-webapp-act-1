import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Bell, MessageSquare, Smile, UserPlus, CheckCheck, Trash2, AtSign } from 'lucide-react';
import { AppView } from './Sidebar';
import { AppNotification } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { PilgrimLogo } from './PilgrimLogo';

interface TopBarProps {
  title: string;
  activeView: AppView;
  notifications: AppNotification[];
  onMarkAllNotificationsRead: () => void;
  onClearNotifications: () => void;
  onSelectNotification: (notif: AppNotification) => void;
  onOpenAddFriend: () => void;
  unreadDmCount?: number;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  activeView,
  notifications,
  onMarkAllNotificationsRead,
  onClearNotifications,
  onSelectNotification,
  onOpenAddFriend,
  unreadDmCount = 0,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const renderIcon = (kind: AppNotification['kind']) => {
    if (kind === 'reaction') return <Smile className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />;
    if (kind === 'mention') return <AtSign className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />;
    if (kind === 'friend_request' || kind === 'friend_accept') {
      return <UserPlus className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />;
    }
    return <MessageSquare className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />;
  };

  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8 sticky top-0 z-30 transition-colors">
      {/* Zone 1: Context Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="relative p-2 -ml-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white lg:hidden rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          {!isMobileOpen && unreadDmCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono tabular-nums">
              {unreadDmCount > 99 ? '99+' : unreadDmCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 text-sm truncate">
          <PilgrimLogo className="w-6 h-6 rounded-md" />
          <span className="font-display font-bold text-zinc-950 dark:text-zinc-50 whitespace-nowrap shrink-0">
            ArkLine
          </span>
          <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
            /
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 font-medium truncate">{title}</span>
        </div>
      </div>

      {/* Zone 2: Minimalist Context Subtitle */}
      <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
        <span>Community Servers</span>
        <span aria-hidden="true">·</span>
        <span>Creator Hub</span>
      </div>

      {/* Zone 3: Notification Box & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {activeView === 'friends' && (
          <button
            type="button"
            onClick={onOpenAddFriend}
            className="py-2 px-3 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Friend</span>
          </button>
        )}

        {/* Notification Box Popover */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            title="Notifications & Activity"
            aria-label="Notifications & Activity"
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 relative transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center font-mono tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-950 dark:text-white">
                    Notifications Inbox
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        title="Mark all as read"
                        className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Read all</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClearNotifications}
                      title="Clear notifications"
                      className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-6 h-6 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    No new notifications yet
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Incoming DMs, server messages, reactions, and friend requests appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onSelectNotification(n);
                        setNotifOpen(false);
                      }}
                      className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        n.read
                          ? 'bg-zinc-50/70 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800/70 opacity-80 hover:opacity-100'
                          : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {renderIcon(n.kind)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {n.title}
                          </p>
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {n.body}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

