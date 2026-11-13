import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  Image as ImageIcon,
  Video,
  Globe,
  Users,
  Lock,
  Edit3,
  UserPlus,
  MessageSquare,
  Flag,
  Check,
  X,
  Upload,
  Camera,
  Crop,
  Trash2,
} from 'lucide-react';
import { Post, User, Visibility } from '../types';
import { api } from '../services/api';
import { PostCard } from './PostCard';
import { ImageCropModal } from './ImageCropModal';
import { makeInitialsAvatar } from '../utils/avatars';

interface ProfileDashboardProps {
  profileUser: User;
  currentUser: User;
  isFriend: boolean;
  pendingDirection: 'incoming' | 'outgoing' | null;
  friendCount: number;
  posts: Post[];
  onProfileUpdated: (user: User) => void;
  onPostCreated: (post: Post) => void;
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
  onAddFriend: (tag: string) => void;
  onStartDm: (friendId: string) => void;
  onReport: (target: {
    targetType: 'user' | 'post' | 'comment';
    targetId: string;
    targetUserId: string;
    targetUserName: string;
  }) => void;
  onOpenProfile: (userId: string) => void;
}

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({
  profileUser,
  currentUser,
  isFriend,
  pendingDirection,
  friendCount,
  posts,
  onProfileUpdated,
  onPostCreated,
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
  onAddFriend,
  onStartDm,
  onReport,
  onOpenProfile,
}) => {
  const isOwnProfile = profileUser.id === currentUser.id;
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'image' | 'none'>('all');

  // Inline Composer state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Profile state (custom cropped PFP, banner, gamer username, bio)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profileUser.name);
  const [editBio, setEditBio] = useState(profileUser.bio || '');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [pendingRemoveAvatar, setPendingRemoveAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  // Image Cropper Modal state
  const [cropState, setCropState] = useState<{
    isOpen: boolean;
    mode: 'avatar' | 'banner';
    src: string | null;
    fileName: string;
    immediateSave?: boolean;
  }>({
    isOpen: false,
    mode: 'avatar',
    src: null,
    fileName: 'image.png',
  });
  const [rawAvatarSrc, setRawAvatarSrc] = useState<string | null>(null);
  const [rawAvatarName, setRawAvatarName] = useState<string>('avatar.png');

  const pfpInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditName(profileUser.name);
    setEditBio(profileUser.bio || '');
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setPendingRemoveAvatar(false);
    setIsEditingProfile(false);
  }, [profileUser]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.profile-anim', {
        y: 16,
        opacity: 0,
        duration: 0.45,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      });
    }, headerRef);
    return () => ctx.revert();
  }, [profileUser.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMediaFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearInlineMedia = () => {
    setMediaFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePfpSelect = async (e: React.ChangeEvent<HTMLInputElement>, immediateSave = false) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';

    const isGif = f.type === 'image/gif' || /\.gif$/i.test(f.name);
    if (isGif) {
      if (immediateSave) {
        setSavingProfile(true);
        try {
          const res = await api.updateProfile({ avatarFile: f });
          onProfileUpdated(res.user);
        } finally {
          setSavingProfile(false);
        }
      } else {
        if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
        setEditAvatarFile(f);
        setEditAvatarPreview(URL.createObjectURL(f));
        setPendingRemoveAvatar(false);
      }
      return;
    }

    const src = URL.createObjectURL(f);
    if (rawAvatarSrc) URL.revokeObjectURL(rawAvatarSrc);
    setRawAvatarSrc(src);
    setRawAvatarName(f.name);
    setCropState({
      isOpen: true,
      mode: 'avatar',
      src,
      fileName: f.name,
      immediateSave,
    });
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';

    const isGif = f.type === 'image/gif' || /\.gif$/i.test(f.name);
    if (isGif) {
      setSavingBanner(true);
      try {
        const res = await api.updateProfile({ bannerFile: f });
        onProfileUpdated(res.user);
      } finally {
        setSavingBanner(false);
      }
      return;
    }

    const src = URL.createObjectURL(f);
    setCropState({
      isOpen: true,
      mode: 'banner',
      src,
      fileName: f.name,
      immediateSave: true,
    });
  };

  const handleCropApply = async (croppedFile: File, croppedPreview: string) => {
    const { mode, immediateSave } = cropState;
    setCropState((prev) => ({ ...prev, isOpen: false }));

    if (mode === 'avatar') {
      if (immediateSave) {
        URL.revokeObjectURL(croppedPreview);
        setSavingProfile(true);
        try {
          const res = await api.updateProfile({ avatarFile: croppedFile });
          onProfileUpdated(res.user);
        } finally {
          setSavingProfile(false);
        }
      } else {
        if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
        setEditAvatarFile(croppedFile);
        setEditAvatarPreview(croppedPreview);
        setPendingRemoveAvatar(false);
      }
      return;
    }

    // Banner upload & immediate save
    URL.revokeObjectURL(croppedPreview);
    setSavingBanner(true);
    try {
      const res = await api.updateProfile({ bannerFile: croppedFile });
      onProfileUpdated(res.user);
    } finally {
      setSavingBanner(false);
    }
  };

  const handleRemoveBanner = async () => {
    setSavingBanner(true);
    try {
      const res = await api.updateProfile({ removeBanner: true });
      onProfileUpdated(res.user);
    } finally {
      setSavingBanner(false);
    }
  };

  const handlePublishInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaFile) return;
    setIsPublishing(true);
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
      clearInlineMedia();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({
        name: editName,
        bio: editBio,
        avatarFile: editAvatarFile,
        removeAvatar: pendingRemoveAvatar && !editAvatarFile,
      });
      onProfileUpdated(res.user);
      setIsEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (mediaFilter === 'all') return true;
    return p.mediaType === mediaFilter;
  });

  const videosCount = posts.filter((p) => p.mediaType === 'video').length;
  const imagesCount = posts.filter((p) => p.mediaType === 'image').length;

  const displayedAvatar = pendingRemoveAvatar
    ? makeInitialsAvatar(editName || profileUser.name)
    : editAvatarPreview || profileUser.avatarUrl || makeInitialsAvatar(profileUser.name);

  return (
    <div ref={headerRef} className="pilgrim-stack">
      {/* Profile Dashboard Hero Card */}
      <section className="profile-anim bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
        {/* Profile Banner (Uploaded Custom Image or Monochrome Vector Backdrop) */}
        <div className="h-40 sm:h-52 bg-zinc-950 relative overflow-hidden group">
          {profileUser.bannerUrl ? (
            <>
              <img
                src={profileUser.bannerUrl}
                alt={`${profileUser.name} banner`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />
            </>
          ) : (
            <svg
              className="w-full h-full opacity-35"
              viewBox="0 0 800 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <path d="M0 150 H800 M0 100 H800 M0 50 H800" stroke="#3f3f46" strokeWidth="1" />
              <path d="M160 0 V200 M320 0 V200 M480 0 V200 M640 0 V200" stroke="#27272a" strokeWidth="1" />
              <path d="M0 190 L280 45 L480 140 L800 15" stroke="#71717a" strokeWidth="1.5" />
            </svg>
          )}

          {isOwnProfile && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*,image/gif"
                onChange={handleBannerSelect}
                className="hidden"
              />
              <button
                type="button"
                disabled={savingBanner}
                onClick={() => bannerInputRef.current?.click()}
                className="py-1.5 px-3 bg-black/75 hover:bg-black text-white text-xs font-semibold rounded-xl border border-white/15 backdrop-blur-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>
                  {savingBanner
                    ? 'Saving...'
                    : profileUser.bannerUrl
                    ? 'Change Banner'
                    : 'Upload Banner'}
                </span>
              </button>
              {profileUser.bannerUrl && (
                <button
                  type="button"
                  disabled={savingBanner}
                  onClick={handleRemoveBanner}
                  title="Remove banner"
                  className="p-1.5 bg-black/75 hover:bg-red-600 text-white rounded-xl border border-white/15 backdrop-blur-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative z-10">
            <div className="flex items-end gap-4">
              <div className="relative group/avatar shrink-0">
                <img
                  src={displayedAvatar}
                  alt={profileUser.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = makeInitialsAvatar(profileUser.name);
                  }}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-zinc-900 bg-zinc-900 shadow-sm"
                />
                {isOwnProfile && !isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => pfpInputRef.current?.click()}
                    title="Upload and frame profile picture"
                    className="absolute inset-1 rounded-full bg-black/55 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="pb-1">
                <h1 className="font-display text-2xl font-extrabold text-zinc-950 dark:text-white leading-tight">
                  {profileUser.name}
                </h1>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{profileUser.tag}</span>
                </div>
              </div>
            </div>

            <input
              ref={pfpInputRef}
              type="file"
              accept="image/*,image/gif"
              onChange={(e) => handlePfpSelect(e, !isEditingProfile)}
              className="hidden"
            />

            {/* Profile Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="py-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}</span>
                </button>
              ) : (
                <>
                  {isFriend ? (
                    <button
                      type="button"
                      onClick={() => onStartDm(profileUser.id)}
                      className="py-2 px-4 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message Friend</span>
                    </button>
                  ) : pendingDirection === 'outgoing' ? (
                    <span className="py-2 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700">
                      Request Sent
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddFriend(profileUser.tag)}
                      className="py-2 px-4 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Friend</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onReport({
                        targetType: 'user',
                        targetId: profileUser.id,
                        targetUserId: profileUser.id,
                        targetUserName: profileUser.name,
                      })
                    }
                    className="py-2 px-3 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-zinc-600 dark:text-zinc-300 hover:text-red-600 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Bio or Edit Profile Form (Cropped PFP + Banner + Gamer Username + Bio) */}
          {isEditingProfile ? (
            <form
              onSubmit={handleSaveProfile}
              className="mt-5 p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-4"
            >
              {/* Upload & Frame PFP */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-700">
                <div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Profile Picture
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Upload an image or animated GIF for your avatar.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => pfpInputRef.current?.click()}
                    className="py-1.5 px-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PFP / GIF</span>
                  </button>
                  {rawAvatarSrc && (
                    <button
                      type="button"
                      onClick={() =>
                        setCropState({
                          isOpen: true,
                          mode: 'avatar',
                          src: rawAvatarSrc,
                          fileName: rawAvatarName,
                          immediateSave: false,
                        })
                      }
                      className="py-1.5 px-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Re-frame</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditAvatarFile(null);
                      if (editAvatarPreview) URL.revokeObjectURL(editAvatarPreview);
                      setEditAvatarPreview(null);
                      setPendingRemoveAvatar(true);
                    }}
                    className="py-1.5 px-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 rounded-lg cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Gamer Username
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Displayed across servers and posts instead of your real name.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  About You
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell us about yourself..."
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="py-1.5 px-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed">
              {profileUser.bio}
            </p>
          )}

          {/* Clean Tabular Stats Row */}
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-6 text-xs text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums mr-1">
                {posts.length}
              </span>
              <span>Posts</span>
            </div>
            <div>
              <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums mr-1">
                {videosCount}
              </span>
              <span>Videos</span>
            </div>
            <div>
              <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums mr-1">
                {imagesCount}
              </span>
              <span>Images</span>
            </div>
            {!isOwnProfile && (
              <div>
                <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums mr-1">
                  {friendCount}
                </span>
                <span>Friends</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Inline Upload & Post Box on Own Profile Dashboard */}
      {isOwnProfile && (
        <section className="profile-anim bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad">
          <form onSubmit={handlePublishInline} className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title (great for video uploads)..."
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            />
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Share your thoughts, video clip, or image, ${profileUser.name}...`}
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {previewUrl && mediaFile && (
              <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950">
                {mediaFile.type.startsWith('video/') ? (
                  <video src={previewUrl} controls className="w-full max-h-64" />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Media preview"
                    className="w-full max-h-64 object-contain bg-zinc-100 dark:bg-zinc-900"
                  />
                )}
                <button
                  type="button"
                  onClick={clearInlineMedia}
                  className="absolute top-2 right-2 p-1.5 bg-black/80 text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="py-1.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'video/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="py-1.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>

                {/* Visibility Picker */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  {[
                    { id: 'public' as Visibility, label: 'Public', icon: Globe },
                    { id: 'friends' as Visibility, label: 'Friends', icon: Users },
                    { id: 'private' as Visibility, label: 'Private', icon: Lock },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = visibility === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setVisibility(opt.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPublishing || (!content.trim() && !mediaFile)}
                className="py-2 px-4 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isPublishing ? 'Posting...' : 'Post to Profile'}</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter Tabs: All, Videos, Images, Thoughts */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-800 rounded-xl">
          {[
            { id: 'all' as const, label: 'All Posts' },
            { id: 'video' as const, label: 'Videos' },
            { id: 'image' as const, label: 'Images' },
            { id: 'none' as const, label: 'Thoughts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMediaFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                mediaFilter === tab.id
                  ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Feed */}
      <div className="pilgrim-stack">
        {filteredPosts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">No posts in this view yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {isOwnProfile
                ? 'Upload a video, share an image, or write your thoughts above.'
                : 'This user has not shared any posts matching your visibility permissions.'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onLike={onLike}
              onComment={onComment}
              onEditComment={onEditComment}
              onReactComment={onReactComment}
              onHideComment={onHideComment}
              onDeleteComment={onDeleteComment}
              onBlockUser={onBlockUser}
              onShare={onShare}
              onChangeVisibility={onChangeVisibility}
              onDeletePost={onDeletePost}
              onReport={onReport}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </div>

      <ImageCropModal
        isOpen={cropState.isOpen}
        imageSrc={cropState.src}
        mode={cropState.mode}
        fileName={cropState.fileName}
        onCancel={() => setCropState((prev) => ({ ...prev, isOpen: false }))}
        onApply={handleCropApply}
      />
    </div>
  );
};
