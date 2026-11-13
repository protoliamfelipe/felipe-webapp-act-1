import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Volume2,
  Plus,
  Users,
  UserPlus,
  Check,
  Shield,
  Pin,
  Bookmark,
  MicOff,
  X,
} from 'lucide-react';
import {
  Server,
  ChatMessage,
  User,
  Channel,
  VoiceParticipant,
  VoiceSettings,
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
import { ServerRolesModal } from './ServerRolesModal';
import { ActiveVoiceInfo } from './Sidebar';

interface ServerWorkspaceProps {
  server: Server & { isMember: boolean; memberCount: number };
  currentUser: User;
  onlineUserIds: string[];
  incomingWsMessage: ChatMessage | null;
  incomingWsUpdatedMessage: ChatMessage | null;
  incomingWsDeletedMessageId: string | null;
  voiceParticipants: VoiceParticipant[];
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  onJoinVoiceChannel: (server: Server, channel: Channel) => void;
  onLeaveVoice: () => void;
  onToggleVoiceMute: () => void;
  onToggleVoiceDeafen: () => void;
  onPttHoldStart: () => void;
  onPttHoldEnd: () => void;
  onSwitchVoiceInputMode: (mode: 'vad' | 'ptt') => void;
  onOpenVoiceSettings: () => void;
  onServerUpdated: (srv: Server) => void;
  onOpenProfile: (userId: string) => void;
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
  onAddFriend: (tag: string) => void;
}

export const ServerWorkspace: React.FC<ServerWorkspaceProps> = ({
  server,
  currentUser,
  onlineUserIds,
  incomingWsMessage,
  incomingWsUpdatedMessage,
  incomingWsDeletedMessageId,
  voiceParticipants,
  activeVoice,
  voiceSettings,
  onJoinVoiceChannel,
  onLeaveVoice,
  onToggleVoiceMute,
  onToggleVoiceDeafen,
  onPttHoldStart,
  onPttHoldEnd,
  onSwitchVoiceInputMode,
  onOpenVoiceSettings,
  onServerUpdated,
  onOpenProfile,
  onForwardMessage,
  onCreateReminder,
  onSpeakMessage,
  onNotify,
  onReport,
  onAddFriend,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    server.channels.find((c) => c.type !== 'voice')?.id || server.channels[0]?.id || ''
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Channel creation state (permission-gated)
  const [addingChannelType, setAddingChannelType] = useState<'text' | 'voice' | null>(null);
  const [newChannelName, setNewChannelName] = useState('');

  // Message interactions state
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [unreadMarkerMessageId, setUnreadMarkerMessageId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'none' | 'pinned' | 'bookmarks'>('none');
  const [rolesModalOpen, setRolesModalOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Permissions for current user in this server
  const canManageChannels = hasServerPermission(server, currentUser.id, 'manageChannels');
  const canManageRoles = hasServerPermission(server, currentUser.id, 'manageRoles');
  const canKickMembers = hasServerPermission(server, currentUser.id, 'kickMembers');
  const canSendMessages = hasServerPermission(server, currentUser.id, 'sendMessages');
  const canAttachFiles = hasServerPermission(server, currentUser.id, 'attachFiles');
  const canManageMessages = hasServerPermission(server, currentUser.id, 'manageMessages');
  const canPinMessages = hasServerPermission(server, currentUser.id, 'pinMessages');
  const canAddReactions = hasServerPermission(server, currentUser.id, 'addReactions');
  const canConnectVoice = hasServerPermission(server, currentUser.id, 'connectVoice');
  const canSpeakVoice = hasServerPermission(server, currentUser.id, 'speakVoice');

  const textChannels = server.channels.filter((c) => c.type !== 'voice');
  const voiceChannels = server.channels.filter((c) => c.type === 'voice');
  const activeChannel =
    server.channels.find((c) => c.id === selectedChannelId) ||
    textChannels[0] ||
    server.channels[0];

  useEffect(() => {
    const defaultCh =
      server.channels.find((c) => c.type !== 'voice')?.id || server.channels[0]?.id || '';
    setSelectedChannelId(defaultCh);
    setReplyTarget(null);
    setDrawerMode('none');
    setAddingChannelType(null);
  }, [server.id]);

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

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !addingChannelType) return;
    try {
      const res = await api.createChannel(server.id, {
        name: newChannelName.trim(),
        type: addingChannelType,
      });
      onServerUpdated(res.server);
      setSelectedChannelId(res.channel.id);
      if (addingChannelType === 'voice' && canConnectVoice) {
        onJoinVoiceChannel(res.server, res.channel);
      }
      setNewChannelName('');
      setAddingChannelType(null);
      onNotify(
        `Created ${addingChannelType === 'voice' ? 'voice' : 'text'} channel "${res.channel.name}".`
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

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-8.5rem)] min-h-[540px] transition-colors">
      {/* Left: Channels Column (Text + Voice + Roles Button) */}
      <div className="w-full lg:w-64 bg-zinc-50 dark:bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <ServerIconBadge server={server} active size="sm" />
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                {server.name}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                {server.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRolesModalOpen(true)}
            title={
              canManageRoles || canKickMembers
                ? 'Manage Roles & Permissions'
                : 'View Server Roles'
            }
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 cursor-pointer shrink-0"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 flex-1 overflow-y-auto space-y-4">
          {/* Text Channels */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Text Channels
              </span>
              {canManageChannels && (
                <button
                  type="button"
                  onClick={() =>
                    setAddingChannelType((prev) => (prev === 'text' ? null : 'text'))
                  }
                  title="Create Text Channel"
                  className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {addingChannelType === 'text' && (
              <form
                onSubmit={handleCreateChannel}
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
                  aria-label="Save text channel"
                >
                  <Check className="w-3 h-3" />
                </button>
              </form>
            )}

            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
              {textChannels.map((ch) => {
                const active = ch.id === activeChannel?.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChannelId(ch.id);
                      setDrawerMode('none');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Channels */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Voice Channels
              </span>
              {canManageChannels && (
                <button
                  type="button"
                  onClick={() =>
                    setAddingChannelType((prev) => (prev === 'voice' ? null : 'voice'))
                  }
                  title="Create Voice Channel"
                  className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {addingChannelType === 'voice' && (
              <form
                onSubmit={handleCreateChannel}
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
                  aria-label="Save voice channel"
                >
                  <Check className="w-3 h-3" />
                </button>
              </form>
            )}

            <div className="space-y-1">
              {voiceChannels.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-zinc-400">No voice channels yet.</p>
              ) : (
                voiceChannels.map((vc) => {
                  const active = vc.id === activeChannel?.id;
                  const connectedHere =
                    activeVoice?.serverId === server.id && activeVoice?.channelId === vc.id;
                  const roomUsers = voiceParticipants.filter((p) => p.channelId === vc.id);

                  return (
                    <div key={vc.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChannelId(vc.id);
                          setDrawerMode('none');
                          if (!connectedHere && canConnectVoice) {
                            onJoinVoiceChannel(server, vc);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                            : connectedHere
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Volume2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{vc.name}</span>
                        </span>
                        {roomUsers.length > 0 && (
                          <span className="text-[10px] font-mono tabular-nums opacity-75">
                            {roomUsers.length}
                          </span>
                        )}
                      </button>

                      {/* Indented live voice participants */}
                      {roomUsers.length > 0 && (
                        <div className="pl-6 space-y-1">
                          {roomUsers.map((p) => (
                            <div
                              key={p.userId}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[11px] text-zinc-600 dark:text-zinc-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={p.userAvatar}
                                  alt={p.userName}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = makeInitialsAvatar(
                                      p.userName
                                    );
                                  }}
                                  className={`w-5 h-5 rounded-full object-cover border ${
                                    p.speaking && !p.muted
                                      ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                                      : 'border-zinc-300 dark:border-zinc-700'
                                  }`}
                                />
                                <span className="truncate">{p.userName}</span>
                              </div>
                              {p.muted && <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Voice Channel Stage OR Live Text Channel Chat */}
      {activeChannel?.type === 'voice' ? (
        <VoiceChannelStage
          channel={activeChannel}
          server={server}
          participants={voiceParticipants.filter((p) => p.channelId === activeChannel.id)}
          activeVoice={activeVoice}
          voiceSettings={voiceSettings}
          canConnect={canConnectVoice}
          canSpeak={canSpeakVoice}
          onJoinVoice={() => onJoinVoiceChannel(server, activeChannel)}
          onLeaveVoice={onLeaveVoice}
          onToggleMute={onToggleVoiceMute}
          onToggleDeafen={onToggleVoiceDeafen}
          onPttHoldStart={onPttHoldStart}
          onPttHoldEnd={onPttHoldEnd}
          onSwitchInputMode={onSwitchVoiceInputMode}
          onOpenVoiceSettings={onOpenVoiceSettings}
          onSwitchToTextChannel={() => {
            if (textChannels[0]) setSelectedChannelId(textChannels[0].id);
          }}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 relative">
          {/* Channel Header */}
          <div className="h-14 px-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                {activeChannel?.name || 'general'}
              </span>
              {activeChannel?.topic && (
                <>
                  <span
                    aria-hidden="true"
                    className="text-zinc-300 dark:text-zinc-700 hidden sm:inline"
                  >
                    |
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate hidden sm:inline">
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

              <span className="hidden sm:inline text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 pl-1">
                {members.length} members
              </span>
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
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
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
                  Start the conversation below — share messages, images, GIFs, or voice notes.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  currentUserId={currentUser.id}
                  authorRoles={getMemberRoles(server, msg.authorId)}
                  canManageMessages={canManageMessages}
                  canPinMessages={canPinMessages}
                  canAddReactions={canAddReactions}
                  isUnreadStart={unreadMarkerMessageId === msg.id}
                  onOpenProfile={onOpenProfile}
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
            disabled={!canSendMessages}
            disabledReason="Your server role does not allow sending messages in this channel."
            canAttachFiles={canAttachFiles}
            onSend={handleSendMessage}
            onError={onNotify}
          />
        </div>
      )}

      {/* Right: Server Members Roster with Status & Role Badges */}
      <aside className="hidden xl:flex w-60 bg-zinc-50 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex-col shrink-0">
        <div className="h-14 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Members ({members.length})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRolesModalOpen(true)}
            title="Roles & Members"
            className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            Roles
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {members.map((m) => {
            const effectiveStatus = getEffectiveStatus(m, onlineUserIds, currentUser.id);
            const isOwner = m.id === server.ownerId;
            const memberRoles = getMemberRoles(server, m.id);
            const topRole = memberRoles[0];
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(m.id)}
                  className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = makeInitialsAvatar(m.name);
                      }}
                      className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <StatusBadge status={effectiveStatus} size="sm" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {m.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {isOwner
                        ? 'Owner'
                        : topRole
                        ? topRole.name
                        : effectiveStatus === 'dnd'
                        ? 'Do Not Disturb'
                        : effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                    </p>
                  </div>
                </button>

                {m.id !== currentUser.id && (
                  <button
                    type="button"
                    onClick={() => onAddFriend(m.tag)}
                    title={`Add ${m.name} as friend`}
                    className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Server Roles & Permissions Modal */}
      <ServerRolesModal
        isOpen={rolesModalOpen}
        server={server}
        members={members}
        currentUserId={currentUser.id}
        onClose={() => setRolesModalOpen(false)}
        onServerUpdated={onServerUpdated}
        onNotify={onNotify}
      />
    </div>
  );
};
