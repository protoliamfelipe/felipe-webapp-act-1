import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Upload, Link2, ArrowRight, Users } from 'lucide-react';
import { api } from '../services/api';
import { Server } from '../types';
import { getServerMonogram } from '../utils/avatars';

interface NewServerModalProps {
  isOpen: boolean;
  initialInviteCode?: string;
  onClose: () => void;
  onServerCreated: (server: Server & { isMember: boolean; memberCount: number }) => void;
}

function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('invite=')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://pilgrim.app/?${trimmed.split('?')[1] || trimmed}`);
      const param = u.searchParams.get('invite');
      if (param) return param.trim();
    }
  } catch {
    // fallback below
  }
  const parts = trimmed.split('/').filter(Boolean);
  return (parts[parts.length - 1] || trimmed).replace(/^\?invite=/, '').trim();
}

export const NewServerModal: React.FC<NewServerModalProps> = ({
  isOpen,
  initialInviteCode = '',
  onClose,
  onServerCreated,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialInviteCode ? 'join' : 'create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Join via invite state
  const [inviteInput, setInviteInput] = useState(initialInviteCode);
  const [invitePreview, setInvitePreview] = useState<{
    code: string;
    server: { id: string; name: string; description: string; iconUrl?: string; memberCount: number };
  } | null>(null);
  const [lookingUpInvite, setLookingUpInvite] = useState(false);

  useEffect(() => {
    if (isOpen && initialInviteCode) {
      setTab('join');
      setInviteInput(initialInviteCode);
    } else if (isOpen && !initialInviteCode) {
      setTab('create');
    }
    setErrorMsg(null);
  }, [isOpen, initialInviteCode]);

  useEffect(() => {
    if (!isOpen || tab !== 'join') return;
    const code = extractInviteCode(inviteInput);
    if (code.length < 4) {
      setInvitePreview(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLookingUpInvite(true);
      try {
        const res = await api.getInvitePreview(code);
        if (active) {
          setInvitePreview({ code: res.invite.code, server: res.server });
          setErrorMsg(null);
        }
      } catch {
        if (active) setInvitePreview(null);
      } finally {
        if (active) setLookingUpInvite(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [inviteInput, tab, isOpen]);

  if (!isOpen) return null;

  const handleIconPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIconFile(f);
    setIconPreview(URL.createObjectURL(f));
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a server name.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.createServer({
        name: name.trim(),
        description: description.trim(),
        iconStyle: 'monogram',
        iconFile,
      });
      onServerCreated(res.server);
      setName('');
      setDescription('');
      setIconFile(null);
      setIconPreview(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not create server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractInviteCode(inviteInput);
    if (!code) {
      setErrorMsg('Please enter an invite link or code.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.joinByInvite(code);
      onServerCreated(res.server);
      setInviteInput('');
      setInvitePreview(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired invite code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
              {tab === 'create' ? 'Create a Server' : 'Join a Server'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {tab === 'create'
                ? 'Launch your own community server with channels, roles, and voice.'
                : 'Paste a Pilgrim invite link or invite code to join a server.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/70">
            <button
              type="button"
              onClick={() => {
                setTab('create');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'create'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Server</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === 'join'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Join via Invite</span>
            </button>
          </div>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleSubmitCreate} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            {/* Server PFP Upload (First-letter fallback like Discord) */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-950 dark:bg-zinc-800 text-white border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-display font-bold text-2xl overflow-hidden shrink-0">
                {iconPreview ? (
                  <img src={iconPreview} alt="Server icon" className="w-full h-full object-cover" />
                ) : (
                  <span>{getServerMonogram(name || 'Server')}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Server Icon <span className="text-zinc-400 font-normal">(optional)</span>
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  If no photo is uploaded, Pilgrim displays the first letter of your server&apos;s name.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,image/gif"
                  onChange={handleIconPick}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{iconPreview ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                  {iconPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setIconFile(null);
                        setIconPreview(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Server Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Weekend Co-Op Club"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="What is this server about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Creating...' : 'Create Server'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitJoin} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Invite Link or Code
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="https://pilgrim.app/?invite=ABCD1234 or ABCD1234"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Ask a friend for a Pilgrim server invite link or 8-character code.
              </p>
            </div>

            {lookingUpInvite && (
              <p className="text-xs text-zinc-500">Checking invite...</p>
            )}

            {invitePreview && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center font-display font-bold text-sm overflow-hidden shrink-0">
                  {invitePreview.server.iconUrl ? (
                    <img
                      src={invitePreview.server.iconUrl}
                      alt={invitePreview.server.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getServerMonogram(invitePreview.server.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                    {invitePreview.server.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {invitePreview.server.description || 'Community server on Pilgrim'}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 mt-0.5">
                    <Users className="w-3 h-3" />
                    <span>{invitePreview.server.memberCount} members</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !inviteInput.trim()}
                className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <span>{submitting ? 'Joining...' : 'Join Server'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

