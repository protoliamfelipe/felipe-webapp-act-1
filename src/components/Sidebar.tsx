import React from 'react';
import {
  Shield,
  Files,
  Clock,
  FolderKanban,
  HardDrive,
  LogOut,
  Plus,
  Share2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { User } from '../types';
import { formatBytes } from '../utils/formatters';

interface SidebarProps {
  user: User;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  selectedProject: string;
  setSelectedProject: (proj: string) => void;
  projects: string[];
  totalBytes: number;
  fileCount: number;
  onOpenUpload: () => void;
  onOpenShareModal: () => void;
  onSignOut: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeNav,
  setActiveNav,
  selectedProject,
  setSelectedProject,
  projects,
  totalBytes,
  fileCount,
  onOpenUpload,
  onOpenShareModal,
  onSignOut,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const maxStorageBytes = 1024 * 1024 * 1024; // 1GB quota
  const storagePercent = Math.min(100, Math.round((totalBytes / maxStorageBytes) * 100));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Dark Navy Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0A1128] text-slate-200 flex flex-col border-r border-[#152347] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#162349] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block leading-tight">
                FeliVault
              </span>
              <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                Client File Portal
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Upload Files */}
        <div className="p-4 border-b border-[#162349]">
          <button
            onClick={() => {
              onOpenUpload();
              if (isMobileOpen) setIsMobileOpen(false);
            }}
            className="w-full py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Files</span>
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="px-2 mb-2 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              Workspace
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setActiveNav('files');
                  setSelectedProject('all');
                  if (isMobileOpen) setIsMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'files' && selectedProject === 'all'
                    ? 'bg-blue-600/20 text-blue-400 font-semibold'
                    : 'text-slate-300 hover:bg-[#121E40] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Files className="w-4 h-4 text-slate-400" />
                  <span>All Client Files</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {fileCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveNav('recent');
                  if (isMobileOpen) setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'recent'
                    ? 'bg-blue-600/20 text-blue-400 font-semibold'
                    : 'text-slate-300 hover:bg-[#121E40] hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Recent Uploads</span>
              </button>

              <button
                onClick={() => {
                  onOpenShareModal();
                  if (isMobileOpen) setIsMobileOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-[#121E40] hover:text-white transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-400" />
                <span>Client Access Link</span>
              </button>
            </nav>
          </div>

          {/* Projects / Folders */}
          {projects.length > 0 && (
            <div>
              <div className="px-2 mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                <span>Active Projects</span>
                <span className="font-mono">{projects.length}</span>
              </div>
              <div className="space-y-1">
                {projects.map((proj) => (
                  <button
                    key={proj}
                    onClick={() => {
                      setActiveNav('files');
                      setSelectedProject(proj);
                      if (isMobileOpen) setIsMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors truncate text-left ${
                      selectedProject === proj
                        ? 'bg-blue-600/20 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-[#121E40] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{proj}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Storage Quota Widget */}
          <div className="p-3 bg-[#0e1938] rounded-xl border border-[#1b2b57]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                Storage Used
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                {formatBytes(totalBytes)} / 1 GB
              </span>
            </div>
            <div className="w-full bg-[#1b2b57] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(4, storagePercent)}%` }}
              />
            </div>
            <div className="mt-2.5 pt-2 border-t border-[#1b2b57]/70 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Firebase Cloud
              </span>
              <span>valiant-house-nds98</span>
            </div>
          </div>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-[#162349] bg-[#070D1E] shrink-0 space-y-2">
          <div className="px-2 py-1 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="capitalize text-blue-400">{user.role}</span>
                {user.company && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{user.company}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="w-full py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#121E40] hover:bg-[#1a2b5b] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
