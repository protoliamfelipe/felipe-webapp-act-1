import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Volume2,
  Plus,
  Users,
  Check,
  Pin,
  Bookmark,
  MicOff,
  X,
  ChevronDown,
  ChevronRight,
  Settings,
  Link2,
  FolderPlus,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  ChevronUp,
  User as UserIcon,
  Radio,
  Mic,
  Headphones,
  PhoneOff,
  MonitorUp,
  MonitorOff,
} from 'lucide-react';
import {
  Server,
  ChatMessage,
  User,
  UserStatus,
  Channel,
  VoiceParticipant,
  VoiceSettings,
  FriendsOverview,
} from '../types';
import { api } from '../services/api';
import { makeInitialsAvatar } from '../utils/avatars';
import {
  getEffectiveStatus,
  getMemberRoles,
  hasServerPermission,
} from '../utils/permissions';
import { ServerIconBadge } from './ServerIconBadge';
import { StatusBadge } from './StatusBadge';
import { MessageItem } from './MessageItem';
import { ChatComposer } from './ChatComposer';
import { VoiceChannelStage } from './VoiceChannelStage';
import { ServerSettingsModal, ServerSettingsTab } from './ServerSettingsModal';
import { InviteModal } from './InviteModal';
import { MemberProfilePopover } from './MemberProfilePopover';
import { ActiveVoiceInfo } from './Sidebar';

interface ServerWorkspaceProps {
  server: Server & { isMember: boolean; memberCount: number };
  currentUser: User;
  friendsData: FriendsOverview;
  onlineUserIds: string[];
  streamingUserIds?: Set<string>;
  selectedChannelId?: string | null;
  onSelectChannelId?: (channelId: string) => void;
  pingsByChannelId?: Record<string, number>;
  incomingWsMessage: ChatMessage | null;
  incomingWsUpdatedMessage: ChatMessage | null;
  incomingWsDeletedMessageId: string | null;
  voiceParticipants: VoiceParticipant[];
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  localVideoStream: MediaStream | null;
  remoteVideoStreams: Record<string, MediaStream>;
  isMobileMembersOpen?: boolean;
  setIsMobileMembersOpen?: (open: boolean) => void;
  onOpenMobileDrawer?: () => void;
  onJoinVoiceChannel: (server: Server, channel: Channel) => void;
  onLeaveVoice: () => void;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onStartVoiceStream: () => void;
  onStopVoiceStream: () => void;
  onPttHoldStart: () => void;
  onPttHoldEnd: () => void;
  onSwitchVoiceInputMode: (mode: 'vad' | 'ptt') => void;
  onOpenVoiceSettings: () => void;
  onOpenUserSettings: () => void;
  onChangeStatus: (status: UserStatus) => void;
  onServerUpdated: (srv: Server) => void;
  onOpenProfile: (userId: string) => void;
  onStartDm: (friendId: string) => void;
  onSendInviteDm: (friendId: string, inviteUrl: string, serverName: string) => Promise<void>;
  onForwardMessage: (msg: ChatMessage) => void;
  onCreateReminder: (msg: ChatMessage, minutes: number) => void;
  onSpeakMessage: (msg: ChatMessage) => void;
  onNotify: (msg: string) => void;
  onReport: (target: {
    targetType: 'message' | 'user';
    targetId: string;
    targetUserId: string;
    targetUserName: string;
  }) => void;
  onAddFriend: (tag: string) => Promise<void>;
}

