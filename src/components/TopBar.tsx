import React from 'react';
import { Search, Plus, Menu, X, ShieldCheck } from 'lucide-react';

interface TopBarProps {
  activeTitle: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenUpload: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTitle,
  searchQuery,
  setSearchQuery,
  onOpenUpload,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Zone 1: Context Title / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 lg:hidden rounded-lg hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 truncate">
          <span className="font-medium text-slate-800 truncate">FeliVault</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span className="text-slate-600 font-normal truncate">{activeTitle}</span>
        </div>
      </div>

      {/* Zone 2: Fast live search filter */}
      <div className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search files by name, project, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-medium">Encrypted Vault</span>
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Files</span>
        </button>
      </div>
    </header>
  );
};
