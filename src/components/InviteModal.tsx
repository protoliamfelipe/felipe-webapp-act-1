import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Link2, Trash2, Send, Plus, Clock } from 'lucide-react';
import { Server, User } from '../types';
import { api } from '../services/api';
import { hasServerPermission } from '../utils/permissions';

interface InviteModalProps {
  isOpen: boolean;
  server: Server;
  friends: User[];
  currentUserId: string;
  onClose: () => void;
  onServerUpdated: (srv: Server) => void;
  onSendInviteDm: (friendId: string, inviteUrl: string, serverName: string) => Promise<void>;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  server,
  friends,
  currentUserId,
  onClose,
  onServerUpdated,
  onSendInviteDm,
}) => {
  const [maxUses, setMaxUses] = useState<string>('0');
  const [maxAgeHours, setMaxAgeHours] = useState<string>('168');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sentFriends, setSentFriends] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const invites = server.invites || [];
  const activeInvite = invites[0];
  const canManageServer = hasServerPermission(server, currentUserId, 'manageServer');

  useEffect(() => {
    if (!isOpen) return;
    if (invites.length === 0) {
      setCreating(true);
      api
        .createInvite(server.id, { maxUses: 0, maxAgeHours: 168 })
        .then((res) => onServerUpdated(res.server))
        .catch(() => {})
        .finally(() => setCreating(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, server.id]);

  if (!isOpen) return null;

  const getInviteUrl = (code: string) => `${window.location.origin}/?invite=${code}`;

  const handleCopy = (code: string, isFullUrl = true) => {
    const val = isFullUrl ? getInviteUrl(code) : code;
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedCode(code + (isFullUrl ? '_url' : '_code'));
    setTimeout(() => setCopiedCode(null), 1600);
  };

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await api.createInvite(server.id, {
        maxUses: Number(maxUses) || 0,
        maxAgeHours: Number(maxAgeHours) || 0,
      });
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (code: string) => {
    try {
      const res = await api.deleteInvite(server.id, code);
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke invite.');
    }
  };

  const handleDmFriend = async (friendId: string) => {
    let code = activeInvite?.code;
    if (!code) {
      setCreating(true);
      try {
        const res = await api.createInvite(server.id, { maxUses: 0, maxAgeHours: 168 });
        onServerUpdated(res.server);
        code = res.invite.code;
      } catch {
        setCreating(false);
        return;
      }
      setCreating(false);
    }
    await onSendInviteDm(friendId, getInviteUrl(code), server.name);
    setSentFriends((prev) => ({ ...prev, [friendId]: true }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                Invite friends to {server.name}
              </h3>
              <p className="text-[11px] text-zinc-500">Share a link or send directly via DM</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}

          {/* Share Primary Invite Link */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Server Invite Link
            </label>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1.5">
              <input
                type="text"
                readOnly
                value={activeInvite ? getInviteUrl(activeInvite.code) : 'Generating invite...'}
                className="flex-1 bg-transparent px-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none font-mono"
              />
              {activeInvite && (
                <button
                  type="button"
                  onClick={() => handleCopy(activeInvite.code, true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedCode === `${activeInvite.code}_url` ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {activeInvite && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                <span>
                  Invite code:{' '}
                  <button
                    type="button"
                    onClick={() => handleCopy(activeInvite.code, false)}
                    className="font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:underline cursor-pointer"
                  >
                    {activeInvite.code}
                    {copiedCode === `${activeInvite.code}_code` ? ' (Copied)' : ''}
                  </button>
                </span>
                <span>
                  Uses: {activeInvite.uses}
                  {activeInvite.maxUses ? `/${activeInvite.maxUses}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Friends Quick DM Invite */}
          {friends.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Send to a Friend
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {friends.map((friend) => {
                  const alreadyInServer = server.memberIds.includes(friend.id);
                  const sent = sentFriends[friend.id];
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/80"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={friend.avatarUrl}
                          alt={friend.name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {friend.name}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">{friend.tag}</p>
                        </div>
                      </div>
                      {alreadyInServer ? (
                        <span className="text-[11px] font-medium text-zinc-400 px-2">Member</span>
                      ) : (
                        <button
                          type="button"
                          disabled={sent}
                          onClick={() => handleDmFriend(friend.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                            sent
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                          }`}
                        >
                          {sent ? (
                            <>
                              <Check className="w-3 h-3" /> Sent
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" /> Invite
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Link Generator */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Create Custom Invite Link
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Expire After</label>
                <select
                  value={maxAgeHours}
                  onChange={(e) => setMaxAgeHours(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="1">1 Hour</option>
                  <option value="6">6 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="0">Never</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Max Uses</label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="0">No limit</option>
                  <option value="1">1 use</option>
                  <option value="5">5 uses</option>
                  <option value="10">10 uses</option>
                  <option value="25">25 uses</option>
                  <option value="100">100 uses</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="w-full py-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{creating ? 'Generating...' : 'Generate New Link'}</span>
            </button>
          </div>

          {/* Active Invites List */}
          {invites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Active Invites ({invites.length})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {invites.map((inv) => (
                  <div
                    key={inv.code}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">
                        {inv.code}
                      </span>
                      <span className="text-[11px] text-zinc-500 ml-2">
                        {inv.uses}
                        {inv.maxUses ? `/${inv.maxUses}` : ''} uses
                      </span>
                      {inv.expiresAt && (
                        <span className="text-[10px] text-zinc-400 ml-2 inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(inv.code, true)}
                        className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                        title="Copy invite link"
                      >
                        {copiedCode === `${inv.code}_url` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {(inv.createdBy === currentUserId || canManageServer) && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.code)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                          title="Revoke invite"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
