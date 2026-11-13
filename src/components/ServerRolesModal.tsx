import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Shield, Plus, Trash2, Check, UserMinus, Users } from 'lucide-react';
import { RolePermissions, Server, ServerRole, User } from '../types';
import { api } from '../services/api';
import { DEFAULT_ROLE_PERMISSIONS, hasServerPermission } from '../utils/permissions';
import { makeInitialsAvatar } from '../utils/avatars';

interface ServerRolesModalProps {
  isOpen: boolean;
  server: Server;
  members: User[];
  currentUserId: string;
  onClose: () => void;
  onServerUpdated: (srv: Server) => void;
  onNotify: (msg: string) => void;
}

const PERMISSION_LIST: Array<{
  key: keyof RolePermissions;
  label: string;
  desc: string;
}> = [
  { key: 'administrator', label: 'Administrator', desc: 'Full access to all channels, roles, and server actions' },
  { key: 'manageChannels', label: 'Manage Channels', desc: 'Create new text and voice channels' },
  { key: 'manageRoles', label: 'Manage Roles', desc: 'Create roles and assign permissions to members' },
  { key: 'manageMessages', label: 'Manage Messages', desc: 'Delete or pin messages sent by other members' },
  { key: 'pinMessages', label: 'Pin Messages', desc: 'Pin important messages in text channels' },
  { key: 'kickMembers', label: 'Remove Members', desc: 'Kick members from this server' },
  { key: 'sendMessages', label: 'Send Messages', desc: 'Send chat messages in text channels' },
  { key: 'attachFiles', label: 'Upload Images, GIFs & Voice', desc: 'Upload images, animated GIFs, and voice messages' },
  { key: 'addReactions', label: 'Add Reactions', desc: 'React with emojis on messages' },
  { key: 'connectVoice', label: 'Connect to Voice', desc: 'Join voice channels in this server' },
  { key: 'speakVoice', label: 'Speak in Voice', desc: 'Transmit audio inside voice channels' },
];

const ROLE_COLORS = ['#fafafa', '#a1a1aa', '#34d399', '#60a5fa', '#f59e0b', '#f87171'];

