import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Copy, Check, Hash, Send } from 'lucide-react';
import { Post, Server } from '../types';
import { api } from '../services/api';

interface SharePostModalProps {
  post: Post | null;
  servers: Array<Server & { isMember: boolean }>;
  onClose: () => void;
  onShared: (postId: string, newCount: number) => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  post,
  servers,
  onClose,
  onShared,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState(
    servers.find((s) => s.isMember)?.id || ''
  );
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);

  if (!post) return null;

  const joinedServers = servers.filter((s) => s.isMember);
  const shareUrl = `${window.location.origin}/?post=${post.id}`;

  const handleCopy = async () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    const res = await api.sharePost(post.id);
    onShared(post.id, res.sharesCount);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShareToServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const srv = joinedServers.find((s) => s.id === selectedServerId);
    if (!srv || !srv.channels[0]) return;
    setSharing(true);
    try {
      await api.sendServerMessage(srv.id, {
        channelId: srv.channels[0].id,
        content: note.trim() || `Check out this post from ${post.authorName}`,
        sharedPostId: post.id,
      });
      onShared(post.id, (post.sharesCount || 0) + 1);
      onClose();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-zinc-50">
            Share Post
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Copy Link */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Direct Link
          </label>
          <div className="flex items-center gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent px-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="py-1.5 px-3 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Share directly to a Pilgrim Server */}
        {joinedServers.length > 0 && (
          <form
            onSubmit={handleShareToServer}
            className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3"
          >
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Share to a Pilgrim Server
            </label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
            >
              {joinedServers.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.channels[0]?.name || 'general'} — {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an optional comment..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={sharing}
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Hash className="w-3.5 h-3.5" />
              <span>{sharing ? 'Sharing...' : 'Send to Server Channel'}</span>
              <Send className="w-3 h-3 ml-0.5" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
