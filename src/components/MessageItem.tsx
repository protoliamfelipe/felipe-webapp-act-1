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
  ExternalLink,
} from 'lucide-react';
import { ChatMessage, CustomEmoji, ServerRole } from '../types';
import { formatTimeOnly } from '../utils/formatters';
import { makeInitialsAvatar } from '../utils/avatars';
import { parseCustomEmojiReaction } from '../utils/emojiMedia';
import { EmojiPicker } from './EmojiPicker';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎮', '👏', '😮', '✅'];

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  isAuthorStreaming?: boolean;
  authorRoles?: ServerRole[];
  customEmojis?: CustomEmoji[];
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

interface ParsedEmbed {
  type: 'youtube' | 'spotify' | 'link';
  url: string;
  embedUrl?: string;
  domain: string;
}

function extractEmbedsFromText(text: string): ParsedEmbed[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>()]+/gi) || [];
  const seen = new Set<string>();
  const results: ParsedEmbed[] = [];

  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[.,!?;:]+$/, '');
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);
    try {
      const u = new URL(cleanUrl);
      const host = u.hostname.replace(/^www\./, '').toLowerCase();

      // YouTube embed detection
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
        let videoId = '';
        if (host === 'youtu.be') {
          videoId = u.pathname.split('/').filter(Boolean)[0] || '';
        } else if (u.pathname.startsWith('/shorts/')) {
          videoId = u.pathname.split('/')[2] || '';
        } else {
          videoId = u.searchParams.get('v') || '';
        }
        if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
          results.push({
            type: 'youtube',
            url: cleanUrl,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
            domain: 'youtube.com',
          });
          continue;
        }
      }

      // Spotify embed detection
      if (host === 'open.spotify.com') {
        const spMatch = /^\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/.exec(u.pathname);
        if (spMatch) {
          results.push({
            type: 'spotify',
            url: cleanUrl,
            embedUrl: `https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}?theme=0`,
            domain: 'open.spotify.com',
          });
          continue;
        }
      }

      results.push({
        type: 'link',
        url: cleanUrl,
        domain: host,
      });
    } catch {
      // Ignore invalid URL
    }
    if (results.length >= 2) break;
  }
  return results;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  isAuthorStreaming = false,
  authorRoles = [],
  customEmojis = [],
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
          className="shrink-0 cursor-pointer mt-0.5 relative"
        >
          <img
            src={message.authorAvatar}
            alt={message.authorName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = makeInitialsAvatar(message.authorName);
            }}
            className={`w-9 h-9 rounded-full object-cover ${
              isAuthorStreaming
                ? 'ring-2 ring-red-500 border border-zinc-950'
                : 'border border-zinc-200 dark:border-zinc-700'
            }`}
          />
          {isAuthorStreaming && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded-full bg-red-600 text-white text-[8px] font-extrabold border border-white dark:border-zinc-900">
              LIVE
            </span>
          )}
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
            message.content && (() => {
              const emojiMap = new Map<string, CustomEmoji>();
              for (const ce of customEmojis) {
                emojiMap.set(ce.name.toLowerCase(), ce);
              }
              const tokens = message.content.split(/(https?:\/\/[^\s]+|:[a-zA-Z0-9_]+:)/g);
              const onlyCustom =
                tokens.filter((t) => t.trim().length > 0).length > 0 &&
                tokens
                  .filter((t) => t.trim().length > 0)
                  .every((t) => {
                    const m = /^:([a-zA-Z0-9_]+):$/.exec(t);
                    return Boolean(m && emojiMap.has(m[1].toLowerCase()));
                  });
              const embeds = extractEmbedsFromText(message.content);

              return (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed break-words">
                    {tokens.map((part, idx) => {
                      if (/^https?:\/\/[^\s]+$/i.test(part)) {
                        return (
                          <a
                            key={idx}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                          >
                            {part}
                          </a>
                        );
                      }
                      const scMatch = /^:([a-zA-Z0-9_]+):$/.exec(part);
                      if (scMatch) {
                        const found = emojiMap.get(scMatch[1].toLowerCase());
                        if (found) {
                          return (
                            <img
                              key={idx}
                              src={found.url}
                              alt={part}
                              title={part}
                              className={`inline-block align-middle object-contain mx-0.5 ${
                                onlyCustom ? 'w-10 h-10' : 'w-5 h-5'
                              }`}
                            />
                          );
                        }
                      }
                      return <React.Fragment key={idx}>{part}</React.Fragment>;
                    })}
                  </p>

                  {embeds.map((emb) => {
                    if (emb.type === 'youtube' && emb.embedUrl) {
                      return (
                        <div
                          key={emb.url}
                          className="max-w-md rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950"
                        >
                          <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-300">
                            <span className="font-semibold">YouTube Embed</span>
                            <a
                              href={emb.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-white flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open</span>
                            </a>
                          </div>
                          <div className="aspect-video w-full">
                            <iframe
                              src={emb.embedUrl}
                              title="YouTube video player"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          </div>
                        </div>
                      );
                    }
                    if (emb.type === 'spotify' && emb.embedUrl) {
                      return (
                        <div
                          key={emb.url}
                          className="max-w-md rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950"
                        >
                          <iframe
                            src={emb.embedUrl}
                            title="Spotify embed"
                            height="152"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="w-full border-0"
                          />
                        </div>
                      );
                    }
                    return (
                      <a
                        key={emb.url}
                        href={emb.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-md flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {emb.domain}
                          </p>
                          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                            {emb.url}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              );
            })()
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

          {/* Video Attachment */}
          {message.attachmentUrl && message.attachmentType === 'video' && (
            <div className="mt-2 max-w-md rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
              <video
                src={message.attachmentUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-80 w-full bg-black"
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
                const parsedCustom = parseCustomEmojiReaction(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={!canAddReactions}
                    onClick={() => onReact(message.id, emoji)}
                    title={parsedCustom ? `:${parsedCustom.name}:` : emoji}
                    className={`px-2 py-0.5 rounded-lg text-xs flex items-center gap-1 border transition-colors cursor-pointer ${
                      reactedByMe
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {parsedCustom ? (
                      <img
                        src={parsedCustom.url}
                        alt={`:${parsedCustom.name}:`}
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <span>{emoji}</span>
                    )}
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

          {/* Full Upward-Opening Emoji Picker */}
          {emojiMenuOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 z-50">
              <EmojiPicker
                customEmojis={customEmojis}
                onSelectEmoji={(tok) => {
                  onReact(message.id, tok);
                  setEmojiMenuOpen(false);
                }}
                onClose={() => setEmojiMenuOpen(false)}
              />
            </div>
          )}

          {/* Full Discord-style Upward-Opening Message Action Menu */}
          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 z-50 w-56 max-h-[65vh] overflow-y-auto bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl shadow-2xl py-1.5 text-xs">
              {canAddReactions && (
                <div className="px-2 pb-1.5 mb-1 border-b border-zinc-800">
                  <div className="flex items-center justify-between px-1.5 py-1 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <SmilePlus className="w-3.5 h-3.5" />
                      Add Reaction
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEmojiMenuOpen(true);
                      }}
                      title="Open all emojis"
                      className="text-[11px] font-bold text-zinc-300 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 cursor-pointer"
                    >
                      + More
                    </button>
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
