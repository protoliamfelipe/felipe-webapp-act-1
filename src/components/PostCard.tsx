import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  MessageCircle,
  Share2,
  Flag,
  Trash2,
  Globe,
  Users,
  Lock,
  Send,
  CornerDownRight,
  Pencil,
  SmilePlus,
  MoreHorizontal,
  EyeOff,
  Eye,
  ShieldBan,
  Check,
  X,
} from 'lucide-react';
import { Post, PostComment, User, Visibility } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { makeInitialsAvatar } from '../utils/avatars';

const COMMENT_EMOJIS = ['👍', '❤️', '🔥', '😂', '😮'];

interface PostCardProps {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string, parentCommentId?: string) => Promise<void>;
  onEditComment: (postId: string, commentId: string, content: string) => Promise<void>;
  onReactComment: (postId: string, commentId: string, emoji: string) => Promise<void>;
  onHideComment: (postId: string, commentId: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
  onBlockUser: (userId: string, userName: string) => Promise<void>;
  onShare: (post: Post) => void;
  onChangeVisibility: (postId: string, visibility: Visibility) => void;
  onDeletePost: (postId: string) => void;
  onReport: (target: {
    targetType: 'post' | 'comment';
    targetId: string;
    targetUserId: string;
    targetUserName: string;
  }) => void;
  onOpenProfile: (userId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLike,
  onComment,
  onEditComment,
  onReactComment,
  onHideComment,
  onDeleteComment,
  onBlockUser,
  onShare,
  onChangeVisibility,
  onDeletePost,
  onReport,
  onOpenProfile,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Menus & reaction picker state
  const [reactPickerId, setReactPickerId] = useState<string | null>(null);
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null);

  const isOwner = post.authorId === currentUser.id;
  const isLiked = post.likes.includes(currentUser.id);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      await onComment(post.id, commentText.trim());
      setCommentText('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      await onComment(post.id, replyText.trim(), replyingTo.id);
      setReplyText('');
      setReplyingTo(null);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!editCommentText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await onEditComment(post.id, commentId, editCommentText.trim());
      setEditingCommentId(null);
      setEditCommentText('');
    } finally {
      setSavingEdit(false);
    }
  };

  const renderVisibilityIcon = (vis: Visibility) => {
    if (vis === 'private') return <Lock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
    if (vis === 'friends') return <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
    return <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />;
  };

  const visibilityLabel =
    post.visibility === 'private'
      ? 'Private'
      : post.visibility === 'friends'
      ? 'Friends Only'
      : 'Public';

  // Build comment lookup & flatten nested replies under each top-level comment
  const commentMap = new Map<string, PostComment>();
  for (const c of post.comments) {
    commentMap.set(c.id, c);
  }

  const getRootParentId = (c: PostComment): string => {
    let curr: PostComment | undefined = c;
    const visited = new Set<string>();
    while (curr?.parentCommentId && commentMap.has(curr.parentCommentId) && !visited.has(curr.id)) {
      visited.add(curr.id);
      curr = commentMap.get(curr.parentCommentId);
    }
    return curr?.id || c.id;
  };

  const topLevelComments = post.comments.filter(
    (c) => !c.parentCommentId || !commentMap.has(c.parentCommentId)
  );

  const repliesByRootId = new Map<string, PostComment[]>();
  for (const c of post.comments) {
    if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
      const rootId = getRootParentId(c);
      const list = repliesByRootId.get(rootId) || [];
      list.push(c);
      repliesByRootId.set(rootId, list);
    }
  }

  const renderCommentItem = (c: PostComment, isReply = false) => {
    const isCommentAuthor = c.authorId === currentUser.id;
    const canDeleteCmt = isCommentAuthor || isOwner;
    const isHidden = Boolean(c.hiddenByUserIds?.includes(currentUser.id));
    const isEditing = editingCommentId === c.id;
    const isReplyingHere = replyingTo?.id === c.id;
    const directParent = c.parentCommentId ? commentMap.get(c.parentCommentId) : undefined;
    const reactionEntries = Object.entries(c.reactions || {}).filter(([, uids]) => uids.length > 0);

    if (isHidden) {
      return (
        <div
          key={c.id}
          className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 ${
            isReply ? 'ml-8 sm:ml-10' : ''
          }`}
        >
          <span className="flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5" />
            <span>Comment hidden</span>
          </span>
          <button
            type="button"
            onClick={() => onHideComment(post.id, c.id)}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Unhide</span>
          </button>
        </div>
      );
    }

    return (
      <div key={c.id} className={isReply ? 'ml-8 sm:ml-10' : ''}>
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => onOpenProfile(c.authorId)}
            className="shrink-0 cursor-pointer"
          >
            <img
              src={c.authorAvatar}
              alt={c.authorName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = makeInitialsAvatar(c.authorName);
              }}
              className="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
            />
          </button>

          <div className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs flex-wrap min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenProfile(c.authorId)}
                  className="font-bold text-zinc-950 dark:text-zinc-100 hover:underline cursor-pointer truncate"
                >
                  {c.authorName}
                </button>
                <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">
                  {formatRelativeTime(c.createdAt)}
                </span>
                {c.editedAt && (
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">· edited</span>
                )}
              </div>

              {/* Comment Top-Right Menu & Quick Actions */}
              <div className="flex items-center gap-0.5 shrink-0 relative">
                {isCommentAuthor && !isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(c.id);
                      setEditCommentText(c.content);
                      setMoreMenuId(null);
                      setReactPickerId(null);
                    }}
                    title="Edit comment"
                    className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}

                {canDeleteCmt && (
                  <button
                    type="button"
                    onClick={() => onDeleteComment(post.id, c.id)}
                    title="Delete comment"
                    className="p-1 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuId(moreMenuId === c.id ? null : c.id);
                    setReactPickerId(null);
                  }}
                  title="More options"
                  aria-label="Comment options"
                  className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-md cursor-pointer"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {moreMenuId === c.id && (
                  <div className="absolute right-0 top-7 z-20 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuId(null);
                        onHideComment(post.id, c.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Hide comment</span>
                    </button>

                    {!isCommentAuthor && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuId(null);
                            onBlockUser(c.authorId, c.authorName);
                          }}
                          className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                        >
                          <ShieldBan className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="truncate">Block {c.authorName}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMoreMenuId(null);
                            onReport({
                              targetType: 'comment',
                              targetId: c.id,
                              targetUserId: c.authorId,
                              targetUserName: c.authorName,
                            });
                          }}
                          className="w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Report comment</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Body or Inline Edit Form */}
            {isEditing ? (
              <form onSubmit={(e) => handleEditSubmit(e, c.id)} className="mt-2 space-y-2">
                <input
                  type="text"
                  value={editCommentText}
                  onChange={(e) => setEditCommentText(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditCommentText('');
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!editCommentText.trim() || savingEdit}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-md flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>{savingEdit ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed break-words">
                {isReply && directParent && directParent.parentCommentId && (
                  <span className="font-semibold text-zinc-950 dark:text-zinc-100 mr-1.5">
                    @{directParent.authorName}
                  </span>
                )}
                {c.content}
              </p>
            )}

            {/* Reactions & Reply Action Bar */}
            {!isEditing && (
              <div className="mt-2 flex items-center flex-wrap gap-1.5 relative">
                {reactionEntries.map(([emoji, userIds]) => {
                  const reacted = userIds.includes(currentUser.id);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReactComment(post.id, c.id, emoji)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono tabular-nums flex items-center gap-1 border transition-colors cursor-pointer ${
                        reacted
                          ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                          : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{userIds.length}</span>
                    </button>
                  );
                })}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setReactPickerId(reactPickerId === c.id ? null : c.id);
                      setMoreMenuId(null);
                    }}
                    className="px-1.5 py-0.5 rounded-md text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                    title="React to comment"
                  >
                    <SmilePlus className="w-3.5 h-3.5" />
                    <span>React</span>
                  </button>

                  {reactPickerId === c.id && (
                    <div className="absolute left-0 bottom-7 z-20 flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg">
                      {COMMENT_EMOJIS.map((emoji) => {
                        const active = Boolean(c.reactions?.[emoji]?.includes(currentUser.id));
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setReactPickerId(null);
                              onReactComment(post.id, c.id, emoji);
                            }}
                            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors cursor-pointer ${
                              active
                                ? 'bg-zinc-200 dark:bg-zinc-700'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isReplyingHere) {
                      setReplyingTo(null);
                      setReplyText('');
                    } else {
                      setReplyingTo(c);
                      setReplyText('');
                    }
                    setReactPickerId(null);
                    setMoreMenuId(null);
                  }}
                  className="px-1.5 py-0.5 rounded-md text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
                >
                  <CornerDownRight className="w-3 h-3" />
                  <span>Reply</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Reply Form */}
        {isReplyingHere && (
          <form
            onSubmit={handleReplySubmit}
            className="mt-2 ml-9 flex items-center gap-2"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${c.authorName}...`}
              autoFocus
              className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            />
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setReplyText('');
              }}
              className="py-1.5 px-2.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!replyText.trim() || submittingReply}
              className="py-1.5 px-3 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Reply</span>
            </button>
          </form>
        )}
      </div>
    );
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-colors"
    >
      {/* Card Header */}
      <div className="pilgrim-card-pad pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenProfile(post.authorId)}
            className="shrink-0 cursor-pointer"
          >
            <img
              src={post.authorAvatar}
              alt={post.authorName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = makeInitialsAvatar(post.authorName);
              }}
              className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
            />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenProfile(post.authorId)}
                className="text-sm font-bold text-zinc-950 dark:text-zinc-50 hover:underline truncate cursor-pointer"
              >
                {post.authorName}
              </button>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {post.authorTag}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span aria-hidden="true">·</span>
              {isOwner ? (
                <label className="inline-flex items-center gap-1 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100">
                  {renderVisibilityIcon(post.visibility)}
                  <select
                    value={post.visibility}
                    onChange={(e) => onChangeVisibility(post.id, e.target.value as Visibility)}
                    aria-label="Post visibility"
                    className="bg-transparent dark:bg-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300 focus:outline-none cursor-pointer"
                  >
                    <option value="public">Public</option>
                    <option value="friends">Friends Only</option>
                    <option value="private">Private</option>
                  </select>
                </label>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {renderVisibilityIcon(post.visibility)}
                  <span>{visibilityLabel}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top-Right Safety / Owner Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isOwner ? (
            <button
              type="button"
              onClick={() => onDeletePost(post.id)}
              title="Delete post"
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onReport({
                  targetType: 'post',
                  targetId: post.id,
                  targetUserId: post.authorId,
                  targetUserName: post.authorName,
                })
              }
              title="Report post or bad actor"
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="pilgrim-card-pad pt-0 pb-4 space-y-3">
        {post.title && (
          <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-zinc-50 leading-snug">
            {post.title}
          </h3>
        )}
        {post.content && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
            {post.content}
          </p>
        )}

        {/* Media Display (Video or Image) */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
            <img
              src={post.mediaUrl}
              alt={post.title || 'Post image'}
              referrerPolicy="no-referrer"
              className="w-full max-h-[480px] object-cover"
            />
          </div>
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
            <video
              src={post.mediaUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[480px]"
            />
          </div>
        )}
      </div>

      {/* Engagement Footer */}
      <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-950/40">
        <div className="flex items-center gap-2 sm:gap-4">
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => onLike(post.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLiked
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="font-mono tabular-nums">{post.likes.length}</span>
            <span className="hidden sm:inline">Like</span>
          </motion.button>

          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-mono tabular-nums">{post.comments.length}</span>
            <span className="hidden sm:inline">Comment</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(post)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span className="font-mono tabular-nums">{post.sharesCount}</span>
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Expandable Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60"
          >
            <div className="pilgrim-card-pad space-y-4">
              {/* Add Top-Level Comment Input */}
              <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="py-2 px-3.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </form>

              {/* Threaded Comments List */}
              {topLevelComments.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No comments yet. Start the conversation!
                </p>
              ) : (
                <div className="space-y-3">
                  {topLevelComments.map((rootComment) => {
                    const replies = repliesByRootId.get(rootComment.id) || [];
                    return (
                      <div key={rootComment.id} className="space-y-2">
                        {renderCommentItem(rootComment, false)}
                        {replies.map((reply) => renderCommentItem(reply, true))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
