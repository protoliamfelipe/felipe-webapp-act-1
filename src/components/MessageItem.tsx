import React, { useState, useRef, useEffect } from 'react';
import {
  SmilePlus,
  Reply,
  Forward,
  Copy,
  Pin,
  Bookmark,
  Clock,
  MessageSquareDot,
  Link2,
  Volume2,
  Flag,
  Trash2,
  Edit3,
  MoreHorizontal,
  Play,
  Pause,
  Check,
  X,
  ChevronRight,
  Hash,
} from 'lucide-react';
import { ChatMessage, ServerRole } from '../types';
import { formatTimeOnly } from '../utils/formatters';
import { makeInitialsAvatar } from '../utils/avatars';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎮', '👏', '😮', '✅'];

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  authorRoles?: ServerRole[];
  canManageMessages?: boolean;
  canPinMessages?: boolean;
  canAddReactions?: boolean;
  isUnreadStart?: boolean;
  onOpenProfile: (userId: string) => void;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onPin: (messageId: string) => Promise<void>;
  onBookmark: (messageId: string) => Promise<void>;
  onMarkUnread: (messageId: string) => void;
  onCreateReminder: (message: ChatMessage, minutes: number) => void;
  onSpeak: (message: ChatMessage) => void;
  onCopySuccess: (label: string) => void;
  onReport: (message: ChatMessage) => void;
}

