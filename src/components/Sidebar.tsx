import React, { useRef, useState, useEffect } from 'react';
import {
  Compass,
  Flame,
  User as UserIcon,
  Users,
  Plus,
  Search,
  ShieldAlert,
  Settings,
  Home,
  ChevronUp,
  ChevronRight,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Volume2,
  Radio,
} from 'lucide-react';
import { Server, User, UserStatus, VoiceSettings } from '../types';
import { ServerIconBadge } from './ServerIconBadge';
import { StatusBadge } from './StatusBadge';
import { makeInitialsAvatar } from '../utils/avatars';
import { formatKeybindLabel } from '../utils/permissions';

export type AppView = 'startup' | 'feed' | 'profile' | 'friends' | 'server' | 'safety' | 'settings';

export interface ActiveVoiceInfo {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  pttActive: boolean;
}

interface SidebarProps {
  user: User;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  servers: Array<Server & { isMember: boolean; memberCount: number }>;
  serverSearch: string;
  setServerSearch: (q: string) => void;
  selectedServerId: string | null;
  onSelectServer: (serverId: string) => void;
  onJoinServer: (serverId: string) => void;
  onOpenNewServerModal: () => void;
  onOpenMyProfile: () => void;
  onChangeStatus: (status: UserStatus) => void;
  pendingFriendCount: number;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onPttHoldStart: () => void;
  onPttHoldEnd: () => void;
  onLeaveVoice: () => void;
  onOpenVoiceSettings: () => void;
}

