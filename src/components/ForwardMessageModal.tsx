import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Forward, Hash, User as UserIcon } from 'lucide-react';
import { ChatMessage, Server, User } from '../types';
import { api } from '../services/api';

interface ForwardMessageModalProps {
  message: ChatMessage | null;
  servers: Array<Server & { isMember: boolean }>;
  friends: User[];
  onClose: () => void;
  onForwarded: (destLabel: string) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  message,
  servers,
  friends,
  onClose,
  onForwarded,
}) => {
  const joinedServers = servers.filter((s) => s.isMember);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  if (!message) return null;

  const forwardText =
    message.content ||
    (message.attachmentUrl ? `[Shared ${message.attachmentType || 'attachment'}]: ${message.attachmentUrl}` : 'Forwarded message');

  const handleForwardToServer = async (srv: Server) => {
    const ch = srv.channels.find((c) => c.type !== 'voice') || srv.channels[0];
    if (!ch) return;
    setSendingKey(srv.id);
    try {
      await api.sendServerMessage(srv.id, {
        channelId: ch.id,
        content: forwardText,
        forwardedFromAuthor: message.authorName,
      });
      onForwarded(`${srv.name} (#${ch.name})`);
      onClose();
    } finally {
      setSendingKey(null);
    }
  };

  const handleForwardToFriend = async (friend: User) => {
    setSendingKey(friend.id);
    try {
      await api.sendDirectMessage(friend.id, {
        content: forwardText,
        forwardedFromAuthor: message.authorName,
      });
      onForwarded(friend.name);
      onClose();
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Forward className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Forward Message
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              From {message.authorName}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-3">
              {forwardText}
            </p>
          </div>

          {joinedServers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Server Channels
              </p>
              {joinedServers.map((srv) => {
                const ch = srv.channels.find((c) => c.type !== 'voice') || srv.channels[0];
                if (!ch) return null;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    disabled={sendingKey !== null}
                    onClick={() => handleForwardToServer(srv)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                      <Hash className="w-3.5 h-3.5 text-zinc-400" />
                      {srv.name} · #{ch.name}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      {sendingKey === srv.id ? 'Sending...' : 'Send'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {friends.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Direct Messages
              </p>
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={sendingKey !== null}
                  onClick={() => handleForwardToFriend(f)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                    {f.name}
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {sendingKey === f.id ? 'Sending...' : 'Send'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {joinedServers.length === 0 && friends.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-4">
              Join a server or add a friend to forward messages.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