function formatAudioSeconds(sec?: number): string {
  const total = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  authorRoles = [],
  canManageMessages = false,
  canPinMessages = true,
  canAddReactions = true,
  isUnreadStart = false,
  onOpenProfile,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onBookmark,
  onMarkUnread,
  onCreateReminder,
  onSpeak,
  onCopySuccess,
  onReport,
}) => {
  const isMe = message.authorId === currentUserId;
  const isBookmarked = (message.bookmarkedByUserIds || []).includes(currentUserId);
  const canDelete = isMe || canManageMessages;
  const canPin = isMe || canPinMessages || canManageMessages;

  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const [reminderSubOpen, setReminderSubOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Voice message playback state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(message.audioDurationSec || 0);

  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setEmojiMenuOpen(false);
        setReminderSubOpen(false);
      }
    };
    if (menuOpen || emojiMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen, emojiMenuOpen]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft.trim()) return;
    setSavingEdit(true);
    try {
      await onEdit(message.id, editDraft.trim());
      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      audio.play().catch(() => {});
      setIsPlayingAudio(true);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content || message.attachmentUrl || '');
    onCopySuccess('Message text copied.');
    setMenuOpen(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?message=${encodeURIComponent(message.id)}`;
    navigator.clipboard.writeText(url);
    onCopySuccess('Message link copied.');
    setMenuOpen(false);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(message.id);
    onCopySuccess('Message ID copied.');
    setMenuOpen(false);
  };

  const reactionEntries = Object.entries(message.reactions || {}).filter(
    ([, users]) => users.length > 0
  );

  const topRole = authorRoles[0];

  return (
    <div id={`msg-${message.id}`}>
      {isUnreadStart && (
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-red-500/70" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
            New Unread
          </span>
          <div className="flex-1 h-px bg-red-500/70" />
        </div>
      )}

      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
          setEmojiMenuOpen(false);
        }}
        className={`relative flex items-start gap-3 group rounded-xl px-2.5 py-2 -mx-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/45 ${
          message.pinned ? 'bg-zinc-50/90 dark:bg-zinc-800/35' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenProfile(message.authorId)}
          className="shrink-0 cursor-pointer mt-0.5"
        >
          <img
            src={message.authorAvatar}
            alt={message.authorName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = makeInitialsAvatar(message.authorName);
            }}
            className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
          />
        </button>

        <div className="flex-1 min-w-0">
          {/* Quoted Reply Preview */}
          {message.replyPreview && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
              <Reply className="w-3 h-3 shrink-0" />
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {message.replyPreview.authorName}
              </span>
              <span className="truncate max-w-xs">
                {message.replyPreview.content || '[Attachment]'}
              </span>
            </div>
          )}

          {/* Forwarded Tag */}
          {message.forwardedFrom && (
            <div className="flex items-center gap-1 text-[11px] italic text-zinc-500 dark:text-zinc-400 mb-0.5">
              <Forward className="w-3 h-3" />
              <span>Forwarded from {message.forwardedFrom.authorName}</span>
            </div>
          )}

          {/* Author Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenProfile(message.authorId)}
              className="text-xs font-bold text-zinc-950 dark:text-zinc-50 hover:underline cursor-pointer"
            >
              {message.authorName}
            </button>
            {topRole && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300/70 dark:border-zinc-700"
                style={
                  topRole.color && topRole.color !== '#fafafa'
                    ? { borderColor: topRole.color }
                    : undefined
                }
              >
                {topRole.name}
              </span>
            )}
            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              {message.authorTag}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
              {formatTimeOnly(message.createdAt)}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">(edited)</span>
            )}
            {message.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                <Pin className="w-2.5 h-2.5" />
                Pinned
              </span>
            )}
            {isBookmarked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                <Bookmark className="w-2.5 h-2.5 fill-current" />
                Saved
              </span>
            )}
          </div>

          {/* Inline Edit or Body Text */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
              <button
                type="submit"
                disabled={savingEdit || !editDraft.trim()}
                className="p-1.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg cursor-pointer"
                title="Save edit"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditDraft(message.content);
                }}
                className="p-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg cursor-pointer"
                title="Cancel edit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            message.content && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed break-words">
                {message.content}
              </p>
            )
          )}

          {/* Image / Animated GIF Attachment */}
          {message.attachmentUrl && message.attachmentType === 'image' && (
            <div className="mt-2 max-w-sm">
              <img
                src={message.attachmentUrl}
                alt={message.attachmentName || 'Chat attachment'}
                onClick={() => setLightboxOpen(true)}
                className="max-h-72 rounded-xl border border-zinc-200 dark:border-zinc-800 object-contain bg-zinc-100 dark:bg-zinc-950 cursor-zoom-in"
              />
            </div>
          )}

          {/* Voice Message Audio Clip Player */}
          {message.attachmentUrl && message.attachmentType === 'audio' && (
            <div className="mt-2 max-w-xs p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <audio
                ref={audioRef}
                src={message.attachmentUrl}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d) && d > 0) setAudioDuration(d);
                }}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (el.duration > 0) {
                    setAudioProgress((el.currentTime / el.duration) * 100);
                  }
                }}
                onEnded={() => {
                  setIsPlayingAudio(false);
                  setAudioProgress(0);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleToggleAudio}
                className="w-8 h-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={isPlayingAudio ? 'Pause voice message' : 'Play voice message'}
              >
                {isPlayingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 dark:bg-white transition-all"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  <span>Voice Message</span>
                  <span>{formatAudioSeconds(audioDuration)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shared Post Preview */}
          {message.sharedPostPreview && (
            <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md space-y-2">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Shared post from {message.sharedPostPreview.authorName}
              </p>
              {message.sharedPostPreview.title && (
                <p className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
                  {message.sharedPostPreview.title}
                </p>
              )}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {message.sharedPostPreview.content}
              </p>
              {message.sharedPostPreview.mediaUrl && message.sharedPostPreview.mediaType === 'image' && (
                <img
                  src={message.sharedPostPreview.mediaUrl}
                  alt="Shared attachment"
                  className="w-full h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              )}
            </div>
          )}

          {/* Reactions Row */}
          {reactionEntries.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {reactionEntries.map(([emoji, userIds]) => {
                const reactedByMe = userIds.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={!canAddReactions}
                    onClick={() => onReact(message.id, emoji)}
                    className={`px-2 py-0.5 rounded-lg text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                      reactedByMe
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="font-mono text-[11px] tabular-nums">{userIds.length}</span>
                  </button>
                );
              })}
              {canAddReactions && (
                <button
                  type="button"
                  onClick={() => {
                    setEmojiMenuOpen((v) => !v);
                    setMenuOpen(false);
                  }}
                  className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                  title="Add reaction"
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Hover Quick Action Toolbar + Context Menu Popover */}
        <div
          ref={menuContainerRef}
          className={`relative shrink-0 flex items-center gap-0.5 ${
            menuOpen || emojiMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity`}
        >
          {canAddReactions && (
            <button
              type="button"
              onClick={() => {
                setEmojiMenuOpen((v) => !v);
                setMenuOpen(false);
              }}
              title="Add Reaction"
              className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Reply"
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen((v) => !v);
              setEmojiMenuOpen(false);
            }}
            title="More actions"
            className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Quick Emoji Picker */}
          {emojiMenuOpen && (
            <div className="absolute right-0 top-9 z-40 bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 flex items-center gap-1">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    onReact(message.id, em);
                    setEmojiMenuOpen(false);
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-sm cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Full Discord-style Message Action Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-9 z-50 w-56 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl shadow-2xl py-1.5 text-xs">
              {canAddReactions && (
                <div className="px-2 pb-1.5 mb-1 border-b border-zinc-800">
                  <div className="flex items-center justify-between px-1.5 py-1 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <SmilePlus className="w-3.5 h-3.5" />
                      Add Reaction
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-0.5 mt-1">
                    {QUICK_EMOJIS.slice(0, 6).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => {
                          onReact(message.id, em);
                          setMenuOpen(false);
                        }}
                        className="flex-1 py-1 rounded-lg hover:bg-zinc-800 text-center cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isMe && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDraft(message.content);
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Edit Message</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onReply(message);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Reply className="w-3.5 h-3.5 text-zinc-400" />
                <span>Reply</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onForward(message);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Forward className="w-3.5 h-3.5 text-zinc-400" />
                <span>Forward</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />

              <button
                type="button"
                onClick={handleCopyText}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Text</span>
              </button>

              {canPin && (
                <button
                  type="button"
                  onClick={() => {
                    onPin(message.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{message.pinned ? 'Unpin Message' : 'Pin Message'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onBookmark(message.id);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Message'}</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setReminderSubOpen((v) => !v)}
                  className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Create Reminder</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>

                {reminderSubOpen && (
                  <div className="mx-2 my-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg space-y-0.5">
                    {[
                      { label: 'In 5 minutes', mins: 5 },
                      { label: 'In 15 minutes', mins: 15 },
                      { label: 'In 1 hour', mins: 60 },
                    ].map((opt) => (
                      <button
                        key={opt.mins}
                        type="button"
                        onClick={() => {
                          onCreateReminder(message, opt.mins);
                          setMenuOpen(false);
                          setReminderSubOpen(false);
                        }}
                        className="w-full px-2.5 py-1 rounded hover:bg-zinc-800 text-left text-[11px] text-zinc-200 cursor-pointer"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onMarkUnread(message.id);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <MessageSquareDot className="w-3.5 h-3.5 text-zinc-400" />
                <span>Mark Unread</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Message Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSpeak(message);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Speak Message</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />

              {!isMe && (
                <button
                  type="button"
                  onClick={() => {
                    onReport(message);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-red-950/60 text-red-400 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report Message</span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(message.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-red-950/60 text-red-400 flex items-center gap-2.5 text-left cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Message</span>
                </button>
              )}

              <div className="my-1 border-t border-zinc-800" />

              <button
                type="button"
                onClick={handleCopyId}
                className="w-full px-3 py-1.5 hover:bg-zinc-800 flex items-center gap-2.5 text-left text-zinc-400 cursor-pointer"
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Copy Message ID</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image / GIF Lightbox Preview */}
      {lightboxOpen && message.attachmentUrl && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={message.attachmentUrl}
            alt={message.attachmentName || 'Attachment'}
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
