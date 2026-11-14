import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Crown,
  Shield,
  Plus,
  Check,
  UserMinus,
  Ban,
  ExternalLink,
} from 'lucide-react';
import { Server, User } from '../types';
import { api } from '../services/api';
import { getEffectiveStatus, getMemberRoles, hasServerPermission } from '../utils/permissions';

interface MemberProfilePopoverProps {
  member: User;
  server: Server;
  currentUser: User;
  onlineUserIds: string[];
  isStreaming?: boolean;
  isFriend: boolean;
  pendingDirection: 'incoming' | 'outgoing' | null;
  onClose: () => void;
  onViewFullProfile: (userId: string) => void;
  onMessageUser: (userId: string) => void;
  onAddFriend: (tag: string) => Promise<void>;
  onServerUpdated: (srv: Server) => void;
  onError?: (msg: string) => void;
}

export const MemberProfilePopover: React.FC<MemberProfilePopoverProps> = ({
  member,
  server,
  currentUser,
  onlineUserIds,
  isStreaming = false,
  isFriend,
  pendingDirection,
  onClose,
  onViewFullProfile,
  onMessageUser,
  onAddFriend,
  onServerUpdated,
  onError,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [friendSent, setFriendSent] = useState(false);

  const effectiveStatus = getEffectiveStatus(member, onlineUserIds, currentUser.id);
  const statusColor =
    effectiveStatus === 'online'
      ? 'bg-emerald-500'
      : effectiveStatus === 'idle'
      ? 'bg-amber-400'
      : effectiveStatus === 'dnd'
      ? 'bg-red-500'
      : 'bg-zinc-400';

  const isOwner = server.ownerId === member.id;
  const isSelf = currentUser.id === member.id;
  const canManageRoles = hasServerPermission(server, currentUser.id, 'manageRoles');
  const canModerate =
    (hasServerPermission(server, currentUser.id, 'kickMembers') ||
      hasServerPermission(server, currentUser.id, 'manageServer')) &&
    !isSelf &&
    !isOwner;

  const assignedRoles = getMemberRoles(server, member.id);
  const assignedIds = server.memberRoles?.[member.id] || [];
  const timeoutIso = server.timedOutUntil?.[member.id];
  const isTimedOut = Boolean(timeoutIso && new Date(timeoutIso).getTime() > Date.now());

  const handleToggleRole = async (roleId: string) => {
    setBusy(true);
    try {
      const nextIds = assignedIds.includes(roleId)
        ? assignedIds.filter((id) => id !== roleId)
        : [...assignedIds, roleId];
      const res = await api.assignMemberRoles(server.id, member.id, nextIds);
      onServerUpdated(res.server);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to update roles.');
    } finally {
      setBusy(false);
    }
  };

  const handleTimeout = async (minutes: number) => {
    setBusy(true);
    try {
      const res = await api.timeoutMember(server.id, member.id, minutes);
      onServerUpdated(res.server);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to update timeout.');
    } finally {
      setBusy(false);
    }
  };

  const handleKick = async () => {
    setBusy(true);
    try {
      const res = await api.kickMember(server.id, member.id);
      onServerUpdated(res.server);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to kick member.');
    } finally {
      setBusy(false);
    }
  };

  const handleBan = async () => {
    setBusy(true);
    try {
      const res = await api.banMember(server.id, member.id);
      onServerUpdated(res.server);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to ban member.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddFriend = async () => {
    setBusy(true);
    try {
      await onAddFriend(member.tag);
      setFriendSent(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to send friend request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-auto"
      >
        {/* Banner + Close Button */}
        <div className="relative h-24 bg-zinc-900 dark:bg-zinc-950">
          {member.bannerUrl ? (
            <img
              src={member.bannerUrl}
              alt={`${member.name} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member card"
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/55 text-white hover:bg-black/75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overlapping Avatar */}
        <div className="px-5 pb-5">
          <div className="relative -mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <img
                src={member.avatarUrl}
                alt={member.name}
                className={`w-20 h-20 rounded-full object-cover bg-zinc-900 ${
                  isStreaming
                    ? 'ring-3 ring-red-500 border-4 border-white dark:border-zinc-900'
                    : 'border-4 border-white dark:border-zinc-900'
                }`}
              />
              {isStreaming ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-extrabold border-2 border-white dark:border-zinc-900">
                  LIVE
                </span>
              ) : (
                <span
                  className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 ${statusColor}`}
                />
              )}
            </div>

            {isOwner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
                <Crown className="w-3 h-3" /> Server Owner
              </span>
            )}
          </div>

          {/* Identity */}
          <div className="mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                {member.name}
              </h3>
              {isTimedOut && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  <Clock className="w-3 h-3" /> Timed Out
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{member.tag}</p>
            {member.squadTitle && (
              <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">
                {member.squadTitle}
              </p>
            )}
          </div>

          {/* Direct Actions right below PFP + Banner */}
          {!isSelf && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onMessageUser(member.id);
                }}
                className="py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>

              {isFriend ? (
                <div className="py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Friends</span>
                </div>
              ) : pendingDirection || friendSent ? (
                <div className="py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{pendingDirection === 'incoming' ? 'Requested You' : 'Request Sent'}</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAddFriend}
                  className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </button>
              )}
            </div>
          )}

          {/* Bio */}
          {member.bio && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                About Me
              </p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {member.bio}
              </p>
            </div>
          )}

          {/* Server Roles */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Server Roles
              </p>
              {canManageRoles && (
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen((v) => !v)}
                  className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{roleDropdownOpen ? 'Done' : 'Edit Roles'}</span>
                </button>
              )}
            </div>

            {assignedRoles.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Default Member permissions</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {assignedRoles.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span>{r.name}</span>
                  </span>
                ))}
              </div>
            )}

            {roleDropdownOpen && canManageRoles && (
              <div className="mt-2.5 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-1 max-h-36 overflow-y-auto">
                {server.roles.map((r) => {
                  const has = assignedIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleRole(r.id)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: r.color }}
                        />
                        <span>{r.name}</span>
                      </span>
                      {has && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Moderation Controls */}
          {canModerate && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                Server Moderation
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTimeout(10)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Timeout 10m
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTimeout(60)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Timeout 1h
                </button>
                {isTimedOut && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTimeout(0)}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold cursor-pointer"
                  >
                    Clear Timeout
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleKick}
                  className="py-1.5 px-2.5 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Kick</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleBan}
                  className="py-1.5 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Ban</span>
                </button>
              </div>
            </div>
          )}

          {/* Go to Full Profile */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewFullProfile(member.id);
            }}
            className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Full Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
};
