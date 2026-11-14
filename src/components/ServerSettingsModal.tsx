import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Image as ImageIcon,
  FolderKanban,
  Shield,
  Smile,
  Link2,
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  Hash,
  Volume2,
  Ban,
  UserMinus,
  Clock,
  Upload,
} from 'lucide-react';
import { RolePermissions, Server, ServerRole, User } from '../types';
import { api } from '../services/api';
import { DEFAULT_ROLE_PERMISSIONS, hasServerPermission } from '../utils/permissions';
import { processCustomEmojiFile } from '../utils/emojiMedia';
import { ImageCropModal } from './ImageCropModal';

export type ServerSettingsTab =
  | 'overview'
  | 'channels'
  | 'roles'
  | 'emoji'
  | 'invites'
  | 'members';

interface ServerSettingsModalProps {
  isOpen: boolean;
  initialTab?: ServerSettingsTab;
  server: Server;
  members: User[];
  currentUser: User;
  onClose: () => void;
  onServerUpdated: (srv: Server) => void;
}

const PERMISSION_LABELS: Array<{ key: keyof RolePermissions; label: string; desc: string }> = [
  { key: 'administrator', label: 'Administrator', desc: 'Grants all server permissions.' },
  { key: 'manageServer', label: 'Manage Server', desc: 'Edit server name, icon, banner, and emojis.' },
  { key: 'manageRoles', label: 'Manage Roles', desc: 'Create, edit, delete, and assign roles.' },
  { key: 'manageChannels', label: 'Manage Channels & Categories', desc: 'Create, organize, and remove channels.' },
  { key: 'kickMembers', label: 'Kick, Timeout & Ban Members', desc: 'Moderate members in this server.' },
  { key: 'sendMessages', label: 'Send Messages', desc: 'Send messages in text channels.' },
  { key: 'manageMessages', label: 'Manage Messages', desc: 'Delete other members’ messages.' },
  { key: 'pinMessages', label: 'Pin Messages', desc: 'Pin important messages in channels.' },
  { key: 'attachFiles', label: 'Attach Images, Videos & GIFs', desc: 'Upload files in text channels.' },
  { key: 'addReactions', label: 'Add Reactions', desc: 'Add emoji reactions to messages.' },
  { key: 'connectVoice', label: 'Connect Voice', desc: 'Join voice channels.' },
  { key: 'speakVoice', label: 'Speak in Voice', desc: 'Transmit audio in voice channels.' },
];

