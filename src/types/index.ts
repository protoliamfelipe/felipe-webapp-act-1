export type Visibility = 'public' | 'friends' | 'private';

export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export interface VoiceSettings {
  inputMode: 'vad' | 'ptt';
  pttKey: string; // e.g. 'Space', 'KeyV', 'AltLeft'
  inputVolume: number; // 0..200 (%)
  outputVolume: number; // 0..100 (%)
  sensitivity: number; // 0..100
  noiseSuppression: boolean;
  echoCancellation: boolean;
  inputDeviceId?: string;
  outputDeviceId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tag: string; // e.g. FrostByte#0001
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  birthDate?: string;
  squadTitle?: string;
  status?: UserStatus;
  blockedUserIds: string[];
  createdAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: 'compact' | 'standard' | 'large' | 'xlarge';
  letterSpacing: 'tight' | 'normal' | 'relaxed' | 'wide';
  contentSpacing: 'compact' | 'comfortable' | 'spacious';
  notificationSound: boolean;
  voice: VoiceSettings;
}

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  topic?: string;
}

export interface RolePermissions {
  administrator: boolean;
  manageServer: boolean;
  manageRoles: boolean;
  manageChannels: boolean;
  kickMembers: boolean;
  sendMessages: boolean;
  manageMessages: boolean;
  pinMessages: boolean;
  attachFiles: boolean;
  addReactions: boolean;
  connectVoice: boolean;
  speakVoice: boolean;
}

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl?: string;
  iconStyle?: string; // e.g. 'shield' | 'sword' | 'crosshair' | 'crown' | 'compass'
  ownerId: string;
  memberIds: string[];
  channels: Channel[];
  roles: ServerRole[];
  memberRoles: Record<string, string[]>;
  createdAt: string;
}

export interface ChatMessageReplyPreview {
  id: string;
  authorName: string;
  content: string;
  attachmentType?: 'image' | 'audio' | 'video';
}

export interface ChatMessage {
  id: string;
  serverId?: string;
  channelId?: string;
  dmKey?: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorAvatar: string;
  content: string;
  attachmentType?: 'image' | 'audio' | 'video';
  attachmentUrl?: string;
  attachmentName?: string;
  audioDurationSec?: number;
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  bookmarkedByUserIds?: string[];
  editedAt?: string;
  replyToMessageId?: string;
  replyPreview?: ChatMessageReplyPreview;
  forwardedFrom?: {
    authorName: string;
  };
  sharedPostId?: string;
  sharedPostPreview?: {
    id: string;
    title?: string;
    content: string;
    mediaType: 'none' | 'image' | 'video';
    mediaUrl?: string;
    authorName: string;
  };
  createdAt: string;
}

export interface VoiceParticipant {
  userId: string;
  userName: string;
  userAvatar: string;
  serverId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  parentCommentId?: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorAvatar: string;
  content: string;
  editedAt?: string;
  reactions?: Record<string, string[]>;
  hiddenByUserIds?: string[];
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorAvatar: string;
  title?: string;
  content: string;
  mediaType: 'none' | 'image' | 'video';
  mediaUrl?: string;
  visibility: Visibility;
  likes: string[];
  sharesCount: number;
  comments: PostComment[];
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: 'user' | 'post' | 'comment' | 'message';
  targetId: string;
  targetUserId: string;
  targetUserName: string;
  reason: string;
  details: string;
  status: 'Submitted' | 'Under Review';
  createdAt: string;
}

export interface FriendsOverview {
  friends: User[];
  incomingRequests: Array<FriendRequest & { user: User }>;
  outgoingRequests: Array<FriendRequest & { user: User }>;
}