export const ServerWorkspace: React.FC<ServerWorkspaceProps> = ({
  server,
  currentUser,
  friendsData,
  onlineUserIds,
  streamingUserIds,
  selectedChannelId: controlledChannelId,
  onSelectChannelId,
  pingsByChannelId = {},
  incomingWsMessage,
  incomingWsUpdatedMessage,
  incomingWsDeletedMessageId,
  voiceParticipants,
  activeVoice,
  voiceSettings,
  localVideoStream,
  remoteVideoStreams,
  isMobileMembersOpen = false,
  setIsMobileMembersOpen,
  onOpenMobileDrawer,
  onJoinVoiceChannel,
  onLeaveVoice,
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onStartVoiceStream,
  onStopVoiceStream,
  onPttHoldStart,
  onPttHoldEnd,
  onSwitchVoiceInputMode,
  onOpenVoiceSettings,
  onOpenUserSettings,
  onChangeStatus,
  onServerUpdated,
  onOpenProfile,
  onStartDm,
  onSendInviteDm,
  onForwardMessage,
  onCreateReminder,
  onSpeakMessage,
  onNotify,
  onReport,
  onAddFriend,
}) => {
  const [internalChannelId, setInternalChannelId] = useState<string>(
    server.channels.find((c) => c.type !== 'voice')?.id || server.channels[0]?.id || ''
  );
  const effectiveSelectedId = controlledChannelId ?? internalChannelId;
  const setSelectedChannelId = (id: string) => {
    setInternalChannelId(id);
    onSelectChannelId?.(id);
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Members sidebar toggle + mobile drawer
  const [showMembers, setShowMembers] = useState(true);

  // Server dropdown, settings, invite, and member card state
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverSettingsTab, setServerSettingsTab] = useState<ServerSettingsTab>('overview');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedMemberCard, setSelectedMemberCard] = useState<User | null>(null);

  // Categories & inline channel/category creation state
  const [collapsedCatIds, setCollapsedCatIds] = useState<Record<string, boolean>>({});
  const [creatingCatOpen, setCreatingCatOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingChannelTarget, setAddingChannelTarget] = useState<{
    type: 'text' | 'voice';
    categoryId?: string;
  } | null>(null);
  const [newChannelName, setNewChannelName] = useState('');

  // Message interactions state
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [unreadMarkerMessageId, setUnreadMarkerMessageId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'none' | 'pinned' | 'bookmarks'>('none');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const statusFooterRef = useRef<HTMLDivElement>(null);

  // Permissions for current user in this server
  const canManageServer = hasServerPermission(server, currentUser.id, 'manageServer');
  const canManageChannels = hasServerPermission(server, currentUser.id, 'manageChannels');
  const canSendMessages = hasServerPermission(server, currentUser.id, 'sendMessages');
  const canAttachFiles = hasServerPermission(server, currentUser.id, 'attachFiles');
  const canManageMessages = hasServerPermission(server, currentUser.id, 'manageMessages');
  const canPinMessages = hasServerPermission(server, currentUser.id, 'pinMessages');
  const canAddReactions = hasServerPermission(server, currentUser.id, 'addReactions');
  const canConnectVoice = hasServerPermission(server, currentUser.id, 'connectVoice');
  const canSpeakVoice = hasServerPermission(server, currentUser.id, 'speakVoice');

  // Check active timeout on current user
  const myTimeoutIso = server.timedOutUntil?.[currentUser.id];
  const isTimedOut = Boolean(myTimeoutIso && new Date(myTimeoutIso).getTime() > Date.now());

  const textChannels = server.channels.filter((c) => c.type !== 'voice');
  const voiceChannels = server.channels.filter((c) => c.type === 'voice');
  const categories = server.categories || [];
  const activeChannel =
    server.channels.find((c) => c.id === effectiveSelectedId) ||
    textChannels[0] ||
    server.channels[0];

  useEffect(() => {
    const defaultCh =
      server.channels.find((c) => c.type !== 'voice')?.id || server.channels[0]?.id || '';
    if (!controlledChannelId || !server.channels.some((c) => c.id === controlledChannelId)) {
      setSelectedChannelId(defaultCh);
    }
    setReplyTarget(null);
    setDrawerMode('none');
    setAddingChannelTarget(null);
    setCreatingCatOpen(false);
    setServerMenuOpen(false);
    setSelectedMemberCard(null);
  }, [server.id]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setServerMenuOpen(false);
      }
      if (statusFooterRef.current && !statusFooterRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    if (serverMenuOpen || statusMenuOpen) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [serverMenuOpen, statusMenuOpen]);

  useEffect(() => {
    if (!activeChannel || activeChannel.type === 'voice') return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getServerMessages(server.id, activeChannel.id);
        if (active) {
          setMessages(res.messages);
          setMembers(res.members);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [server.id, activeChannel?.id, activeChannel?.type]);

  // Also ensure members list loads even if user starts on a voice channel
  useEffect(() => {
    if (members.length > 0) return;
    const fallbackText = textChannels[0] || server.channels[0];
    if (!fallbackText) return;
    api
      .getServerMessages(server.id, fallbackText.id)
      .then((res) => setMembers(res.members))
      .catch(() => {});
  }, [server.id, members.length]);

  // Real-time WebSocket message events
  useEffect(() => {
    if (!incomingWsMessage) return;
    if (
      incomingWsMessage.serverId === server.id &&
      incomingWsMessage.channelId === activeChannel?.id
    ) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingWsMessage.id)) return prev;
        return [...prev, incomingWsMessage];
      });
    }
  }, [incomingWsMessage, server.id, activeChannel?.id]);

  useEffect(() => {
    if (!incomingWsUpdatedMessage) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === incomingWsUpdatedMessage.id ? incomingWsUpdatedMessage : m))
    );
  }, [incomingWsUpdatedMessage]);

  useEffect(() => {
    if (!incomingWsDeletedMessageId) return;
    setMessages((prev) => prev.filter((m) => m.id !== incomingWsDeletedMessageId));
  }, [incomingWsDeletedMessageId]);

  useEffect(() => {
    if (activeChannel?.type !== 'voice') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeChannel?.id, activeChannel?.type]);

  const handleOpenMemberPopoverById = (userId: string) => {
    const found = members.find((m) => m.id === userId);
    if (found) {
      setSelectedMemberCard(found);
      return;
    }
    const fromMsg = messages.find((m) => m.authorId === userId);
    if (fromMsg) {
      setSelectedMemberCard({
        id: fromMsg.authorId,
        email: '',
        name: fromMsg.authorName,
        tag: fromMsg.authorTag,
        avatarUrl: fromMsg.authorAvatar,
        bio: '',
        blockedUserIds: [],
        createdAt: fromMsg.createdAt,
      });
      return;
    }
    onOpenProfile(userId);
  };

  const handleSendMessage = async (payload: {
    content: string;
    attachmentFile?: File | null;
    replyToMessageId?: string;
    audioDurationSec?: number;
  }) => {
    if (!activeChannel) return;
    const res = await api.sendServerMessage(server.id, {
      channelId: activeChannel.id,
      content: payload.content,
      attachmentFile: payload.attachmentFile,
      replyToMessageId: payload.replyToMessageId,
      audioDurationSec: payload.audioDurationSec,
    });
    setMessages((prev) => {
      if (prev.some((m) => m.id === res.message.id)) return prev;
      return [...prev, res.message];
    });
  };

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.createCategory(server.id, newCategoryName.trim());
      onServerUpdated(res.server);
      setNewCategoryName('');
      setCreatingCatOpen(false);
      onNotify(`Created category "${res.category.name}".`);
    } catch (err: any) {
      onNotify(err?.message || 'Unable to create category.');
    }
  };

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !addingChannelTarget) return;
    try {
      const res = await api.createChannel(server.id, {
        name: newChannelName.trim(),
        type: addingChannelTarget.type,
        categoryId: addingChannelTarget.categoryId,
      });
      onServerUpdated(res.server);
      setSelectedChannelId(res.channel.id);
      if (addingChannelTarget.type === 'voice' && canConnectVoice) {
        onJoinVoiceChannel(res.server, res.channel);
      }
      setNewChannelName('');
      setAddingChannelTarget(null);
      onNotify(
        `Created ${addingChannelTarget.type === 'voice' ? 'voice' : 'text'} channel "${res.channel.name}".`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Unable to create channel.');
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    const res = await api.editMessage(messageId, content);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify('Message edited.');
  };

  const handleDeleteMessage = async (messageId: string) => {
    await api.deleteMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    onNotify('Message deleted.');
  };

  const handleReactMessage = async (messageId: string, emoji: string) => {
    const res = await api.reactMessage(messageId, emoji);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
  };

  const handlePinMessage = async (messageId: string) => {
    const res = await api.pinMessage(messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify(res.message.pinned ? 'Message pinned to channel.' : 'Message unpinned.');
  };

  const handleBookmarkMessage = async (messageId: string) => {
    const res = await api.bookmarkMessage(messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify(res.bookmarked ? 'Message bookmarked.' : 'Bookmark removed.');
  };

  const pinnedMessages = messages.filter((m) => m.pinned);
  const bookmarkedMessages = messages.filter((m) =>
    (m.bookmarkedByUserIds || []).includes(currentUser.id)
  );

  const renderChannelButton = (ch: Channel) => {
    const isVoice = ch.type === 'voice';
    const active = ch.id === activeChannel?.id;
    const chPings = !isVoice ? pingsByChannelId[ch.id] || 0 : 0;
    const connectedHere =
      isVoice && activeVoice?.serverId === server.id && activeVoice?.channelId === ch.id;
    const roomUsers = isVoice ? voiceParticipants.filter((p) => p.channelId === ch.id) : [];

    return (
      <div key={ch.id} className="space-y-1">
        <button
          type="button"
          onClick={() => {
            setSelectedChannelId(ch.id);
            setDrawerMode('none');
            if (isVoice && !connectedHere && canConnectVoice) {
              onJoinVoiceChannel(server, ch);
            }
          }}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors whitespace-nowrap cursor-pointer ${
            active
              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : connectedHere
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
              : chPings > 0
              ? 'text-zinc-950 dark:text-white font-bold hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {isVoice ? (
              <Volume2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
            ) : (
              <Hash className="w-3.5 h-3.5 shrink-0 opacity-75" />
            )}
            <span className="truncate">{ch.name}</span>
          </span>
          {isVoice && roomUsers.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums opacity-75">
              {roomUsers.length}
            </span>
          )}
          {!isVoice && chPings > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center font-mono tabular-nums shrink-0">
              {chPings > 99 ? '99+' : chPings}
            </span>
          )}
        </button>

        {isVoice && roomUsers.length > 0 && (
          <div className="pl-6 space-y-1">
            {roomUsers.map((p) => {
              const pStreaming = Boolean(p.isStreaming || streamingUserIds?.has(p.userId));
              return (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => handleOpenMemberPopoverById(p.userId)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={p.userAvatar}
                      alt={p.userName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = makeInitialsAvatar(p.userName);
                      }}
                      className={`w-5 h-5 rounded-full object-cover ${
                        pStreaming
                          ? 'ring-2 ring-red-500 border border-zinc-950'
                          : p.speaking && !p.muted
                          ? 'border border-emerald-500 ring-2 ring-emerald-500'
                          : 'border border-zinc-300 dark:border-zinc-700'
                      }`}
                    />
                    <span className="truncate">{p.userName}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {pStreaming && (
                      <span className="px-1 py-0.2 rounded bg-red-600 text-white text-[9px] font-bold">
                        LIVE
                      </span>
                    )}
                    {p.muted && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderMembersListContent = () => (
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
      {members.map((m) => {
        const effectiveStatus = getEffectiveStatus(m, onlineUserIds, currentUser.id);
        const isOwner = m.id === server.ownerId;
        const memberRoles = getMemberRoles(server, m.id);
        const topRole = memberRoles[0];
        const isMemberStreaming = Boolean(m.isStreaming || streamingUserIds?.has(m.id));
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => handleOpenMemberPopoverById(m.id)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors text-left cursor-pointer"
          >
            <div className="relative shrink-0">
              <img
                src={m.avatarUrl}
                alt={m.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = makeInitialsAvatar(m.name);
                }}
                className={`w-8 h-8 rounded-full object-cover ${
                  isMemberStreaming
                    ? 'ring-2 ring-red-500 border border-zinc-950'
                    : 'border border-zinc-200 dark:border-zinc-700'
                }`}
              />
              {isMemberStreaming ? (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-red-600 text-white text-[8px] font-extrabold border border-white dark:border-zinc-950">
                  LIVE
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusBadge status={effectiveStatus} size="sm" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate"
                style={
                  topRole?.color && topRole.color !== '#fafafa'
                    ? { color: topRole.color }
                    : undefined
                }
              >
                {m.name}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {isMemberStreaming ? (
                  <span className="text-red-500 font-semibold">Live Streaming</span>
                ) : isOwner ? (
                  'Owner'
                ) : topRole ? (
                  topRole.name
                ) : effectiveStatus === 'dnd' ? (
                  'Do Not Disturb'
                ) : (
                  effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)
                )}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  // Organize channels by categories
  const validCategoryIds = new Set(categories.map((c) => c.id));
  const uncategorizedChannels = server.channels.filter(
    (c) => !c.categoryId || !validCategoryIds.has(c.categoryId)
  );
  const uncategorizedText = uncategorizedChannels.filter((c) => c.type !== 'voice');
  const uncategorizedVoice = uncategorizedChannels.filter((c) => c.type === 'voice');

  const popoverPendingDirection: 'incoming' | 'outgoing' | null = selectedMemberCard
    ? friendsData.incomingRequests.some((r) => r.user.id === selectedMemberCard.id)
      ? 'incoming'
      : friendsData.outgoingRequests.some((r) => r.user.id === selectedMemberCard.id)
      ? 'outgoing'
      : null
    : null;

  const isMeStreaming = Boolean(currentUser.isStreaming || streamingUserIds?.has(currentUser.id));
  const myStatus: UserStatus = currentUser.status || 'online';
  const myStatusLabel =
    myStatus === 'dnd'
      ? 'Do Not Disturb'
      : myStatus.charAt(0).toUpperCase() + myStatus.slice(1);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl lg:rounded-none lg:border-0 overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-11.5rem)] lg:h-[calc(100vh-4rem)] min-h-[480px] transition-colors relative">
      {/* Desktop Left: Server Banner + Categories & Channels */}
      <div className="hidden lg:flex w-64 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex-col shrink-0">
        {/* Server Banner + Dropdown Trigger */}
        <div ref={serverMenuRef} className="relative border-b border-zinc-200 dark:border-zinc-800">
          {server.bannerUrl && (
            <div className="h-28 w-full relative overflow-hidden bg-zinc-950">
              <img
                src={server.bannerUrl}
                alt={`${server.name} banner`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setServerMenuOpen((v) => !v)}
            className={`w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
              server.bannerUrl
                ? 'absolute inset-x-0 bottom-0 text-white hover:bg-black/25'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {!server.bannerUrl && <ServerIconBadge server={server} active size="sm" />}
              <div className="min-w-0">
                <h2
                  className={`font-display text-sm font-bold truncate ${
                    server.bannerUrl ? 'text-white drop-shadow-xs' : 'text-zinc-950 dark:text-zinc-50'
                  }`}
                >
                  {server.name}
                </h2>
                {!server.bannerUrl && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                    {server.description || `${members.length} members`}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${
                serverMenuOpen ? 'rotate-180' : ''
              } ${server.bannerUrl ? 'text-white' : 'text-zinc-500'}`}
            />
          </button>

          {/* Server Actions Dropdown Menu */}
          {serverMenuOpen && (
            <div className="absolute left-2 right-2 top-full mt-1.5 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setServerMenuOpen(false);
                  setInviteModalOpen(true);
                }}
                className="w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Invite People</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setServerMenuOpen(false);
                  setServerSettingsTab('overview');
                  setServerSettingsOpen(true);
                }}
                className="w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-500" />
                <span>Server Settings</span>
              </button>

              {canManageChannels && (
                <>
                  <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setServerMenuOpen(false);
                      setCreatingCatOpen(true);
                    }}
                    className="w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Create Category</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServerMenuOpen(false);
                      setAddingChannelTarget({ type: 'text' });
                    }}
                    className="w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Create Channel</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Categories & Channels Scrollable Tree */}
        <div className="p-3 flex-1 overflow-y-auto space-y-4">
          {/* Quick Inline Category Creator */}
          {creatingCatOpen && canManageChannels && (
            <form
              onSubmit={handleCreateCategorySubmit}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-zinc-500">New Category</span>
                <button
                  type="button"
                  onClick={() => setCreatingCatOpen(false)}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="CATEGORY NAME"
                  autoFocus
                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg cursor-pointer"
                  aria-label="Save category"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            </form>
          )}

          {/* Uncategorized Channels */}
          {categories.length === 0 ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Text Channels
                  </span>
                  {canManageChannels && (
                    <button
                      type="button"
                      onClick={() =>
                        setAddingChannelTarget((prev) =>
                          prev?.type === 'text' && !prev.categoryId ? null : { type: 'text' }
                        )
                      }
                      title="Create Text Channel"
                      className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {addingChannelTarget?.type === 'text' && !addingChannelTarget.categoryId && (
                  <form
                    onSubmit={handleCreateChannelSubmit}
                    className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                  >
                    <input
                      type="text"
                      placeholder="new-text-channel"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded text-xs cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </form>
                )}

                <div className="space-y-1">{uncategorizedText.map(renderChannelButton)}</div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Voice Channels
                  </span>
                  {canManageChannels && (
                    <button
                      type="button"
                      onClick={() =>
                        setAddingChannelTarget((prev) =>
                          prev?.type === 'voice' && !prev.categoryId ? null : { type: 'voice' }
                        )
                      }
                      title="Create Voice Channel"
                      className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {addingChannelTarget?.type === 'voice' && !addingChannelTarget.categoryId && (
                  <form
                    onSubmit={handleCreateChannelSubmit}
                    className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                  >
                    <input
                      type="text"
                      placeholder="Voice room name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded text-xs cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </form>
                )}

                <div className="space-y-1">
                  {uncategorizedVoice.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] text-zinc-400">No voice channels yet.</p>
                  ) : (
                    uncategorizedVoice.map(renderChannelButton)
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {uncategorizedChannels.length > 0 && (
                <div className="space-y-1">{uncategorizedChannels.map(renderChannelButton)}</div>
              )}

              {categories.map((cat) => {
                const collapsed = Boolean(collapsedCatIds[cat.id]);
                const catChannels = server.channels.filter((c) => c.categoryId === cat.id);
                const isAddingHere = addingChannelTarget?.categoryId === cat.id;

                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between px-1 group">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedCatIds((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                        }
                        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer truncate"
                      >
                        {collapsed ? (
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{cat.name}</span>
                      </button>

                      {canManageChannels && (
                        <button
                          type="button"
                          onClick={() =>
                            setAddingChannelTarget((prev) =>
                              prev?.categoryId === cat.id
                                ? null
                                : { type: 'text', categoryId: cat.id }
                            )
                          }
                          title={`Add channel to ${cat.name}`}
                          className="p-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isAddingHere && (
                      <form
                        onSubmit={handleCreateChannelSubmit}
                        className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="channel-name"
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded text-xs cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {(['text', 'voice'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setAddingChannelTarget({ type: t, categoryId: cat.id })
                              }
                              className={`flex-1 py-0.5 rounded text-[10px] font-semibold capitalize cursor-pointer ${
                                addingChannelTarget?.type === t
                                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </form>
                    )}

                    {!collapsed && (
                      <div className="space-y-1">
                        {catChannels.length === 0 ? (
                          <p className="px-2 py-1 text-[11px] text-zinc-400">Empty category</p>
                        ) : (
                          catChannels.map(renderChannelButton)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Active Voice Connection Dock inside Server Sidebar (Desktop Discord Layout) */}
        {activeVoice && (
          <div className="px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/95 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span>Voice Connected</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {activeVoice.channelName} · {activeVoice.serverName}
                </p>
              </div>
              <button
                type="button"
                onClick={onLeaveVoice}
                title="Disconnect from voice"
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-950 hover:bg-red-500/15 text-zinc-600 dark:text-zinc-300 hover:text-red-500 border border-zinc-200 dark:border-zinc-800 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleVoiceMute}
                title={activeVoice.muted ? 'Unmute Mic' : 'Mute Mic'}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border cursor-pointer ${
                  activeVoice.muted
                    ? 'bg-red-500/15 text-red-500 border-red-500/30'
                    : 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
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
                    ? 'bg-red-500/15 text-red-500 border-red-500/30'
                    : 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>{activeVoice.deafened ? 'Deaf' : 'Audio'}</span>
              </button>
              <button
                type="button"
                onClick={activeVoice.isStreaming ? onStopVoiceStream : onStartVoiceStream}
                title={activeVoice.isStreaming ? 'Stop Live Stream' : 'Share Screen / Go Live'}
                className={`p-1.5 rounded-lg border cursor-pointer ${
                  activeVoice.isStreaming
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {activeVoice.isStreaming ? (
                  <MonitorOff className="w-3.5 h-3.5" />
                ) : (
                  <MonitorUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* User Status & Settings Gear Footer (Discord style inside Server Column) */}
        <div
          ref={statusFooterRef}
          className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-black shrink-0 relative"
        >
          {statusMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="p-2 border-b border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setStatusMenuOpen(false);
                    onOpenProfile(currentUser.id);
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
              <div className="p-1.5 space-y-0.5">
                {(['online', 'idle', 'dnd', 'invisible'] as UserStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      onChangeStatus(st);
                      setStatusMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                      myStatus === st ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/70'
                    }`}
                  >
                    <StatusBadge status={st} size="sm" />
                    <span>
                      {st === 'dnd' ? 'Do Not Disturb' : st.charAt(0).toUpperCase() + st.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusMenuOpen((v) => !v)}
              className="flex-1 p-1.5 rounded-xl hover:bg-zinc-200/70 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2 text-left cursor-pointer min-w-0"
            >
              <div className="relative shrink-0">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = makeInitialsAvatar(currentUser.name);
                  }}
                  className={`w-8 h-8 rounded-full object-cover ${
                    isMeStreaming
                      ? 'ring-2 ring-red-500 border border-black'
                      : 'border border-zinc-300 dark:border-zinc-700'
                  }`}
                />
                {isMeStreaming ? (
                  <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-red-600 text-white text-[7px] font-extrabold border border-black">
                    LIVE
                  </span>
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusBadge status={myStatus} size="sm" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                  {isMeStreaming ? (
                    <span className="text-red-500 font-semibold">Live Streaming</span>
                  ) : (
                    myStatusLabel
                  )}
                </p>
              </div>
              <ChevronUp
                className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${
                  statusMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={onOpenUserSettings}
              title="User Settings"
              aria-label="User Settings"
              className="p-2 rounded-xl hover:bg-zinc-200/70 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Center: Voice Channel Stage OR Live Text Channel Chat */}
      {activeChannel?.type === 'voice' ? (
        <VoiceChannelStage
          channel={activeChannel}
          server={server}
          currentUserId={currentUser.id}
          participants={voiceParticipants.filter((p) => p.channelId === activeChannel.id)}
          activeVoice={activeVoice}
          voiceSettings={voiceSettings}
          canConnect={canConnectVoice}
          canSpeak={canSpeakVoice}
          localVideoStream={localVideoStream}
          remoteVideoStreams={remoteVideoStreams}
          streamingUserIds={streamingUserIds}
          onJoinVoice={() => onJoinVoiceChannel(server, activeChannel)}
          onLeaveVoice={onLeaveVoice}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onStartVoiceStream={onStartVoiceStream}
          onStopVoiceStream={onStopVoiceStream}
          onPttHoldStart={onPttHoldStart}
          onPttHoldEnd={onPttHoldEnd}
          onSwitchInputMode={onSwitchVoiceInputMode}
          onOpenVoiceSettings={onOpenVoiceSettings}
          onSwitchToTextChannel={() => {
            if (textChannels[0]) setSelectedChannelId(textChannels[0].id);
          }}
          onOpenProfile={handleOpenMemberPopoverById}
        />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 relative">
          {/* Channel Header */}
          <div className="h-14 px-3 sm:px-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {onOpenMobileDrawer && (
                <button
                  type="button"
                  onClick={onOpenMobileDrawer}
                  aria-label="Open channels drawer"
                  className="lg:hidden p-1.5 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <Hash className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                {activeChannel?.name || 'general'}
              </span>
              {activeChannel?.topic && (
                <>
                  <span
                    aria-hidden="true"
                    className="text-zinc-300 dark:text-zinc-700 hidden md:inline"
                  >
                    |
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate hidden md:inline">
                    {activeChannel.topic}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">

              <button
                type="button"
                onClick={() =>
                  setDrawerMode((prev) => (prev === 'pinned' ? 'none' : 'pinned'))
                }
                title="Pinned Messages"
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border cursor-pointer ${
                  drawerMode === 'pinned'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums text-[11px]">
                  {pinnedMessages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDrawerMode((prev) => (prev === 'bookmarks' ? 'none' : 'bookmarks'))
                }
                title="Saved Bookmarks"
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border cursor-pointer ${
                  drawerMode === 'bookmarks'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums text-[11px]">
                  {bookmarkedMessages.length}
                </span>
              </button>

              {/* Toggle Members Button (Desktop + Mobile/Tablet Drawer) */}
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1280 && setIsMobileMembersOpen) {
                    setIsMobileMembersOpen(!isMobileMembersOpen);
                  } else {
                    setShowMembers((v) => !v);
                  }
                }}
                title="Toggle Member List"
                aria-label="Toggle Member List"
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border cursor-pointer ${
                  showMembers
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {showMembers ? (
                  <PanelRightClose className="w-3.5 h-3.5 hidden xl:block" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5 hidden xl:block" />
                )}
                <Users className="w-3.5 h-3.5 xl:hidden" />
                <span className="font-mono tabular-nums text-[11px]">{members.length}</span>
              </button>
            </div>
          </div>

          {/* Pinned / Bookmarked Messages Drawer */}
          {drawerMode !== 'none' && (
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 max-h-60 overflow-y-auto space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  {drawerMode === 'pinned' ? (
                    <>
                      <Pin className="w-3.5 h-3.5" />
                      <span>Pinned Messages ({pinnedMessages.length})</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Bookmarked Messages ({bookmarkedMessages.length})</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerMode('none')}
                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {(drawerMode === 'pinned' ? pinnedMessages : bookmarkedMessages).length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">
                  No {drawerMode === 'pinned' ? 'pinned' : 'bookmarked'} messages in this channel yet.
                </p>
              ) : (
                (drawerMode === 'pinned' ? pinnedMessages : bookmarkedMessages).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-950 dark:text-zinc-100">
                        {item.authorName}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 break-words">
                        {item.content || `[${item.attachmentType || 'Attachment'}]`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById(`msg-${item.id}`)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                        setDrawerMode('none');
                      }}
                      className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:underline shrink-0 cursor-pointer"
                    >
                      Jump
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2">
            {loading ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Loading channel history...
              </p>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Welcome to #{activeChannel?.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Start the conversation below — share messages, images, videos, GIFs, or voice notes.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUser.id}
                  isAuthorStreaming={Boolean(streamingUserIds?.has(msg.authorId))}
                  authorRoles={getMemberRoles(server, msg.authorId)}
                  customEmojis={server.customEmojis || []}
                  canManageMessages={canManageMessages}
                  canPinMessages={canPinMessages}
                  canAddReactions={canAddReactions}
                  isUnreadStart={unreadMarkerMessageId === msg.id}
                  onOpenProfile={handleOpenMemberPopoverById}
                  onReply={(m) => setReplyTarget(m)}
                  onForward={onForwardMessage}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReact={handleReactMessage}
                  onPin={handlePinMessage}
                  onBookmark={handleBookmarkMessage}
                  onMarkUnread={(id) => {
                    setUnreadMarkerMessageId(id);
                    onNotify('Marked message as unread.');
                  }}
                  onCreateReminder={onCreateReminder}
                  onSpeak={onSpeakMessage}
                  onCopySuccess={onNotify}
                  onReport={(m) =>
                    onReport({
                      targetType: 'message',
                      targetId: m.id,
                      targetUserId: m.authorId,
                      targetUserName: m.authorName,
                    })
                  }
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Rich Chat Composer */}
          <ChatComposer
            placeholder={`Message #${activeChannel?.name || 'general'}...`}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            disabled={!canSendMessages || isTimedOut}
            disabledReason={
              isTimedOut
                ? 'You are currently timed out in this server.'
                : 'Your server role does not allow sending messages in this channel.'
            }
            canAttachFiles={canAttachFiles}
            customEmojis={server.customEmojis || []}
            onOpenManageCustomEmojis={() => {
              setServerSettingsTab('emoji');
              setServerSettingsOpen(true);
            }}
            onSend={handleSendMessage}
            onError={onNotify}
          />
        </div>
      )}

      {/* Desktop Right: Toggleable Server Members Roster */}
      {showMembers && (
        <aside className="hidden xl:flex w-60 bg-zinc-50 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex-col shrink-0">
          <div className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Members ({members.length})
              </span>
            </div>
            {canManageServer && (
              <button
                type="button"
                onClick={() => {
                  setServerSettingsTab('overview');
                  setServerSettingsOpen(true);
                }}
                title="Server Settings"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {renderMembersListContent()}
        </aside>
      )}

      {/* Mobile & Tablet Swipe-Left Slide-Over Members Drawer */}
      {isMobileMembersOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="flex-1 bg-black/55 backdrop-blur-xs"
            onClick={() => setIsMobileMembersOpen?.(false)}
          />
          <aside className="w-72 bg-zinc-50 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full shadow-2xl">
            <div className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Members ({members.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMembersOpen?.(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderMembersListContent()}
          </aside>
        </div>
      )}

      {/* Discord-style Member Card Popover (Roles, Timeout/Kick/Ban, Message, Add Friend, Profile) */}
      {selectedMemberCard && (
        <MemberProfilePopover
          member={selectedMemberCard}
          server={server}
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          isStreaming={Boolean(
            selectedMemberCard.isStreaming || streamingUserIds?.has(selectedMemberCard.id)
          )}
          isFriend={friendsData.friends.some((f) => f.id === selectedMemberCard.id)}
          pendingDirection={popoverPendingDirection}
          onClose={() => setSelectedMemberCard(null)}
          onViewFullProfile={(uid) => {
            setSelectedMemberCard(null);
            onOpenProfile(uid);
          }}
          onMessageUser={(uid) => {
            setSelectedMemberCard(null);
            onStartDm(uid);
          }}
          onAddFriend={onAddFriend}
          onServerUpdated={onServerUpdated}
          onError={onNotify}
        />
      )}

      {/* Full Server Settings Modal */}
      <ServerSettingsModal
        isOpen={serverSettingsOpen}
        initialTab={serverSettingsTab}
        server={server}
        members={members}
        currentUser={currentUser}
        onClose={() => setServerSettingsOpen(false)}
        onServerUpdated={onServerUpdated}
      />

      {/* Invite Links Modal */}
      <InviteModal
        isOpen={inviteModalOpen}
        server={server}
        friends={friendsData.friends}
        currentUserId={currentUser.id}
        onClose={() => setInviteModalOpen(false)}
        onServerUpdated={onServerUpdated}
        onSendInviteDm={onSendInviteDm}
      />
    </div>
  );
};