const STATUS_OPTIONS: Array<{
  id: UserStatus;
  label: string;
  subtitle?: string;
}> = [
  { id: 'online', label: 'Online' },
  { id: 'idle', label: 'Idle' },
  {
    id: 'dnd',
    label: 'Do Not Disturb',
    subtitle: 'You will not receive desktop notifications',
  },
  {
    id: 'invisible',
    label: 'Invisible',
    subtitle: 'You will appear offline',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeView,
  onNavigate,
  servers,
  serverSearch,
  setServerSearch,
  selectedServerId,
  onSelectServer,
  onJoinServer,
  onOpenNewServerModal,
  onOpenMyProfile,
  onChangeStatus,
  pendingFriendCount,
  isMobileOpen,
  setIsMobileOpen,
  activeVoice,
  voiceSettings,
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onPttHoldStart,
  onPttHoldEnd,
  onLeaveVoice,
  onOpenVoiceSettings,
}) => {
  const joinedServers = servers.filter((s) => s.isMember);
  const discoverableServers = servers.filter((s) => !s.isMember);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        statusContainerRef.current &&
        !statusContainerRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    if (statusMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [statusMenuOpen]);

  const handleNavClick = (view: AppView) => {
    onNavigate(view);
    setIsMobileOpen(false);
  };

  const currentStatus: UserStatus = user.status || 'online';
  const statusLabel =
    STATUS_OPTIONS.find((s) => s.id === currentStatus)?.label || 'Online';

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Dual-Pane Black Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[308px] bg-[#09090b] text-zinc-200 flex border-r border-zinc-800 transition-transform duration-200 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Far-Left Server Icon Rail */}
        <div className="w-[68px] bg-black border-r border-zinc-800/90 flex flex-col items-center py-3 gap-2.5 overflow-y-auto shrink-0">
          {/* Home Icon Rail Button */}
          <div className="relative group flex items-center justify-center w-full">
            {activeView !== 'server' && (
              <span className="absolute left-0 w-1 h-7 bg-white rounded-r-full" />
            )}
            <button
              type="button"
              onClick={() => handleNavClick('startup')}
              title="Home"
              aria-label="Home"
              className={`w-11 h-11 flex items-center justify-center transition-all cursor-pointer border ${
                activeView !== 'server'
                  ? 'rounded-2xl bg-white text-zinc-950 border-white'
                  : 'rounded-3xl bg-zinc-900 text-zinc-200 border-zinc-800 hover:rounded-2xl hover:border-zinc-600 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5" />
            </button>
          </div>

          <div className="w-8 h-px bg-zinc-800 my-0.5 shrink-0" />

          {/* Joined Servers Icon List */}
          {joinedServers.map((srv) => {
            const isActive = activeView === 'server' && selectedServerId === srv.id;
            return (
              <div key={srv.id} className="relative group flex items-center justify-center w-full">
                {isActive && (
                  <span className="absolute left-0 w-1 h-8 bg-white rounded-r-full" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectServer(srv.id);
                    setIsMobileOpen(false);
                  }}
                  title={`${srv.name} (${srv.memberCount} members)`}
                  className="cursor-pointer focus:outline-none"
                >
                  <ServerIconBadge server={srv} active={isActive} size="md" />
                </button>
              </div>
            );
          })}

          {/* Make New Server Icon Button */}
          <button
            type="button"
            onClick={() => {
              onOpenNewServerModal();
              setIsMobileOpen(false);
            }}
            title="Make New Server"
            className="w-11 h-11 rounded-3xl hover:rounded-2xl bg-zinc-900 hover:bg-white text-zinc-200 hover:text-zinc-950 border border-zinc-800 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Find Existing Server Icon Shortcut */}
          <button
            type="button"
            onClick={() => {
              searchInputRef.current?.focus();
            }}
            title="Find Existing Server"
            className="w-11 h-11 rounded-3xl hover:rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Main Black Sidebar Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* App Name "Pilgrim" at Top */}
          <button
            type="button"
            onClick={() => handleNavClick('startup')}
            className="h-16 px-4 flex items-center gap-2.5 border-b border-zinc-800/90 hover:bg-zinc-900/60 transition-colors text-left shrink-0 cursor-pointer"
          >
            <div className="min-w-0">
              <span className="font-display text-xl font-extrabold tracking-tight text-white block leading-none">
                Pilgrim
              </span>
              <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                Community Platform
              </span>
            </div>
          </button>

          {/* Scrollable Navigation + Find Existing Server */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => handleNavClick('startup')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'startup'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Startup & Features</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('feed')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'feed'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4 shrink-0" />
                <span>Community Feed</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenMyProfile();
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'profile'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('friends')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'friends'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Friends & DMs</span>
                </span>
                {pendingFriendCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-950">
                    {pendingFriendCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'settings'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('safety')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeView === 'safety'
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Safety & Reports</span>
              </button>
            </nav>

            {/* Server Search & Make New Server */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-2.5">
              <div className="px-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Find Servers</span>
                <span className="text-[11px] font-mono tabular-nums text-zinc-500">
                  {servers.length}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={serverSearch}
                  onChange={(e) => setServerSearch(e.target.value)}
                  placeholder="Find existing server..."
                  aria-label="Find existing server"
                  className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  onOpenNewServerModal();
                  setIsMobileOpen(false);
                }}
                className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Make New Server</span>
              </button>

              {/* Discoverable / Search Results */}
              {discoverableServers.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="px-1 text-[11px] font-medium text-zinc-500">
                    Discoverable Servers
                  </div>
                  {discoverableServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="flex items-center justify-between px-2 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ServerIconBadge server={srv} size="sm" />
                        <div className="min-w-0">
                          <p className="text-zinc-200 font-medium truncate">{srv.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{srv.category}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onJoinServer(srv.id);
                          setIsMobileOpen(false);
                        }}
                        className="px-2 py-1 bg-white hover:bg-zinc-200 text-zinc-950 text-[11px] font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {serverSearch.trim() && joinedServers.length > 0 && (
                <div className="pt-1 space-y-1">
                  <div className="px-1 text-[11px] font-medium text-zinc-500">
                    Joined Matches
                  </div>
                  {joinedServers.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        onSelectServer(srv.id);
                        setIsMobileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 text-left cursor-pointer"
                    >
                      <ServerIconBadge server={srv} size="sm" />
                      <span className="truncate">{srv.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Voice Connection Dock */}
          {activeVoice && (
            <div className="px-3 py-2.5 border-t border-zinc-800 bg-zinc-950 space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <Radio className="w-3.5 h-3.5 shrink-0" />
                    <span>Voice Connected</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {activeVoice.channelName} · {activeVoice.serverName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLeaveVoice}
                  title="Disconnect from voice"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 text-zinc-300 hover:text-red-400 border border-zinc-800 cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              </div>

              {voiceSettings.inputMode === 'ptt' && (
                <button
                  type="button"
                  onPointerDown={onPttHoldStart}
                  onPointerUp={onPttHoldEnd}
                  onPointerLeave={onPttHoldEnd}
                  onPointerCancel={onPttHoldEnd}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors select-none touch-none cursor-pointer border ${
                    activeVoice.pttActive
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                      : 'bg-zinc-900 text-zinc-100 border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>
                    {activeVoice.pttActive
                      ? 'Talking...'
                      : `Hold to Talk (${formatKeybindLabel(voiceSettings.pttKey)})`}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleVoiceMute}
                  title={activeVoice.muted ? 'Unmute Mic' : 'Mute Mic'}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border cursor-pointer ${
                    activeVoice.muted
                      ? 'bg-red-950/60 text-red-300 border-red-900'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {activeVoice.muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{activeVoice.muted ? 'Muted' : 'Mic'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleVoiceDeafen}
                  title={activeVoice.deafened ? 'Undeafen' : 'Deafen'}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border cursor-pointer ${
                    activeVoice.deafened
                      ? 'bg-red-950/60 text-red-300 border-red-900'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {activeVoice.deafened ? <Volume2 className="w-3.5 h-3.5 opacity-50" /> : <Headphones className="w-3.5 h-3.5" />}
                  <span>{activeVoice.deafened ? 'Deaf' : 'Audio'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenVoiceSettings}
                  title="Voice Settings"
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Username & Presence Status Footer (Click to choose Online/Idle/DND/Invisible) */}
          <div ref={statusContainerRef} className="p-3 border-t border-zinc-800 bg-black shrink-0 relative">
            {statusMenuOpen && (
              <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-2 border-b border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMenuOpen(false);
                      onOpenMyProfile();
                      setIsMobileOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-zinc-800 flex items-center justify-between text-xs font-semibold text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Open My Profile</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </button>
                </div>

                <div className="p-2 space-y-0.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const selected = currentStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onChangeStatus(opt.id);
                          setStatusMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          selected ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800/70 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-1 shrink-0">
                            <StatusBadge status={opt.id} size="sm" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                            {opt.subtitle && (
                              <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                                {opt.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                        {opt.id !== 'online' && (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStatusMenuOpen((v) => !v)}
              aria-expanded={statusMenuOpen}
              title="Click to change status"
              className="w-full p-2 rounded-xl hover:bg-zinc-900 transition-colors flex items-center gap-2.5 text-left cursor-pointer"
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = makeInitialsAvatar(user.name);
                  }}
                  className="w-9 h-9 rounded-full object-cover border border-zinc-700"
                />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusBadge status={currentStatus} size="sm" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {statusLabel} · <span className="font-mono">{user.tag}</span>
                </p>
              </div>
              <ChevronUp
                className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${
                  statusMenuOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
