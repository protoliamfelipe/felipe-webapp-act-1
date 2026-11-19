import React, { useState, useEffect, useRef } from 'react';
import {
  UserPlus,
  MessageSquare,
  Check,
  X,
  Flag,
  UserMinus,
  Users,
  Pin,
  Bookmark,
  ArrowLeft,
} from 'lucide-react';
import { User, ChatMessage, FriendsOverview } from '../types';
import { api } from '../services/api';
import { makeInitialsAvatar } from '../utils/avatars';
import { getEffectiveStatus } from '../utils/permissions';
import { StatusBadge } from './StatusBadge';
import { MessageItem } from './MessageItem';
import { ChatComposer } from './ChatComposer';

interface FriendsViewProps {
  currentUser: User;
  friendsData: FriendsOverview & { discoverPlayers: User[] };
  onlineUserIds: string[];
  streamingUserIds?: Set<string>;
  activeDmFriendId: string | null;
  setActiveDmFriendId: (id: string | null) => void;
  dmSendersById?: Record<string, User>;
  unreadDmByFriendId?: Record<string, number>;
  onClearDmUnread?: (friendId: string) => void;
  onDmSent?: (friendId: string, message: ChatMessage) => void;
  incomingWsMessage: ChatMessage | null;
  incomingWsUpdatedMessage: ChatMessage | null;
  incomingWsDeletedMessageId: string | null;
  onRefreshFriends: () => void;
  onSendFriendRequest: (identifier: string) => Promise<void>;
  onRespondRequest: (requestId: string, action: 'accept' | 'decline') => Promise<void>;
  onRemoveFriend: (friendId: string) => Promise<void>;
  onOpenProfile: (userId: string) => void;
  onForwardMessage: (msg: ChatMessage) => void;
  onCreateReminder: (msg: ChatMessage, minutes: number) => void;
  onSpeakMessage: (msg: ChatMessage) => void;
  onNotify: (msg: string) => void;
  onReport: (target: {
    targetType: 'user' | 'message';
    targetId: string;
    targetUserId: string;
    targetUserName: string;
  }) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  friendsData,
  onlineUserIds,
  streamingUserIds,
  activeDmFriendId,
  setActiveDmFriendId,
  dmSendersById = {},
  unreadDmByFriendId = {},
  onClearDmUnread,
  onDmSent,
  incomingWsMessage,
  incomingWsUpdatedMessage,
  incomingWsDeletedMessageId,
  onSendFriendRequest,
  onRespondRequest,
  onRemoveFriend,
  onOpenProfile,
  onForwardMessage,
  onCreateReminder,
  onSpeakMessage,
  onNotify,
  onReport,
}) => {
  const [tab, setTab] = useState<'all' | 'pending' | 'discover'>('all');
  const [addInput, setAddInput] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // DM chat state
  const [dmMessages, setDmMessages] = useState<ChatMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [unreadMarkerMessageId, setUnreadMarkerMessageId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'none' | 'pinned' | 'bookmarks'>('none');
  const dmBottomRef = useRef<HTMLDivElement>(null);

  const activeFriend =
    friendsData.friends.find((f) => f.id === activeDmFriendId) ||
    friendsData.discoverPlayers.find((f) => f.id === activeDmFriendId) ||
    (activeDmFriendId ? dmSendersById[activeDmFriendId] || null : null);

  useEffect(() => {
    setReplyTarget(null);
    setDrawerMode('none');
    if (!activeDmFriendId) {
      setDmMessages([]);
      return;
    }
    onClearDmUnread?.(activeDmFriendId);
    api.getDirectMessages(activeDmFriendId).then((res) => setDmMessages(res.messages));
  }, [activeDmFriendId]);

  useEffect(() => {
    if (!incomingWsMessage || !activeDmFriendId || !incomingWsMessage.dmKey) return;
    const expectedKey = [currentUser.id, activeDmFriendId].sort().join('__');
    if (incomingWsMessage.dmKey === expectedKey) {
      setDmMessages((prev) => {
        if (prev.some((m) => m.id === incomingWsMessage.id)) return prev;
        return [...prev, incomingWsMessage];
      });
    }
  }, [incomingWsMessage, activeDmFriendId, currentUser.id]);

  useEffect(() => {
    if (!incomingWsUpdatedMessage) return;
    setDmMessages((prev) =>
      prev.map((m) => (m.id === incomingWsUpdatedMessage.id ? incomingWsUpdatedMessage : m))
    );
  }, [incomingWsUpdatedMessage]);

  useEffect(() => {
    if (!incomingWsDeletedMessageId) return;
    setDmMessages((prev) => prev.filter((m) => m.id !== incomingWsDeletedMessageId));
  }, [incomingWsDeletedMessageId]);

  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages.length]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    setSubmittingReq(true);
    try {
      await onSendFriendRequest(addInput.trim());
      setAddInput('');
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleSendDm = async (payload: {
    content: string;
    attachmentFile?: File | null;
    replyToMessageId?: string;
    audioDurationSec?: number;
  }) => {
    if (!activeDmFriendId) return;
    const res = await api.sendDirectMessage(activeDmFriendId, payload);
    setDmMessages((prev) => {
      if (prev.some((m) => m.id === res.message.id)) return prev;
      return [...prev, res.message];
    });
    onDmSent?.(activeDmFriendId, res.message);
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    const res = await api.editMessage(messageId, content);
    setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify('Message edited.');
  };

  const handleDeleteMessage = async (messageId: string) => {
    await api.deleteMessage(messageId);
    setDmMessages((prev) => prev.filter((m) => m.id !== messageId));
    onNotify('Message deleted.');
  };

  const handleReactMessage = async (messageId: string, emoji: string) => {
    const res = await api.reactMessage(messageId, emoji);
    setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
  };

  const handlePinMessage = async (messageId: string) => {
    const res = await api.pinMessage(messageId);
    setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify(res.message.pinned ? 'Message pinned.' : 'Message unpinned.');
  };

  const handleBookmarkMessage = async (messageId: string) => {
    const res = await api.bookmarkMessage(messageId);
    setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    onNotify(res.bookmarked ? 'Message bookmarked.' : 'Bookmark removed.');
  };

  const pinnedMessages = dmMessages.filter((m) => m.pinned);
  const bookmarkedMessages = dmMessages.filter((m) =>
    (m.bookmarkedByUserIds || []).includes(currentUser.id)
  );

  const activeFriendStatus = activeFriend
    ? getEffectiveStatus(activeFriend, onlineUserIds, currentUser.id)
    : 'offline';

  if (activeFriend) {
    return (
      <div className="bg-white dark:bg-zinc-900 flex flex-col h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-4rem)] min-h-[420px] w-full overflow-hidden transition-colors">
        {/* Full-Page Discord-Style DM Header */}
        <div className="h-14 px-3 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 sm:gap-3 shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveDmFriendId(null)}
              aria-label="Back to Friends"
              title="Back to Friends"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0 lg:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenProfile(activeFriend.id)}
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
            >
              <div className="relative shrink-0">
                <img
                  src={activeFriend.avatarUrl}
                  alt={activeFriend.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = makeInitialsAvatar(activeFriend.name);
                  }}
                  className={`w-8 h-8 rounded-full object-cover ${
                    activeFriend.isStreaming || streamingUserIds?.has(activeFriend.id)
                      ? 'ring-2 ring-red-500 border border-zinc-950'
                      : 'border border-zinc-200 dark:border-zinc-700'
                  }`}
                />
                {activeFriend.isStreaming || streamingUserIds?.has(activeFriend.id) ? (
                  <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-red-600 text-white text-[8px] font-extrabold border border-white dark:border-zinc-900">
                    LIVE
                  </span>
                ) : (
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <StatusBadge status={activeFriendStatus} size="sm" />
                  </span>
                )}
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50 truncate">
                  {activeFriend.name}
                </p>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  {activeFriend.tag} ·{' '}
                  {activeFriend.isStreaming || streamingUserIds?.has(activeFriend.id) ? (
                    <span className="text-red-500 font-sans font-semibold">Live Streaming</span>
                  ) : activeFriendStatus === 'dnd' ? (
                    'Do Not Disturb'
                  ) : (
                    activeFriendStatus.charAt(0).toUpperCase() + activeFriendStatus.slice(1)
                  )}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setDrawerMode((prev) => (prev === 'pinned' ? 'none' : 'pinned'))
              }
              title="Pinned Messages"
              className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 border cursor-pointer ${
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
              title="Bookmarked Messages"
              className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 border cursor-pointer ${
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

            <button
              type="button"
              onClick={() => setActiveDmFriendId(null)}
              title="Open Friends List"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Friends</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onReport({
                  targetType: 'user',
                  targetId: activeFriend.id,
                  targetUserId: activeFriend.id,
                  targetUserName: activeFriend.name,
                })
              }
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 flex items-center gap-1 cursor-pointer pl-1"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>
        </div>

        {/* Pinned / Bookmarked Drawer */}
        {drawerMode !== 'none' && (
          <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5 max-h-52 overflow-y-auto space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                {drawerMode === 'pinned'
                  ? `Pinned Messages (${pinnedMessages.length})`
                  : `Bookmarked Messages (${bookmarkedMessages.length})`}
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
              <p className="text-xs text-zinc-500 py-1">
                No {drawerMode === 'pinned' ? 'pinned' : 'bookmarked'} messages yet.
              </p>
            ) : (
              (drawerMode === 'pinned' ? pinnedMessages : bookmarkedMessages).map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-950 dark:text-zinc-100">
                      {item.authorName}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400 truncate">
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

        {/* Full-Page Scrollable Message History */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-2">
          <div className="pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3.5">
            <img
              src={activeFriend.avatarUrl}
              alt={activeFriend.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = makeInitialsAvatar(activeFriend.name);
              }}
              className="w-14 h-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-zinc-50 truncate">
                {activeFriend.name}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This is the beginning of your direct message history with{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  @{activeFriend.name}
                </span>
                .
              </p>
            </div>
          </div>

          {dmMessages.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
              Say hello to {activeFriend.name} — send messages, images, videos, GIFs, or voice notes below.
            </p>
          ) : (
            dmMessages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                currentUserId={currentUser.id}
                isAuthorStreaming={Boolean(streamingUserIds?.has(m.authorId))}
                canManageMessages={false}
                canPinMessages={true}
                canAddReactions={true}
                isUnreadStart={unreadMarkerMessageId === m.id}
                onOpenProfile={onOpenProfile}
                onReply={(msg) => setReplyTarget(msg)}
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
                onReport={(msg) =>
                  onReport({
                    targetType: 'message',
                    targetId: msg.id,
                    targetUserId: msg.authorId,
                    targetUserName: msg.authorName,
                  })
                }
              />
            ))
          )}
          <div ref={dmBottomRef} />
        </div>

        <ChatComposer
          placeholder={`Message @${activeFriend.name}...`}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          canAttachFiles={true}
          onSend={handleSendDm}
          onError={onNotify}
        />
      </div>
    );
  }

  return (
    <div className="pilgrim-stack">
      {/* Add Friend Card */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-zinc-950 dark:text-zinc-50">
              Add Friend
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              You can add friends with their ArkLine gamer tag (e.g.{' '}
              <span className="font-mono text-zinc-800 dark:text-zinc-200">KitsuneDrift#0419</span>) or email address. Your tag is{' '}
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {currentUser.tag}
              </span>
              .
            </p>
          </div>

          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="Enter GamerTag#0000 or email"
              className="flex-1 md:w-64 px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
            />
            <button
              type="submit"
              disabled={submittingReq || !addInput.trim()}
              className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Send Request</span>
            </button>
          </form>
        </div>
      </section>

      {/* Full-Width Friends, Pending & Discover Directory */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-colors">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Friends ({friendsData.friends.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'pending'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Pending ({friendsData.incomingRequests.length + friendsData.outgoingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('discover')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'discover'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Discover
          </button>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[600px] overflow-y-auto">
          {tab === 'all' &&
            (friendsData.friends.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No friends added yet. Check the Discover tab or send a request above!
              </div>
            ) : (
              friendsData.friends.map((friend) => {
                const effStatus = getEffectiveStatus(friend, onlineUserIds, currentUser.id);
                return (
                  <div
                    key={friend.id}
                    className="p-3.5 flex items-center justify-between gap-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(friend.id)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={friend.avatarUrl}
                          alt={friend.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = makeInitialsAvatar(friend.name);
                          }}
                          className={`w-9 h-9 rounded-full object-cover ${
                            friend.isStreaming || streamingUserIds?.has(friend.id)
                              ? 'ring-2 ring-red-500 border border-zinc-950'
                              : 'border border-zinc-200 dark:border-zinc-700'
                          }`}
                        />
                        {friend.isStreaming || streamingUserIds?.has(friend.id) ? (
                          <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-red-600 text-white text-[8px] font-extrabold border border-white dark:border-zinc-900">
                            LIVE
                          </span>
                        ) : (
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <StatusBadge status={effStatus} size="sm" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                          {friend.name}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                          {friend.isStreaming || streamingUserIds?.has(friend.id) ? (
                            <span className="text-red-500 font-sans font-semibold">Live Streaming</span>
                          ) : (
                            <>
                              {friend.tag} ·{' '}
                              {effStatus === 'dnd'
                                ? 'Do Not Disturb'
                                : effStatus.charAt(0).toUpperCase() + effStatus.slice(1)}
                            </>
                          )}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDmFriendId(friend.id);
                          onClearDmUnread?.(friend.id);
                        }}
                        title="Open Direct Message"
                        className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg cursor-pointer relative flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Message</span>
                        {(unreadDmByFriendId[friend.id] || 0) > 0 && (
                          <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                            {unreadDmByFriendId[friend.id]}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onReport({
                            targetType: 'user',
                            targetId: friend.id,
                            targetUserId: friend.id,
                            targetUserName: friend.name,
                          })
                        }
                        title="Report user"
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFriend(friend.id)}
                        title="Remove friend"
                        className="p-2 text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-700 rounded-lg cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ))}

          {tab === 'pending' && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {friendsData.incomingRequests.length === 0 &&
              friendsData.outgoingRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No pending friend requests.
                </div>
              ) : (
                <>
                  {friendsData.incomingRequests.map((req) => (
                    <div key={req.id} className="p-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={req.user.avatarUrl}
                          alt={req.user.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = makeInitialsAvatar(req.user.name);
                          }}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                            {req.user.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Incoming request · {req.user.tag}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRespondRequest(req.id, 'accept')}
                          className="p-1.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                          title="Accept"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondRequest(req.id, 'decline')}
                          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                          title="Decline"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {friendsData.outgoingRequests.map((req) => (
                    <div key={req.id} className="p-3.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={req.user.avatarUrl}
                          alt={req.user.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = makeInitialsAvatar(req.user.name);
                          }}
                          className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                            {req.user.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Outgoing · {req.user.tag}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Pending
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === 'discover' &&
            (friendsData.discoverPlayers.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                You have connected with everyone currently on ArkLine!
              </div>
            ) : (
              friendsData.discoverPlayers.map((p) => (
                <div key={p.id} className="p-3.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(p.id)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <img
                      src={p.avatarUrl}
                      alt={p.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = makeInitialsAvatar(p.name);
                      }}
                      className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-950 dark:text-zinc-50 truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                        {p.tag}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDmFriendId(p.id);
                        onClearDmUnread?.(p.id);
                      }}
                      title="Direct Message"
                      className="py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      Message
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendFriendRequest(p.tag)}
                      className="py-1.5 px-3 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      Add Friend
                    </button>
                  </div>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
};

