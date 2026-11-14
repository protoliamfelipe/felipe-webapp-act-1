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
  ChevronDown,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Volume2,
  Radio,
  Hash,
  ArrowLeft,
  X,
  MonitorUp,
  MonitorOff,
} from 'lucide-react';
import {
  Channel,
  Server,
  User,
  UserStatus,
  VoiceParticipant,
  VoiceSettings,
} from '../types';
import { ServerIconBadge } from './ServerIconBadge';
import { StatusBadge } from './StatusBadge';
import { PilgrimLogo } from './PilgrimLogo';
import { makeInitialsAvatar } from '../utils/avatars';
import { formatKeybindLabel, getEffectiveStatus, hasServerPermission } from '../utils/permissions';

export type AppView =
  | 'startup'
  | 'feed'
  | 'profile'
  | 'friends'
  | 'discover'
  | 'server'
  | 'safety'
  | 'settings';

export interface ActiveVoiceInfo {
  serverId: string;
  serverName: string;
  channelId: string;
  channelName: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  pttActive: boolean;
  isStreaming?: boolean;
  streamTitle?: string;
}

interface SidebarProps {
  user: User;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  servers: Array<Server & { isMember: boolean; memberCount: number }>;
  selectedServerId: string | null;
  selectedChannelId: string | null;
  onSelectChannelId: (channelId: string) => void;
  onSelectServer: (serverId: string) => void;
  onJoinVoiceChannel: (server: Server, channel: Channel) => void;
  voiceParticipants: VoiceParticipant[];
  onOpenNewServerModal: () => void;
  onOpenMyProfile: () => void;
  onChangeStatus: (status: UserStatus) => void;
  pendingFriendCount: number;
  friends: User[];
  onlineUserIds: string[];
  activeDmFriendId: string | null;
  dmPopupFriendIds: string[];
  unreadDmByFriendId: Record<string, number>;
  onSelectDmPopup: (friendId: string) => void;
  onDismissDmPopup: (friendId: string) => void;
  streamingUserIds?: Set<string>;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onToggleVoiceStream: () => void;
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
  selectedServerId,
  selectedChannelId,
  onSelectChannelId,
  onSelectServer,
  onJoinVoiceChannel,
  voiceParticipants,
  onOpenNewServerModal,
  onOpenMyProfile,
  onChangeStatus,
  pendingFriendCount,
  friends,
  onlineUserIds,
  activeDmFriendId,
  dmPopupFriendIds,
  unreadDmByFriendId,
  onSelectDmPopup,
  onDismissDmPopup,
  streamingUserIds,
  isMobileOpen,
  setIsMobileOpen,
  activeVoice,
  voiceSettings,
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onToggleVoiceStream,
  onPttHoldStart,
  onPttHoldEnd,
  onLeaveVoice,
  onOpenVoiceSettings,
}) => {
  const joinedServers = servers.filter((s) => s.isMember);
  const activeServer = servers.find((s) => s.id === selectedServerId) || null;
  const [dmSearch, setDmSearch] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [mobileShowHomeNav, setMobileShowHomeNav] = useState(false);
  const [collapsedMobileCats, setCollapsedMobileCats] = useState<Record<string, boolean>>({});
  const statusContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeView !== 'server') {
      setMobileShowHomeNav(false);
    }
  }, [activeView, selectedServerId]);

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

  const totalUnreadDms = Object.values(unreadDmByFriendId).reduce((sum, count) => sum + count, 0);
  const friendsBadgeCount = pendingFriendCount + totalUnreadDms;

  const dmPopupFriends = dmPopupFriendIds
    .map((fid) => friends.find((f) => f.id === fid))
    .filter((f): f is User => Boolean(f));

  const filteredDmFriends = friends.filter((f) => {
    const q = dmSearch.trim().toLowerCase();
    if (!q) return true;
    return f.name.toLowerCase().includes(q) || f.tag.toLowerCase().includes(q);
  });

  // Sort DM friends: unread first, then live streaming, then online
  const sortedDmFriends = [...filteredDmFriends].sort((a, b) => {
    const ua = unreadDmByFriendId[a.id] || 0;
    const ub = unreadDmByFriendId[b.id] || 0;
    if (ua !== ub) return ub - ua;
    const sa = a.isStreaming || streamingUserIds?.has(a.id) ? 1 : 0;
    const sb = b.isStreaming || streamingUserIds?.has(b.id) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return a.name.localeCompare(b.name);
  });

  const showMobileServerDrawer =
    activeView === 'server' && Boolean(activeServer) && !mobileShowHomeNav;
  const collapseMiddleOnDesktop = activeView === 'server' && Boolean(activeServer);
  const isMeStreaming = Boolean(user.isStreaming || streamingUserIds?.has(user.id));

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Dual-Pane Black Sidebar (Middle column collapses on desktop when viewing a server) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[308px] ${
          collapseMiddleOnDesktop ? 'lg:w-[68px]' : ''
        } bg-[#09090b] text-zinc-200 flex border-r border-zinc-800 transition-all duration-200 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Far-Left Server & DM Popup Rail */}
        <div className="w-[68px] bg-black border-r border-zinc-800/90 flex flex-col items-center py-3 gap-2.5 overflow-y-auto shrink-0">
          {/* Home Icon Rail Button */}
          <div className="relative group flex items-center justify-center w-full">
            {activeView !== 'server' && activeView !== 'discover' && (
              <span className="absolute left-0 w-1 h-7 bg-white rounded-r-full" />
            )}
            <button
              type="button"
              onClick={() => {
                setMobileShowHomeNav(true);
                handleNavClick('startup');
              }}
              title="Home"
              aria-label="Home"
              className={`w-11 h-11 flex items-center justify-center transition-all cursor-pointer border relative ${
                activeView !== 'server' && activeView !== 'discover'
                  ? 'rounded-2xl bg-white text-zinc-950 border-white'
                  : 'rounded-3xl bg-zinc-900 text-zinc-200 border-zinc-800 hover:rounded-2xl hover:border-zinc-600 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5" />
              {friendsBadgeCount > 0 && (
                <span className="lg:hidden absolute -bottom-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center font-mono tabular-nums">
                  {friendsBadgeCount > 99 ? '99+' : friendsBadgeCount}
                </span>
              )}
            </button>
          </div>

          {/* Incoming Friend DM Popups (Discord style) */}
          {dmPopupFriends.length > 0 && (
            <div className="w-full flex flex-col items-center gap-2 pt-0.5">
              {dmPopupFriends.map((friend) => {
                const unread = unreadDmByFriendId[friend.id] || 0;
                const isFriendStreaming = Boolean(
                  friend.isStreaming || streamingUserIds?.has(friend.id)
                );
                return (
                  <div
                    key={friend.id}
                    className="relative group flex items-center justify-center w-full"
                  >
                    <span className="absolute left-0 w-1 h-5 bg-red-500 rounded-r-full" />
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDmPopup(friend.id);
                        setIsMobileOpen(false);
                      }}
                      title={`Direct Message from ${friend.name}`}
                      className={`relative w-11 h-11 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer bg-zinc-900 ${
                        isFriendStreaming
                          ? 'border-red-500 ring-2 ring-red-500/60'
                          : 'border-zinc-700 hover:border-white'
                      }`}
                    >
                      <img
                        src={friend.avatarUrl}
                        alt={friend.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = makeInitialsAvatar(friend.name);
                        }}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    {unread > 0 && (
                      <span className="absolute -bottom-0.5 right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 border-2 border-black text-white text-[10px] font-bold flex items-center justify-center font-mono tabular-nums pointer-events-none">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissDmPopup(friend.id);
                      }}
                      aria-label={`Dismiss ${friend.name} DM popup`}
                      className="opacity-0 group-hover:opacity-100 absolute -top-1 right-2 w-4 h-4 rounded-full bg-zinc-800 hover:bg-red-600 text-white flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

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
                    setMobileShowHomeNav(false);
                    onSelectServer(srv.id);
                    if (window.innerWidth >= 1024) {
                      setIsMobileOpen(false);
                    }
                  }}
                  title={`${srv.name} (${srv.memberCount} members)`}
                  className="cursor-pointer focus:outline-none"
                >
                  <ServerIconBadge server={srv} active={isActive} size="md" />
                </button>
              </div>
            );
          })}

          {/* Make / Join Server Icon Button */}
          <button
            type="button"
            onClick={() => {
              onOpenNewServerModal();
              setIsMobileOpen(false);
            }}
            title="Create or Join Server"
            className="w-11 h-11 rounded-3xl hover:rounded-2xl bg-zinc-900 hover:bg-white text-zinc-200 hover:text-zinc-950 border border-zinc-800 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Explore Discoverable Servers (Compass at bottom of rail like Discord) */}
          <div className="relative group flex items-center justify-center w-full">
            {activeView === 'discover' && (
              <span className="absolute left-0 w-1 h-8 bg-white rounded-r-full" />
            )}
            <button
              type="button"
              onClick={() => {
                setMobileShowHomeNav(true);
                handleNavClick('discover');
              }}
              title="Discover Servers"
              aria-label="Discover Servers"
              className={`w-11 h-11 flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 border ${
                activeView === 'discover'
                  ? 'rounded-2xl bg-emerald-500 text-zinc-950 border-emerald-400'
                  : 'rounded-3xl hover:rounded-2xl bg-zinc-900 hover:bg-emerald-500 text-zinc-300 hover:text-zinc-950 border-zinc-800'
              }`}
            >
              <Compass className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Black Sidebar Panel (Collapses on Desktop when a server is active) */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            collapseMiddleOnDesktop ? 'lg:hidden' : ''
          }`}
        >
          {/* App Name Header */}
          {showMobileServerDrawer && activeServer ? (
            <div className="lg:hidden border-b border-zinc-800/90 shrink-0">
              {activeServer.bannerUrl && (
                <div className="h-24 w-full relative overflow-hidden bg-black">
                  <img
                    src={activeServer.bannerUrl}
                    alt={`${activeServer.name} banner`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
              )}
              <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-white truncate">
                    {activeServer.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {activeServer.memberCount} members
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileShowHomeNav(true)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Menu</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleNavClick('startup')}
              className="h-16 px-4 flex items-center gap-2.5 border-b border-zinc-800/90 hover:bg-zinc-900/60 transition-colors text-left shrink-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center p-1 shrink-0">
                <PilgrimLogo className="w-full h-full" invertOnDark />
              </div>
              <div className="min-w-0">
                <span className="font-display text-xl font-extrabold tracking-tight text-white block leading-none">
                  Pilgrim
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                  Community Platform
                </span>
              </div>
            </button>
          )}

          {/* Mobile Server Channel Drawer Content when viewing a Server on < lg */}
          {showMobileServerDrawer && activeServer ? (
            <div className="lg:hidden flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {(() => {
                const cats = activeServer.categories || [];
                const validCatIds = new Set(cats.map((c) => c.id));
                const uncategorized = activeServer.channels.filter(
                  (c) => !c.categoryId || !validCatIds.has(c.categoryId)
                );
                const canConnect = hasServerPermission(activeServer, user.id, 'connectVoice');

                const renderCh = (ch: Channel) => {
                  const isVoice = ch.type === 'voice';
                  const active = ch.id === selectedChannelId;
                  const roomUsers = isVoice
                    ? voiceParticipants.filter((p) => p.channelId === ch.id)
                    : [];

                  return (
                    <div key={ch.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectChannelId(ch.id);
                          if (isVoice && canConnect) {
                            onJoinVoiceChannel(activeServer, ch);
                          }
                          setIsMobileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-xs transition-colors cursor-pointer ${
                          active
                            ? 'bg-white text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {isVoice ? (
                            <Volume2 className="w-4 h-4 shrink-0" />
                          ) : (
                            <Hash className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{ch.name}</span>
                        </span>
                        {isVoice && roomUsers.length > 0 && (
                          <span className="text-[10px] font-mono opacity-75">
                            {roomUsers.length}
                          </span>
                        )}
                      </button>
                      {isVoice && roomUsers.length > 0 && (
                        <div className="pl-6 space-y-1">
                          {roomUsers.map((p) => {
                            const pStreaming = Boolean(
                              p.isStreaming || streamingUserIds?.has(p.userId)
                            );
                            return (
                              <div
                                key={p.userId}
                                className="flex items-center gap-2 px-2 py-1 text-[11px] text-zinc-300"
                              >
                                <img
                                  src={p.userAvatar}
                                  alt={p.userName}
                                  className={`w-5 h-5 rounded-full object-cover ${
                                    pStreaming
                                      ? 'ring-2 ring-red-500'
                                      : p.speaking && !p.muted
                                      ? 'ring-2 ring-emerald-500'
                                      : ''
                                  }`}
                                />
                                <span className="truncate flex-1">{p.userName}</span>
                                {pStreaming && (
                                  <span className="px-1 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">
                                    LIVE
                                  </span>
                                )}
                                {p.muted && <MicOff className="w-3 h-3 text-red-400" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {uncategorized.length > 0 && (
                      <div className="space-y-1">{uncategorized.map(renderCh)}</div>
                    )}
                    {cats.map((cat) => {
                      const collapsed = Boolean(collapsedMobileCats[cat.id]);
                      const chs = activeServer.channels.filter((c) => c.categoryId === cat.id);
                      return (
                        <div key={cat.id} className="space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedMobileCats((prev) => ({
                                ...prev,
                                [cat.id]: !prev[cat.id],
                              }))
                            }
                            className="w-full flex items-center gap-1 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white cursor-pointer"
                          >
                            {collapsed ? (
                              <ChevronRight className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                            <span className="truncate">{cat.name}</span>
                          </button>
                          {!collapsed && <div className="space-y-1">{chs.map(renderCh)}</div>}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : (
            /* Default Pilgrim Navigation + Discord-style Direct Messages List */
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
              {activeView === 'server' && activeServer && (
                <button
                  type="button"
                  onClick={() => setMobileShowHomeNav(false)}
                  className="lg:hidden w-full py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-white flex items-center justify-between cursor-pointer"
                >
                  <span>Back to {activeServer.name} Channels</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

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
                  <Home className="w-4 h-4 shrink-0" />
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
                    activeView === 'friends' && !activeDmFriendId
                      ? 'bg-white text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Friends</span>
                  </span>
                  {friendsBadgeCount > 0 && (
                    <span className="font-mono tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                      {friendsBadgeCount > 99 ? '99+' : friendsBadgeCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleNavClick('discover')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    activeView === 'discover'
                      ? 'bg-white text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Discover Servers</span>
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

              {/* Discord-style Direct Messages List */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-2">
                <div className="px-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Direct Messages
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNavClick('friends')}
                    title="Find or Add Friends"
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {friends.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={dmSearch}
                      onChange={(e) => setDmSearch(e.target.value)}
                      placeholder="Find a conversation..."
                      aria-label="Find a direct message conversation"
                      className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                    />
                  </div>
                )}

                {sortedDmFriends.length === 0 ? (
                  <div className="px-2 py-4 text-center rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                    <p className="text-[11px] text-zinc-400">
                      {friends.length === 0
                        ? 'No direct messages yet.'
                        : 'No friends match your search.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavClick('friends')}
                      className="mt-2 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-white cursor-pointer"
                    >
                      Add Friends
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sortedDmFriends.map((friend) => {
                      const unread = unreadDmByFriendId[friend.id] || 0;
                      const isSelectedDm =
                        activeView === 'friends' && activeDmFriendId === friend.id;
                      const effStatus = getEffectiveStatus(friend, onlineUserIds, user.id);
                      const isFriendStreaming = Boolean(
                        friend.isStreaming || streamingUserIds?.has(friend.id)
                      );

                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => {
                            onSelectDmPopup(friend.id);
                            setIsMobileOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer group ${
                            isSelectedDm
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={friend.avatarUrl}
                                alt={friend.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = makeInitialsAvatar(friend.name);
                                }}
                                className={`w-8 h-8 rounded-full object-cover ${
                                  isFriendStreaming
                                    ? 'ring-2 ring-red-500 border border-zinc-950'
                                    : 'border border-zinc-700'
                                }`}
                              />
                              <span className="absolute -bottom-0.5 -right-0.5">
                                <StatusBadge status={effStatus} size="sm" />
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p
                                className={`text-xs truncate ${
                                  unread > 0 || isSelectedDm ? 'font-bold text-white' : 'font-medium'
                                }`}
                              >
                                {friend.name}
                              </p>
                              {isFriendStreaming ? (
                                <p className="text-[10px] font-semibold text-red-400 truncate flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                  <span className="truncate">
                                    {friend.streamTitle || 'Streaming Live'}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-[10px] text-zinc-500 truncate">
                                  {effStatus === 'dnd'
                                    ? 'Do Not Disturb'
                                    : effStatus.charAt(0).toUpperCase() + effStatus.slice(1)}
                                </p>
                              )}
                            </div>
                          </div>

                          {unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center font-mono tabular-nums shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
                  {activeVoice.muted ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
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
                  {activeVoice.deafened ? (
                    <Volume2 className="w-3.5 h-3.5 opacity-50" />
                  ) : (
                    <Headphones className="w-3.5 h-3.5" />
                  )}
                  <span>{activeVoice.deafened ? 'Deaf' : 'Audio'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleVoiceStream}
                  title={activeVoice.isStreaming ? 'Stop Live Stream' : 'Share Screen / Go Live'}
                  className={`p-1.5 rounded-lg border cursor-pointer ${
                    activeVoice.isStreaming
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                  }`}
                >
                  {activeVoice.isStreaming ? (
                    <MonitorOff className="w-3.5 h-3.5" />
                  ) : (
                    <MonitorUp className="w-3.5 h-3.5" />
                  )}
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

          {/* Username & Presence Status Footer + Right-Side Gear Icon (No "Settings" text) */}
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

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatusMenuOpen((v) => !v)}
                aria-expanded={statusMenuOpen}
                title="Click to change status"
                className="flex-1 p-2 rounded-xl hover:bg-zinc-900 transition-colors flex items-center gap-2.5 text-left cursor-pointer min-w-0"
              >
                <div className="relative shrink-0">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = makeInitialsAvatar(user.name);
                    }}
                    className={`w-9 h-9 rounded-full object-cover ${
                      isMeStreaming
                        ? 'ring-2 ring-red-500 border border-black'
                        : 'border border-zinc-700'
                    }`}
                  />
                  {isMeStreaming ? (
                    <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-red-600 text-white text-[8px] font-extrabold border border-black">
                      LIVE
                    </span>
                  ) : (
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusBadge status={currentStatus} size="sm" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {isMeStreaming ? (
                      <span className="text-red-400 font-semibold">Live Streaming</span>
                    ) : (
                      <>
                        {statusLabel} · <span className="font-mono">{user.tag}</span>
                      </>
                    )}
                  </p>
                </div>
                <ChevronUp
                  className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${
                    statusMenuOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                title="User Settings"
                aria-label="User Settings"
                className="p-2.5 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
