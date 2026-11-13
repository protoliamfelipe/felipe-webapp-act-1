import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Image as ImageIcon, Video, Globe, Users, Lock, Upload } from 'lucide-react';
import { api } from '../services/api';
import { Post, Visibility } from '../types';

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

export const PostComposerModal: React.FC<PostComposerModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) {
      setErrorMsg('Please write your thoughts or attach an image or video.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.createPost({
        title: title.trim() || undefined,
        content: content.trim(),
        visibility,
        mediaFile,
      });
      onPostCreated(res.post);
      setTitle('');
      setContent('');
      setVisibility('public');
      clearMedia();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not publish your post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-zinc-50">
              Create Post
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Share a video, image, or thought with your chosen audience.
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

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Title <span className="text-zinc-400 dark:text-zinc-500 font-normal">(optional — great for videos)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekend Match Highlights or Project Update"
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Thoughts or Description
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share what is on your mind, highlights, or commentary..."
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400 resize-none"
            />
          </div>

          {/* Media Upload Picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl && mediaFile ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950">
              {mediaFile.type.startsWith('video/') ? (
                <video src={previewUrl} controls className="w-full max-h-60" />
              ) : (
                <img src={previewUrl} alt="Upload preview" className="w-full max-h-60 object-contain bg-zinc-100 dark:bg-zinc-950" />
              )}
              <button
                type="button"
                onClick={clearMedia}
                className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-white rounded-lg text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
                className="py-3 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-400 rounded-xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.click();
                  }
                }}
                className="py-3 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-400 rounded-xl bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Upload Video</span>
              </button>
            </div>
          )}

          {/* Visibility Controls: Public, Friends-Only, Private */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Who can see this post?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'public' as Visibility, label: 'Public', icon: Globe },
                { id: 'friends' as Visibility, label: 'Friends Only', icon: Users },
                { id: 'private' as Visibility, label: 'Private', icon: Lock },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = visibility === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVisibility(opt.id)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                        : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{submitting ? 'Publishing...' : 'Publish Post'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
