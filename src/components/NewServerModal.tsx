import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Shield, Crosshair, Swords, Crown, Compass, Upload } from 'lucide-react';
import { api } from '../services/api';
import { Server } from '../types';

interface NewServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServerCreated: (server: Server & { isMember: boolean; memberCount: number }) => void;
}

const ICON_OPTIONS = [
  { id: 'shield', label: 'Shield', Icon: Shield },
  { id: 'crosshair', label: 'Crosshair', Icon: Crosshair },
  { id: 'sword', label: 'Blade', Icon: Swords },
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'compass', label: 'Compass', Icon: Compass },
];

export const NewServerModal: React.FC<NewServerModalProps> = ({
  isOpen,
  onClose,
  onServerCreated,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Community & Hangout');
  const [description, setDescription] = useState('');
  const [iconStyle, setIconStyle] = useState('shield');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleIconPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIconFile(f);
    setIconPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        category,
        description: description.trim(),
        iconStyle,
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
              Make New Server
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Choose an icon and launch a community server with #general and #media-showcase.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Server Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Server Icon
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {ICON_OPTIONS.map(({ id, label, Icon }) => {
                const active = !iconFile && iconStyle === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => {
                      setIconFile(null);
                      setIconPreview(null);
                      setIconStyle(id);
                    }}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleIconPick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-10 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Server icon" className="w-6 h-6 rounded object-cover" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Upload Icon</span>
              </button>
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
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            >
              <option value="Community & Hangout">Community & Hangout</option>
              <option value="Gaming">Gaming & Co-Op</option>
              <option value="Creators & Video">Creators & Video</option>
              <option value="Tech & Design">Tech & Design</option>
            </select>
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
      </motion.div>
    </div>
  );
};
