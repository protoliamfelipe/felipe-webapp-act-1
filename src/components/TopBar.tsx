import React from 'react';
import { Menu, X, Plus, UserPlus } from 'lucide-react';
import { AppView } from './Sidebar';

interface TopBarProps {
  title: string;
  activeView: AppView;
  onOpenComposer: () => void;
  onOpenNewServer: () => void;
  onOpenAddFriend: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  activeView,
  onOpenComposer,
  onOpenNewServer,
  onOpenAddFriend,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const renderPrimaryAction = () => {
    if (activeView === 'friends') {
      return (
        <button
          type="button"
          onClick={onOpenAddFriend}
          className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Friend</span>
        </button>
      );
    }

    if (activeView === 'server') {
      return (
        <button
          type="button"
          onClick={onOpenNewServer}
          className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Make New Server</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onOpenComposer}
        className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Create Post</span>
      </button>
    );
  };

  return (
    <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-30 transition-colors">
      {/* Zone 1: Context Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1.5 -ml-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white lg:hidden rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 text-sm truncate">
          <span className="font-display font-bold text-zinc-950 dark:text-zinc-50 whitespace-nowrap shrink-0">
            Pilgrim
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

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">{renderPrimaryAction()}</div>
    </header>
  );
};