export const ServerRolesModal: React.FC<ServerRolesModalProps> = ({
  isOpen,
  server,
  members,
  currentUserId,
  onClose,
  onServerUpdated,
  onNotify,
}) => {
  const [tab, setTab] = useState<'roles' | 'members'>('roles');
  const roles = server.roles || [];
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || '');
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedRole: ServerRole | undefined =
    roles.find((r) => r.id === selectedRoleId) || roles[0];

  const [roleNameDraft, setRoleNameDraft] = useState(selectedRole?.name || '');
  const [roleColorDraft, setRoleColorDraft] = useState(selectedRole?.color || '#fafafa');
  const [rolePermsDraft, setRolePermsDraft] = useState<RolePermissions>(
    selectedRole?.permissions || { ...DEFAULT_ROLE_PERMISSIONS }
  );

  useEffect(() => {
    if (selectedRole) {
      setRoleNameDraft(selectedRole.name);
      setRoleColorDraft(selectedRole.color);
      setRolePermsDraft({ ...selectedRole.permissions });
    }
  }, [selectedRole?.id, server.roles]);

  if (!isOpen) return null;

  const canManageRoles = hasServerPermission(server, currentUserId, 'manageRoles');
  const canKick = hasServerPermission(server, currentUserId, 'kickMembers');

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const res = await api.createRole(server.id, {
        name: newRoleName.trim(),
        color: '#a1a1aa',
        permissions: { ...DEFAULT_ROLE_PERMISSIONS },
      });
      onServerUpdated(res.server);
      setSelectedRoleId(res.role.id);
      setNewRoleName('');
      onNotify(`Role "${res.role.name}" created.`);
    } catch (err: any) {
      onNotify(err?.message || 'Could not create role.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await api.updateRole(server.id, selectedRole.id, {
        name: roleNameDraft.trim() || selectedRole.name,
        color: roleColorDraft,
        permissions: rolePermsDraft,
      });
      onServerUpdated(res.server);
      onNotify(`Saved "${res.role.name}" permissions.`);
    } catch (err: any) {
      onNotify(err?.message || 'Could not save role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setSaving(true);
    try {
      const res = await api.deleteRole(server.id, roleId);
      onServerUpdated(res.server);
      setSelectedRoleId(res.server.roles[0]?.id || '');
      onNotify('Role deleted.');
    } catch (err: any) {
      onNotify(err?.message || 'Could not delete role.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMemberRole = async (userId: string, roleId: string) => {
    const current = server.memberRoles?.[userId] || [];
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    const res = await api.assignMemberRoles(server.id, userId, next);
    onServerUpdated(res.server);
  };

  const handleKick = async (userId: string, userName: string) => {
    try {
      const res = await api.kickMember(server.id, userId);
      onServerUpdated(res.server);
      onNotify(`Removed ${userName} from ${server.name}.`);
    } catch (err: any) {
      onNotify(err?.message || 'Could not remove member.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-zinc-900 dark:text-white" />
            <div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                Server Roles & Permissions — {server.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Create roles, configure member functions, and manage access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 flex gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setTab('roles')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'roles'
                ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Roles ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              tab === 'members'
                ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'roles' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Role List + Create */}
              <div className="md:col-span-4 space-y-3">
                {canManageRoles && (
                  <form onSubmit={handleCreateRole} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="New role name..."
                      className="flex-1 min-w-0 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      disabled={saving || !newRoleName.trim()}
                      className="p-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-lg disabled:opacity-40 cursor-pointer"
                      title="Create Role"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}

                <div className="space-y-1">
                  {roles.map((r) => {
                    const active = selectedRole?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between text-left cursor-pointer border ${
                          active
                            ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="truncate">{r.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Role Editor */}
              {selectedRole && (
                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Role Name
                      </label>
                      <input
                        type="text"
                        disabled={!canManageRoles}
                        value={roleNameDraft}
                        onChange={(e) => setRoleNameDraft(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Badge Color
                      </label>
                      <div className="flex items-center gap-1.5">
                        {ROLE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={!canManageRoles}
                            onClick={() => setRoleColorDraft(c)}
                            className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                              roleColorDraft === c
                                ? 'border-zinc-950 dark:border-white scale-110'
                                : 'border-zinc-400/50'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Permission Toggles */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Role Functions & Permissions
                    </p>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                      {PERMISSION_LIST.map((perm) => {
                        const enabled = rolePermsDraft[perm.key];
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            disabled={!canManageRoles}
                            onClick={() =>
                              setRolePermsDraft((prev) => ({
                                ...prev,
                                [perm.key]: !prev[perm.key],
                              }))
                            }
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center justify-between gap-3 text-left cursor-pointer"
                          >
                            <div>
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {perm.label}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {perm.desc}
                              </p>
                            </div>
                            <span
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                                enabled
                                  ? 'bg-zinc-950 dark:bg-white justify-end'
                                  : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                              }`}
                            >
                              <span className="w-4 h-4 rounded-full bg-white dark:bg-zinc-950 block" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {canManageRoles && (
                    <div className="flex items-center justify-between pt-2">
                      {roles.length > 1 ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDeleteRole(selectedRole.id)}
                          className="py-2 px-3 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Role</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveRole}
                        className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {members.map((m) => {
                const isOwner = m.id === server.ownerId;
                const assignedIds = server.memberRoles?.[m.id] || [];
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={m.avatarUrl}
                        alt={m.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = makeInitialsAvatar(m.name);
                        }}
                        className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                          {m.name} {isOwner && <span className="text-[10px] font-mono text-zinc-400">(Owner)</span>}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                          {m.tag}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {roles.map((r) => {
                        const has = assignedIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={!canManageRoles}
                            onClick={() => handleToggleMemberRole(m.id, r.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                              has
                                ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                            }`}
                          >
                            {has && <Check className="w-3 h-3" />}
                            <span>{r.name}</span>
                          </button>
                        );
                      })}

                      {canKick && !isOwner && m.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleKick(m.id, m.name)}
                          title={`Remove ${m.name}`}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