const ROLE_COLORS = ['#fafafa', '#a1a1aa', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#c084fc'];

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  initialTab = 'overview',
  server,
  members,
  currentUser,
  onClose,
  onServerUpdated,
}) => {
  const [tab, setTab] = useState<ServerSettingsTab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Overview state
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description);
  const [iconStyle, setIconStyle] = useState(server.iconStyle || 'shield');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | undefined>(server.iconUrl);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | undefined>(server.bannerUrl);
  const [removeBanner, setRemoveBanner] = useState(false);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<'avatar' | 'banner'>('avatar');
  const [cropFileName, setCropFileName] = useState('image.png');
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Categories & Channels state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [newChannelCatId, setNewChannelCatId] = useState('');

  // Roles state
  const [selectedRoleId, setSelectedRoleId] = useState<string>(server.roles[0]?.id || '');
  const [newRoleName, setNewRoleName] = useState('');
  const [roleNameEdit, setRoleNameEdit] = useState('');
  const [roleColorEdit, setRoleColorEdit] = useState('#fafafa');
  const [rolePermsEdit, setRolePermsEdit] = useState<RolePermissions>({ ...DEFAULT_ROLE_PERMISSIONS });

  // Custom Emoji state
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const [pendingEmojiFile, setPendingEmojiFile] = useState<File | null>(null);
  const [pendingEmojiAnimated, setPendingEmojiAnimated] = useState(false);
  const [pendingEmojiPreview, setPendingEmojiPreview] = useState<string | null>(null);
  const [emojiShortcode, setEmojiShortcode] = useState('');
  const [uploadingEmoji, setUploadingEmoji] = useState(false);

  // Invites & Members
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setName(server.name);
      setDescription(server.description);
      setIconStyle(server.iconStyle || 'shield');
      setIconFile(null);
      setIconPreview(server.iconUrl);
      setRemoveIcon(false);
      setBannerFile(null);
      setBannerPreview(server.bannerUrl);
      setRemoveBanner(false);
      setError(null);
    }
  }, [isOpen, initialTab, server]);

  useEffect(() => {
    const active = server.roles.find((r) => r.id === selectedRoleId) || server.roles[0];
    if (active) {
      setSelectedRoleId(active.id);
      setRoleNameEdit(active.name);
      setRoleColorEdit(active.color);
      setRolePermsEdit({ ...active.permissions });
    }
  }, [server.roles, selectedRoleId]);

  if (!isOpen) return null;

  const canManageServer = hasServerPermission(server, currentUser.id, 'manageServer');
  const canManageChannels = hasServerPermission(server, currentUser.id, 'manageChannels');
  const canManageRoles = hasServerPermission(server, currentUser.id, 'manageRoles');
  const canKickBan =
    hasServerPermission(server, currentUser.id, 'kickMembers') || canManageServer;

  const handleSelectImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'avatar' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
    const objectUrl = URL.createObjectURL(file);
    if (isGif) {
      if (mode === 'avatar') {
        setIconFile(file);
        setIconPreview(objectUrl);
        setRemoveIcon(false);
      } else {
        setBannerFile(file);
        setBannerPreview(objectUrl);
        setRemoveBanner(false);
      }
      return;
    }

    setCropMode(mode);
    setCropFileName(file.name);
    setCropSrc(objectUrl);
  };

  const handleSaveOverview = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await api.updateServer(server.id, {
        name: name.trim(),
        description: description.trim(),
        iconStyle,
        iconFile,
        bannerFile,
        removeIcon,
        removeBanner,
      });
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save server settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setError(null);
    try {
      const res = await api.createCategory(server.id, newCategoryName.trim());
      onServerUpdated(res.server);
      setNewCategoryName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    setError(null);
    try {
      const res = await api.deleteCategory(server.id, catId);
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.');
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setError(null);
    try {
      const res = await api.createChannel(server.id, {
        name: newChannelName.trim(),
        type: newChannelType,
        categoryId: newChannelCatId || undefined,
      });
      onServerUpdated(res.server);
      setNewChannelName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel.');
    }
  };

  const handleMoveChannel = async (channelId: string, categoryId: string) => {
    try {
      const res = await api.updateChannel(server.id, channelId, {
        categoryId: categoryId || null,
      });
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move channel.');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const res = await api.deleteChannel(server.id, channelId);
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete channel.');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      const res = await api.createRole(server.id, { name: newRoleName.trim() });
      onServerUpdated(res.server);
      setSelectedRoleId(res.role.id);
      setNewRoleName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role.');
    }
  };

  const handleSaveRole = async () => {
    const active: ServerRole | undefined = server.roles.find((r) => r.id === selectedRoleId);
    if (!active) return;
    setSaving(true);
    try {
      const res = await api.updateRole(server.id, active.id, {
        name: roleNameEdit.trim() || active.name,
        color: roleColorEdit,
        permissions: rolePermsEdit,
      });
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const res = await api.deleteRole(server.id, roleId);
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role.');
    }
  };

  const handlePickEmojiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    e.target.value = '';
    if (!rawFile) return;
    setError(null);
    try {
      const processed = await processCustomEmojiFile(rawFile);
      setPendingEmojiFile(processed.file);
      setPendingEmojiAnimated(processed.animated);
      setPendingEmojiPreview(URL.createObjectURL(processed.file));
      const suggested = rawFile.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '');
      setEmojiShortcode(suggested || 'custom_emoji');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare emoji image.');
    }
  };

  const handleUploadEmoji = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmojiFile) return;
    setUploadingEmoji(true);
    setError(null);
    try {
      const res = await api.uploadServerEmoji(server.id, {
        name: emojiShortcode || 'custom_emoji',
        file: pendingEmojiFile,
        animated: pendingEmojiAnimated,
      });
      onServerUpdated(res.server);
      setPendingEmojiFile(null);
      setPendingEmojiPreview(null);
      setEmojiShortcode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload custom emoji.');
    } finally {
      setUploadingEmoji(false);
    }
  };

  const handleDeleteEmoji = async (emojiId: string) => {
    try {
      const res = await api.deleteServerEmoji(server.id, emojiId);
      onServerUpdated(res.server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove emoji.');
    }
  };

  const customEmojis = server.customEmojis || [];
  const categories = server.categories || [];
  const invites = server.invites || [];
  const bannedIds = server.bannedUserIds || [];

  const tabs: Array<{ id: ServerSettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'channels', label: 'Categories & Channels', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'roles', label: 'Roles', icon: <Shield className="w-4 h-4" /> },
    { id: 'emoji', label: `Emoji (${customEmojis.length})`, icon: <Smile className="w-4 h-4" /> },
    { id: 'invites', label: 'Invites', icon: <Link2 className="w-4 h-4" /> },
    { id: 'members', label: 'Members & Bans', icon: <Users className="w-4 h-4" /> },
  ];

  const filteredMembers = members.filter(
    (m) =>
      !memberSearch.trim() ||
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.tag.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Navigation */}
        <div className="md:w-56 bg-zinc-50 dark:bg-zinc-950 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-3 flex md:flex-col gap-1 overflow-x-auto shrink-0">
          <div className="hidden md:block px-2.5 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {server.name}
            </p>
            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
              Server Settings
            </h3>
          </div>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-900'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              {tabs.find((t) => t.id === tab)?.label}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close server settings"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                {error}
              </div>
            )}

            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* Server Banner Preview + Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Server Banner (Images & GIFs)
                  </label>
                  <div className="relative h-36 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    {bannerPreview && !removeBanner ? (
                      <img
                        src={bannerPreview}
                        alt="Server banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                        No server banner uploaded
                      </div>
                    )}
                    {canManageServer && (
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => bannerInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-zinc-950/90 text-white text-xs font-semibold hover:bg-black cursor-pointer"
                        >
                          Upload Banner
                        </button>
                        {(bannerPreview || server.bannerUrl) && !removeBanner && (
                          <button
                            type="button"
                            onClick={() => {
                              setBannerFile(null);
                              setBannerPreview(undefined);
                              setRemoveBanner(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600/90 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*,.gif"
                      onChange={(e) => handleSelectImage(e, 'banner')}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Server Icon + Name */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex items-center justify-center text-white font-display font-bold text-2xl">
                      {iconPreview && !removeIcon ? (
                        <img src={iconPreview} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        name.trim().charAt(0).toUpperCase() || 'S'
                      )}
                    </div>
                    {canManageServer && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => iconInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                        >
                          Change Icon
                        </button>
                        {iconPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setIconFile(null);
                              setIconPreview(undefined);
                              setRemoveIcon(true);
                            }}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-500/10 cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*,.gif"
                      onChange={(e) => handleSelectImage(e, 'avatar')}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                        Server Name
                      </label>
                      <input
                        type="text"
                        disabled={!canManageServer}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-950 dark:text-white disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        disabled={!canManageServer}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-950 dark:text-white disabled:opacity-60 resize-none"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      When no icon is uploaded, Pilgrim displays your server&apos;s first letter.
                    </p>
                  </div>
                </div>

                {canManageServer && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveOverview}
                      className="px-5 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORIES & CHANNELS TAB */}
            {tab === 'channels' && (
              <div className="space-y-5">
                {canManageChannels && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <form
                      onSubmit={handleCreateCategory}
                      className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5"
                    >
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        Create Category
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Voice Lounges"
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </form>

                    <form
                      onSubmit={handleCreateChannel}
                      className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5"
                    >
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        Create Channel
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          placeholder="Channel name"
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                        />
                        <select
                          value={newChannelType}
                          onChange={(e) => setNewChannelType(e.target.value as 'text' | 'voice')}
                          className="px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="text">Text</option>
                          <option value="voice">Voice</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={newChannelCatId}
                          onChange={(e) => setNewChannelCatId(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Categories List */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Categories ({categories.length})
                  </p>
                  {categories.length === 0 ? (
                    <p className="text-xs text-zinc-500">No categories created yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                        >
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                            {cat.name}
                          </span>
                          {canManageChannels && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1 rounded text-zinc-400 hover:text-red-500 cursor-pointer"
                              title="Delete category (keeps channels)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Channels Assignment List */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Channels ({server.channels.length})
                  </p>
                  <div className="space-y-1.5">
                    {server.channels.map((ch) => (
                      <div
                        key={ch.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ch.type === 'voice' ? (
                            <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
                          ) : (
                            <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {ch.name}
                          </span>
                        </div>
                        {canManageChannels && (
                          <div className="flex items-center gap-2">
                            <select
                              value={ch.categoryId || ''}
                              onChange={(e) => handleMoveChannel(ch.id, e.target.value)}
                              className="px-2 py-1 text-[11px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200"
                            >
                              <option value="">Uncategorized</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            {server.channels.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(ch.id)}
                                className="p-1 rounded text-zinc-400 hover:text-red-500 cursor-pointer"
                                title="Delete channel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ROLES TAB */}
            {tab === 'roles' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  {canManageRoles && (
                    <form onSubmit={handleCreateRole} className="flex gap-1.5">
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="New role name..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}

                  <div className="space-y-1">
                    {server.roles.map((r) => (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                          selectedRoleId === r.id
                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                            : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        onClick={() => setSelectedRoleId(r.id)}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="truncate">{r.name}</span>
                        </span>
                        {canManageRoles && server.roles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(r.id);
                            }}
                            className="p-1 opacity-60 hover:opacity-100 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">
                          Role Name
                        </label>
                        <input
                          type="text"
                          disabled={!canManageRoles}
                          value={roleNameEdit}
                          onChange={(e) => setRoleNameEdit(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">
                          Role Color
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {ROLE_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              disabled={!canManageRoles}
                              onClick={() => setRoleColorEdit(c)}
                              className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                                roleColorEdit === c
                                  ? 'border-zinc-950 dark:border-white scale-110'
                                  : 'border-zinc-300 dark:border-zinc-700'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {PERMISSION_LABELS.map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                              {p.label}
                            </p>
                            <p className="text-[11px] text-zinc-500">{p.desc}</p>
                          </div>
                          <input
                            type="checkbox"
                            disabled={!canManageRoles}
                            checked={Boolean(rolePermsEdit[p.key])}
                            onChange={(e) =>
                              setRolePermsEdit((prev) => ({
                                ...prev,
                                [p.key]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 accent-zinc-950 dark:accent-white"
                          />
                        </label>
                      ))}
                    </div>

                    {canManageRoles && (
                      <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={handleSaveRole}
                          className="px-4 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                        >
                          {saving ? 'Saving...' : 'Save Role'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* UNLIMITED CUSTOM EMOJI TAB (STATIC 128x128 & ANIMATED GIF) */}
            {tab === 'emoji' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                        Upload Custom Emojis (Unlimited Static & Animated GIFs)
                      </h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Static images are automatically formatted to Discord standard 128×128px transparent PNG. Animated GIFs preserve full animation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => emojiInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose Image / GIF</span>
                    </button>
                    <input
                      ref={emojiInputRef}
                      type="file"
                      accept="image/*,.gif"
                      onChange={handlePickEmojiFile}
                      className="hidden"
                    />
                  </div>

                  {pendingEmojiPreview && (
                    <form
                      onSubmit={handleUploadEmoji}
                      className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3"
                    >
                      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <img
                          src={pendingEmojiPreview}
                          alt="Emoji preview"
                          className="w-10 h-10 object-contain"
                        />
                        <img
                          src={pendingEmojiPreview}
                          alt="Inline size preview"
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                          Shortcode Name
                        </label>
                        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5">
                          <span className="text-xs text-zinc-400">:</span>
                          <input
                            type="text"
                            value={emojiShortcode}
                            onChange={(e) =>
                              setEmojiShortcode(
                                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                              )
                            }
                            placeholder="emoji_name"
                            className="flex-1 py-1.5 px-1 text-xs bg-transparent text-zinc-900 dark:text-white focus:outline-none"
                          />
                          <span className="text-xs text-zinc-400">:</span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={uploadingEmoji}
                        className="px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        {uploadingEmoji ? 'Uploading...' : 'Add Emoji'}
                      </button>
                    </form>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Server Emojis — {customEmojis.length} Uploaded (No Limit)
                  </p>
                  {customEmojis.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                      No custom emojis uploaded yet. Add static PNGs or animated GIF emojis above!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {customEmojis.map((ce) => (
                        <div
                          key={ce.id}
                          className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={ce.url}
                              alt={ce.name}
                              className="w-8 h-8 object-contain shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate font-mono">
                                :{ce.name}:
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                {ce.animated ? 'GIF Animated' : '128×128 PNG'}
                              </p>
                            </div>
                          </div>
                          {canManageServer && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEmoji(ce.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* INVITES TAB */}
            {tab === 'invites' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Manage active invite links for {server.name}.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await api.createInvite(server.id, { maxUses: 0, maxAgeHours: 168 });
                      onServerUpdated(res.server);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Invite</span>
                  </button>
                </div>

                {invites.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                    No active invite links yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invites.map((inv) => (
                      <div
                        key={inv.code}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      >
                        <div>
                          <p className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                            {window.location.origin}/?invite={inv.code}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            Created by {inv.createdByName} · {inv.uses}
                            {inv.maxUses ? `/${inv.maxUses}` : ''} uses
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                ?.writeText(`${window.location.origin}/?invite=${inv.code}`)
                                .catch(() => {});
                              setCopiedInvite(inv.code);
                              setTimeout(() => setCopiedInvite(null), 1500);
                            }}
                            className="p-1.5 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 cursor-pointer"
                          >
                            {copiedInvite === inv.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await api.deleteInvite(server.id, inv.code);
                              onServerUpdated(res.server);
                            }}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MEMBERS & BANS TAB */}
            {tab === 'members' && (
              <div className="space-y-4">
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                />

                <div className="space-y-2">
                  {filteredMembers.map((m) => {
                    const isOwner = m.id === server.ownerId;
                    const timeoutIso = server.timedOutUntil?.[m.id];
                    const isTimedOut = Boolean(
                      timeoutIso && new Date(timeoutIso).getTime() > Date.now()
                    );
                    return (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span>{m.name}</span>
                              {isOwner && (
                                <span className="text-[10px] text-amber-500 font-bold">Owner</span>
                              )}
                              {isTimedOut && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-bold">
                                  <Clock className="w-3 h-3" /> Timed out
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-mono">{m.tag}</p>
                          </div>
                        </div>

                        {canKickBan && !isOwner && m.id !== currentUser.id && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await api.timeoutMember(
                                  server.id,
                                  m.id,
                                  isTimedOut ? 0 : 10
                                );
                                onServerUpdated(res.server);
                              }}
                              className="px-2 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer"
                            >
                              {isTimedOut ? 'Clear Timeout' : 'Timeout 10m'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await api.kickMember(server.id, m.id);
                                onServerUpdated(res.server);
                              }}
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                              title="Kick member"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await api.banMember(server.id, m.id);
                                onServerUpdated(res.server);
                              }}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                              title="Ban member"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {bannedIds.length > 0 && canKickBan && (
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">
                      Banned Users ({bannedIds.length})
                    </p>
                    <div className="space-y-1.5">
                      {bannedIds.map((uid) => (
                        <div
                          key={uid}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/20 text-xs"
                        >
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">{uid}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await api.unbanMember(server.id, uid);
                              onServerUpdated(res.server);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                          >
                            Unban
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Crop Modal for Server Icon & Server Banner */}
      <ImageCropModal
        isOpen={Boolean(cropSrc)}
        imageSrc={cropSrc}
        mode={cropMode}
        title={cropMode === 'banner' ? 'Edit Server Banner' : 'Edit Server Icon'}
        fileName={cropFileName}
        onCancel={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onApply={(croppedFile, previewUrl) => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
          if (cropMode === 'avatar') {
            setIconFile(croppedFile);
            setIconPreview(previewUrl);
            setRemoveIcon(false);
          } else {
            setBannerFile(croppedFile);
            setBannerPreview(previewUrl);
            setRemoveBanner(false);
          }
        }}
      />
    </div>
  );
};
