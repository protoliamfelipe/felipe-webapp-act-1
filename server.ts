import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'pilgrim-community-platform-secret-2026';
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'pilgrim_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export type Visibility = 'public' | 'friends' | 'private';
export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  tag: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  birthDate?: string;
  squadTitle?: string;
  status?: UserStatus;
  blockedUserIds: string[];
  createdAt: string;
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
  iconStyle?: string;
  ownerId: string;
  memberIds: string[];
  channels: Channel[];
  roles?: ServerRole[];
  memberRoles?: Record<string, string[]>;
  createdAt: string;
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
  replyPreview?: {
    id: string;
    authorName: string;
    content: string;
    attachmentType?: 'image' | 'audio' | 'video';
  };
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

export interface PilgrimDB {
  users: StoredUser[];
  servers: Server[];
  messages: ChatMessage[];
  posts: Post[];
  friendRequests: FriendRequest[];
  reports: ReportRecord[];
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeInitialsAvatarUri(name: string): string {
  const initials =
    (name || 'P')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'P';

  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#18181b"/><text x="60" y="70" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="42" fill="#ffffff">${initials}</text></svg>`
  );
}

function calculateAge(birthDateStr: string): number | null {
  if (!birthDateStr || typeof birthDateStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }
  return age;
}

function readDB(): PilgrimDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading pilgrim_db.json:', err);
  }
  return {
    users: [],
    servers: [],
    messages: [],
    posts: [],
    friendRequests: [],
    reports: [],
  };
}

function writeDB(data: PilgrimDB): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing pilgrim_db.json:', err);
  }
}

function sanitizeUser(u: StoredUser) {
  const { passwordHash: _ph, ...safe } = u;
  return safe;
}

function getFriendIds(db: PilgrimDB, userId: string): Set<string> {
  const friends = new Set<string>();
  for (const fr of db.friendRequests) {
    if (fr.status === 'accepted') {
      if (fr.fromUserId === userId) friends.add(fr.toUserId);
      if (fr.toUserId === userId) friends.add(fr.fromUserId);
    }
  }
  return friends;
}

const DEFAULT_MEMBER_PERMS: RolePermissions = {
  administrator: false,
  manageServer: false,
  manageRoles: false,
  manageChannels: false,
  kickMembers: false,
  sendMessages: true,
  manageMessages: false,
  pinMessages: false,
  attachFiles: true,
  addReactions: true,
  connectVoice: true,
  speakVoice: true,
};

function makeDefaultRoles(serverId: string): ServerRole[] {
  return [
    {
      id: `${serverId}_role_admin`,
      name: 'Admin',
      color: '#fafafa',
      permissions: {
        administrator: true,
        manageServer: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        sendMessages: true,
        manageMessages: true,
        pinMessages: true,
        attachFiles: true,
        addReactions: true,
        connectVoice: true,
        speakVoice: true,
      },
    },
    {
      id: `${serverId}_role_mod`,
      name: 'Moderator',
      color: '#a1a1aa',
      permissions: {
        administrator: false,
        manageServer: false,
        manageRoles: false,
        manageChannels: true,
        kickMembers: true,
        sendMessages: true,
        manageMessages: true,
        pinMessages: true,
        attachFiles: true,
        addReactions: true,
        connectVoice: true,
        speakVoice: true,
      },
    },
    {
      id: `${serverId}_role_member`,
      name: 'Member',
      color: '#71717a',
      permissions: { ...DEFAULT_MEMBER_PERMS },
    },
  ];
}

function ensureServerDefaults(srv: Server): Server {
  const roles = srv.roles && srv.roles.length > 0 ? srv.roles : makeDefaultRoles(srv.id);
  const memberRoles: Record<string, string[]> = { ...(srv.memberRoles || {}) };
  if (!memberRoles[srv.ownerId] && roles[0]) {
    memberRoles[srv.ownerId] = [roles[0].id];
  }
  const channels = (srv.channels || []).map((ch) => ({
    ...ch,
    type: ch.type === 'voice' ? ('voice' as const) : ('text' as const),
  }));
  return { ...srv, roles, memberRoles, channels };
}

function hasServerPermission(srv: Server, userId: string, perm: keyof RolePermissions): boolean {
  if (srv.ownerId === userId) return true;
  if (!srv.memberIds.includes(userId)) return false;
  const roles = srv.roles || [];
  const assignedIds = srv.memberRoles?.[userId] || [];
  const assignedRoles = roles.filter((r) => assignedIds.includes(r.id));
  if (assignedRoles.length === 0) {
    return DEFAULT_MEMBER_PERMS[perm];
  }
  return assignedRoles.some((r) => r.permissions.administrator || r.permissions[perm]);
}

function getDmKey(a: string, b: string): string {
  return [a, b].sort().join('__');
}

async function initializeSeedData() {
  const db = readDB();
  if (db.users.length > 0) return;

  const salt = await bcrypt.genSalt(10);
  const demoPass = await bcrypt.hash('password123', salt);
  const now = Date.now();

  const frostAvatar = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#09090b"/><path d="M24 96c0-20 16-32 36-32s36 12 36 32" fill="#f4f4f5"/><circle cx="60" cy="44" r="21" fill="#ffffff"/><path d="M40 42h40v8H40z" fill="#18181b"/><path d="M44 45h12v2H44zm20 0h12v2H64z" fill="#e4e4e7"/></svg>`
  );
  const kitsuneAvatar = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f4f4f5"/><circle cx="60" cy="60" r="42" fill="#09090b"/><path d="M34 86L86 34M42 34h44v44" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
  const pixelAvatar = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#27272a"/><ellipse cx="60" cy="34" rx="26" ry="7" fill="none" stroke="#ffffff" stroke-width="4"/><circle cx="60" cy="64" r="18" fill="#ffffff"/><path d="M30 104c4-15 16-24 30-24s26 9 30 24" fill="#d4d4d8"/></svg>`
  );
  const nightfallAvatar = svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#09090b"/><polygon points="60,20 96,42 96,78 60,100 24,78 24,42" fill="none" stroke="#a1a1aa" stroke-width="3"/><circle cx="60" cy="52" r="15" fill="#ffffff"/><path d="M36 86c5-11 14-16 24-16s19 5 24 16" fill="#d4d4d8"/></svg>`
  );

  const frostByte: StoredUser = {
    id: 'usr_frostbyte',
    email: 'frostbyte@pilgrim.app',
    passwordHash: demoPass,
    name: 'FrostByte',
    tag: 'FrostByte#0001',
    bio: 'Co-op gamer, clip editor, and UI tinkerer. Sharing match highlights, capture setups, and hosting weekend rooms.',
    avatarUrl: frostAvatar,
    birthDate: '2001-05-14',
    status: 'online',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
  };

  const kitsuneDrift: StoredUser = {
    id: 'usr_kitsune',
    email: 'kitsune@pilgrim.app',
    passwordHash: demoPass,
    name: 'KitsuneDrift',
    tag: 'KitsuneDrift#0419',
    bio: 'Indie dev and multiplayer strategist. Always down for evening ranked queues, playtests, and chill voice rooms.',
    avatarUrl: kitsuneAvatar,
    birthDate: '2000-09-21',
    status: 'online',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 25).toISOString(),
  };

  const pixelVanguard: StoredUser = {
    id: 'usr_pixel',
    email: 'pixel@pilgrim.app',
    passwordHash: demoPass,
    name: 'PixelVanguard',
    tag: 'PixelVanguard#0777',
    bio: 'Motion designer and tournament host. Archiving tutorials, clip reels, and weekend bracket recaps.',
    avatarUrl: pixelAvatar,
    birthDate: '1999-11-02',
    status: 'idle',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
  };

  const nightfallGG: StoredUser = {
    id: 'usr_nightfall',
    email: 'nightfall@pilgrim.app',
    passwordHash: demoPass,
    name: 'NightfallGG',
    tag: 'NightfallGG#2026',
    bio: 'Audio producer and tactical RPG player. Connecting creators and teams across communities.',
    avatarUrl: nightfallAvatar,
    birthDate: '2002-03-10',
    status: 'dnd',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
  };

  db.users.push(frostByte, kitsuneDrift, pixelVanguard, nightfallGG);

  // Friendships
  db.friendRequests.push(
    {
      id: 'fr_1',
      fromUserId: frostByte.id,
      toUserId: kitsuneDrift.id,
      status: 'accepted',
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 15).toISOString(),
    },
    {
      id: 'fr_2',
      fromUserId: frostByte.id,
      toUserId: pixelVanguard.id,
      status: 'accepted',
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
    {
      id: 'fr_3',
      fromUserId: nightfallGG.id,
      toUserId: frostByte.id,
      status: 'accepted',
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
    {
      id: 'fr_4',
      fromUserId: kitsuneDrift.id,
      toUserId: nightfallGG.id,
      status: 'pending',
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
    }
  );

  // Servers with text channels, voice channels, and role hierarchy
  const loungeRoles = makeDefaultRoles('srv_lounge');
  const loungeServer: Server = {
    id: 'srv_lounge',
    name: 'Pilgrim Lounge',
    description: 'Open community hangout for introductions, daily conversations, and shared media.',
    category: 'Community & Hangout',
    iconStyle: 'shield',
    ownerId: frostByte.id,
    memberIds: [frostByte.id, kitsuneDrift.id, pixelVanguard.id, nightfallGG.id],
    channels: [
      { id: 'ch_lounge_welcome', name: 'welcome', type: 'text', topic: 'Introduce yourself and meet other members' },
      { id: 'ch_lounge_general', name: 'general', type: 'text', topic: 'Everyday conversation and community updates' },
      { id: 'ch_lounge_media', name: 'media-showcase', type: 'text', topic: 'Share videos, screenshots, and creative work' },
      { id: 'ch_lounge_voice', name: 'Lounge Voice', type: 'voice', topic: 'Hangout & voice chat' },
    ],
    roles: loungeRoles,
    memberRoles: {
      [frostByte.id]: [loungeRoles[0].id],
      [kitsuneDrift.id]: [loungeRoles[1].id],
    },
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
  };

  const gamingRoles = makeDefaultRoles('srv_gaming');
  const gamingServer: Server = {
    id: 'srv_gaming',
    name: 'Co-Op & Gaming Hub',
    description: 'Matchmaking, LFG party finder, strategy discussions, and highlight clips.',
    category: 'Gaming & Co-Op',
    iconStyle: 'crosshair',
    ownerId: kitsuneDrift.id,
    memberIds: [kitsuneDrift.id, frostByte.id, nightfallGG.id],
    channels: [
      { id: 'ch_gaming_lobby', name: 'lobby-chat', type: 'text', topic: 'General gaming news and session planning' },
      { id: 'ch_gaming_lfg', name: 'lfg-party', type: 'text', topic: 'Find teammates for co-op and ranked matches' },
      { id: 'ch_gaming_clips', name: 'clips-and-guides', type: 'text', topic: 'Post match highlights and setup notes' },
      { id: 'ch_gaming_voice', name: 'Squad Comms', type: 'voice', topic: 'Drop in for live co-op voice chat' },
    ],
    roles: gamingRoles,
    memberRoles: {
      [kitsuneDrift.id]: [gamingRoles[0].id],
    },
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString(),
  };

  const creatorRoles = makeDefaultRoles('srv_creators');
  const creatorServer: Server = {
    id: 'srv_creators',
    name: 'Creator Studio',
    description: 'Discoverable server for video editors, designers, and streamers exchanging feedback.',
    category: 'Creators & Video',
    iconStyle: 'compass',
    ownerId: pixelVanguard.id,
    memberIds: [pixelVanguard.id, frostByte.id],
    channels: [
      { id: 'ch_creators_feedback', name: 'feedback', type: 'text', topic: 'Post work-in-progress clips and thumbnails for critique' },
      { id: 'ch_creators_tools', name: 'editing-workflow', type: 'text', topic: 'Cameras, OBS presets, and export pipelines' },
      { id: 'ch_creators_voice', name: 'Review Stage', type: 'voice', topic: 'Live review & audio feedback room' },
    ],
    roles: creatorRoles,
    memberRoles: {
      [pixelVanguard.id]: [creatorRoles[0].id],
    },
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 8).toISOString(),
  };

  db.servers.push(loungeServer, gamingServer, creatorServer);

  // Initial Chat Messages
  db.messages.push(
    {
      id: 'msg_1',
      serverId: loungeServer.id,
      channelId: 'ch_lounge_welcome',
      authorId: frostByte.id,
      authorName: frostByte.name,
      authorTag: frostByte.tag,
      authorAvatar: frostByte.avatarUrl,
      content: 'Welcome to Pilgrim Lounge! Drop an intro here or share your latest video post in #media-showcase.',
      createdAt: new Date(now - 1000 * 60 * 50).toISOString(),
    },
    {
      id: 'msg_2',
      serverId: loungeServer.id,
      channelId: 'ch_lounge_welcome',
      authorId: kitsuneDrift.id,
      authorName: kitsuneDrift.name,
      authorTag: kitsuneDrift.tag,
      authorAvatar: kitsuneDrift.avatarUrl,
      content: 'Glad to be here! I am running co-op lobbies tonight if anyone wants to join in #lfg-party.',
      createdAt: new Date(now - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'msg_3',
      serverId: loungeServer.id,
      channelId: 'ch_lounge_general',
      authorId: pixelVanguard.id,
      authorName: pixelVanguard.name,
      authorTag: pixelVanguard.tag,
      authorAvatar: pixelVanguard.avatarUrl,
      content: 'Just tested the new letter sizing and dark mode settings — super comfortable for late-night editing.',
      createdAt: new Date(now - 1000 * 60 * 20).toISOString(),
    },
    {
      id: 'msg_4',
      serverId: gamingServer.id,
      channelId: 'ch_gaming_lobby',
      authorId: nightfallGG.id,
      authorName: nightfallGG.name,
      authorTag: nightfallGG.tag,
      authorAvatar: nightfallGG.avatarUrl,
      content: 'Looking for two players for weekend tournament warmups around 8 PM!',
      createdAt: new Date(now - 1000 * 60 * 40).toISOString(),
    }
  );

  // Seed Posts (Users can upload their own real images/videos)
  db.posts.push(
    {
      id: 'post_1',
      authorId: frostByte.id,
      authorName: frostByte.name,
      authorTag: frostByte.tag,
      authorAvatar: frostByte.avatarUrl,
      title: '60fps Capture Settings & Color Grading Notes for Gameplay Clips',
      content:
        'Switched to 1440p60 CBR at 18 Mbps and clean lossless audio tracks before exporting highlights. Keeps fast camera pans crisp without bloating upload sizes. Let me know what bitrate settings you use!',
      mediaType: 'none',
      visibility: 'public',
      likes: [kitsuneDrift.id, pixelVanguard.id, nightfallGG.id],
      sharesCount: 6,
      comments: [
        {
          id: 'cmt_1',
          postId: 'post_1',
          authorId: kitsuneDrift.id,
          authorName: kitsuneDrift.name,
          authorTag: kitsuneDrift.tag,
          authorAvatar: kitsuneDrift.avatarUrl,
          content: 'Tried 18 Mbps last week and the motion clarity is night and day.',
          reactions: { '🔥': [frostByte.id, pixelVanguard.id], '👍': [nightfallGG.id] },
          hiddenByUserIds: [],
          createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
        },
        {
          id: 'cmt_1_reply',
          postId: 'post_1',
          parentCommentId: 'cmt_1',
          authorId: frostByte.id,
          authorName: frostByte.name,
          authorTag: frostByte.tag,
          authorAvatar: frostByte.avatarUrl,
          content: 'Right? Pair it with P6 preset and zero dropped frames.',
          reactions: { '👍': [kitsuneDrift.id] },
          hiddenByUserIds: [],
          createdAt: new Date(now - 1000 * 60 * 70).toISOString(),
        },
        {
          id: 'cmt_2',
          postId: 'post_1',
          authorId: nightfallGG.id,
          authorName: nightfallGG.name,
          authorTag: nightfallGG.tag,
          authorAvatar: nightfallGG.avatarUrl,
          content: 'Sharing this with the Creator Studio workflow channel!',
          reactions: { '❤️': [frostByte.id] },
          hiddenByUserIds: [],
          createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
        },
      ],
      createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
    },
    {
      id: 'post_2',
      authorId: kitsuneDrift.id,
      authorName: kitsuneDrift.name,
      authorTag: kitsuneDrift.tag,
      authorAvatar: kitsuneDrift.avatarUrl,
      title: 'Weekend Co-Op Lobby Schedule & Voice Etiquette',
      content:
        'Hosting open co-op lobbies Friday and Saturday evenings. Beginners welcome — drop your tag in Friends & DMs if you want an invite before we queue up.',
      mediaType: 'none',
      visibility: 'public',
      likes: [frostByte.id, nightfallGG.id],
      sharesCount: 3,
      comments: [],
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'post_3',
      authorId: pixelVanguard.id,
      authorName: pixelVanguard.name,
      authorTag: pixelVanguard.tag,
      authorAvatar: pixelVanguard.avatarUrl,
      title: 'Motion Reel Rough Cut Feedback (Friends Only)',
      content:
        'Sharing early timing notes for our next community intro sequence with friends only before publishing publicly.',
      mediaType: 'none',
      visibility: 'friends',
      likes: [frostByte.id],
      sharesCount: 1,
      comments: [],
      createdAt: new Date(now - 1000 * 60 * 60 * 9).toISOString(),
    },
    {
      id: 'post_4',
      authorId: frostByte.id,
      authorName: frostByte.name,
      authorTag: frostByte.tag,
      authorAvatar: frostByte.avatarUrl,
      title: 'Personal Editing Checklist (Private)',
      content:
        'Normalize dialogue to -14 LUFS, trim dead air on intro, and export clean thumbnail frame before posting.',
      mediaType: 'none',
      visibility: 'private',
      likes: [],
      sharesCount: 0,
      comments: [],
      createdAt: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
    }
  );

  writeDB(db);
}

initializeSeedData().catch(console.error);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}_${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    tag: string;
  };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      tag: string;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use('/uploads', express.static(UPLOADS_DIR));

  // WebSocket Setup for Real-Time Chat, Presence, and Voice Channels
  const wss = new WebSocketServer({ server, path: '/ws' });
  const activeSockets = new Map<string, Set<WebSocket>>();
  // channelId -> Map<userId, VoiceParticipant>
  const voiceChannels = new Map<string, Map<string, VoiceParticipant>>();

  function broadcastToAll(payload: unknown) {
    const msg = JSON.stringify(payload);
    for (const sockets of activeSockets.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  }

  function broadcastToUsers(userIds: string[], payload: unknown) {
    const msg = JSON.stringify(payload);
    for (const uid of userIds) {
      const sockets = activeSockets.get(uid);
      if (sockets) {
        for (const ws of sockets) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
          }
        }
      }
    }
  }

  function getVisibleOnlineUserIds(): string[] {
    const db = readDB();
    const invisibleIds = new Set(
      db.users.filter((u) => u.status === 'invisible').map((u) => u.id)
    );
    return Array.from(activeSockets.keys()).filter((uid) => !invisibleIds.has(uid));
  }

  function broadcastPresence() {
    broadcastToAll({
      type: 'presence:update',
      onlineUserIds: getVisibleOnlineUserIds(),
    });
  }

  function getServerVoiceParticipants(serverId: string): VoiceParticipant[] {
    const list: VoiceParticipant[] = [];
    for (const room of voiceChannels.values()) {
      for (const p of room.values()) {
        if (p.serverId === serverId) list.push(p);
      }
    }
    return list;
  }

  function broadcastVoiceForServer(serverId: string) {
    const db = readDB();
    const srv = db.servers.find((s) => s.id === serverId);
    const participants = getServerVoiceParticipants(serverId);
    if (srv) {
      broadcastToUsers(srv.memberIds, {
        type: 'voice:participants',
        serverId,
        participants,
      });
    } else {
      broadcastToAll({
        type: 'voice:participants',
        serverId,
        participants,
      });
    }
  }

  function removeUserFromVoice(userId: string): string | null {
    let leftServerId: string | null = null;
    for (const [channelId, room] of voiceChannels.entries()) {
      const existing = room.get(userId);
      if (existing) {
        leftServerId = existing.serverId;
        room.delete(userId);
        if (room.size === 0) voiceChannels.delete(channelId);
      }
    }
    return leftServerId;
  }

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const userId = decoded.id;

      if (!activeSockets.has(userId)) {
        activeSockets.set(userId, new Set());
      }
      activeSockets.get(userId)!.add(ws);
      broadcastPresence();

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'voice:join' && msg.serverId && msg.channelId) {
            const db = readDB();
            const user = db.users.find((u) => u.id === userId);
            const srv = db.servers.find((s) => s.id === msg.serverId);
            if (!user || !srv || !hasServerPermission(srv, userId, 'connectVoice')) return;

            const prevServerId = removeUserFromVoice(userId);
            if (prevServerId && prevServerId !== srv.id) {
              broadcastVoiceForServer(prevServerId);
            }

            if (!voiceChannels.has(msg.channelId)) {
              voiceChannels.set(msg.channelId, new Map());
            }
            voiceChannels.get(msg.channelId)!.set(userId, {
              userId,
              userName: user.name,
              userAvatar: user.avatarUrl,
              serverId: srv.id,
              channelId: msg.channelId,
              muted: Boolean(msg.muted),
              deafened: Boolean(msg.deafened),
              speaking: false,
            });
            broadcastVoiceForServer(srv.id);
          } else if (msg.type === 'voice:leave') {
            const leftServerId = removeUserFromVoice(userId);
            if (leftServerId) broadcastVoiceForServer(leftServerId);
          } else if (msg.type === 'voice:state') {
            for (const room of voiceChannels.values()) {
              const p = room.get(userId);
              if (p) {
                if (typeof msg.muted === 'boolean') p.muted = msg.muted;
                if (typeof msg.deafened === 'boolean') p.deafened = msg.deafened;
                if (typeof msg.speaking === 'boolean') p.speaking = msg.speaking;
                broadcastVoiceForServer(p.serverId);
                break;
              }
            }
          } else if (msg.type === 'voice:signal' && msg.targetUserId) {
            broadcastToUsers([msg.targetUserId], {
              type: 'voice:signal',
              fromUserId: userId,
              channelId: msg.channelId,
              signal: msg.signal,
            });
          }
        } catch {
          // Ignore malformed ws messages
        }
      });

      ws.on('close', () => {
        const set = activeSockets.get(userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            activeSockets.delete(userId);
            const leftServerId = removeUserFromVoice(userId);
            if (leftServerId) broadcastVoiceForServer(leftServerId);
          }
        }
        broadcastPresence();
      });
    } catch {
      ws.close(1008, 'Invalid token');
    }
  });

  // --- HEALTH & AUTH ROUTES ---

  app.get('/api/health', (_req: Request, res: Response) => {
    return res.json({ ok: true });
  });

  app.post('/api/auth/register', upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      const { email, password, name, bio, birthDate, squadTitle, presetAvatarUrl } = req.body;

      if (!email || !password || !name || !birthDate) {
        return res.status(400).json({
          error: 'Please provide your name, email, password, and date of birth.',
        });
      }

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      // Strict Age Verification: 12 and below -> Access Denied until 13+
      const age = calculateAge(birthDate);
      if (age === null || age < 0 || age > 120) {
        return res.status(400).json({ error: 'Please enter a valid date of birth.' });
      }

      if (age <= 12) {
        return res.status(403).json({
          ageRestricted: true,
          error:
            'Access Denied: Pilgrim requires users to be at least 13 years old. Accounts for ages 12 and below cannot be created until you reach age 13.',
        });
      }

      const db = readDB();
      const normalizedEmail = email.toLowerCase().trim();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const cleanBase = name.trim().replace(/[^a-zA-Z0-9]/g, '') || 'Pilgrim';
      const discrim = Math.floor(1000 + Math.random() * 9000);

      let avatarUrl = makeInitialsAvatarUri(name.trim());
      if (req.file) {
        avatarUrl = `/uploads/${req.file.filename}`;
      } else if (presetAvatarUrl && typeof presetAvatarUrl === 'string' && presetAvatarUrl.startsWith('data:image/svg+xml')) {
        avatarUrl = presetAvatarUrl;
      }

      const newUser: StoredUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        tag: `${cleanBase}#${discrim}`,
        bio:
          bio?.trim() ||
          'New to Pilgrim. Exploring communities and sharing posts.',
        avatarUrl,
        birthDate,
        squadTitle: squadTitle?.trim() || undefined,
        status: 'online',
        blockedUserIds: [],
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      writeDB(db);

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, name: newUser.name, tag: newUser.tag },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        token,
        user: sanitizeUser(newUser),
        isNewSignup: true,
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  // Passwordless Email Verification Code / Magic Link Challenges
  const emailLoginChallenges = new Map<
    string,
    {
      code: string;
      magicToken: string;
      userId: string;
      email: string;
      expiresAt: number;
      attempts: number;
    }
  >();

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Please enter both email and password.' });
      }

      const db = readDB();
      const ident = String(email).toLowerCase().trim();
      const user = db.users.find(
        (u) => u.email.toLowerCase() === ident || u.tag.toLowerCase() === ident
      );
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, tag: user.tag },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        token,
        user: sanitizeUser(user),
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Sign in failed.' });
    }
  });

  app.post('/api/auth/email/request-code', async (req: Request, res: Response) => {
    try {
      const rawEmail = req.body?.email;
      if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const normalizedEmail = rawEmail.toLowerCase().trim();
      const db = readDB();
      const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (!user) {
        return res.status(404).json({
          notRegistered: true,
          error:
            'No Pilgrim account exists for that email address. Switch to Create an Account to sign up (13+ only).',
        });
      }

      const code = String(crypto.randomInt(100000, 1000000));
      const magicToken = crypto.randomBytes(24).toString('hex');
      const expiresAt = Date.now() + 10 * 60 * 1000;

      emailLoginChallenges.set(normalizedEmail, {
        code,
        magicToken,
        userId: user.id,
        email: normalizedEmail,
        expiresAt,
        attempts: 0,
      });

      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          const appUrl = process.env.APP_URL || 'http://localhost:3000';
          const verifyUrl = `${appUrl}/?emailToken=${encodeURIComponent(magicToken)}`;
          const mailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'Pilgrim <onboarding@resend.dev>',
              to: [normalizedEmail],
              subject: `Your Pilgrim sign-in code: ${code}`,
              html: `<p>Hi ${user.name},</p><p>Your Pilgrim sign-in code is <strong>${code}</strong> (expires in 10 minutes).</p><p><a href="${verifyUrl}">Or click here to sign in directly</a></p>`,
            }),
          });
          if (mailRes.ok) {
            return res.json({
              sent: true,
              deliveryMode: 'email',
              expiresInSeconds: 600,
            });
          }
        } catch {
          // Fall back cleanly to preview delivery if email relay fails
        }
      }

      return res.json({
        sent: true,
        deliveryMode: 'preview',
        previewCode: code,
        magicToken,
        expiresInSeconds: 600,
      });
    } catch (err) {
      console.error('Request email code error:', err);
      return res.status(500).json({ error: 'Unable to send verification code.' });
    }
  });

  app.post('/api/auth/email/verify-code', (req: Request, res: Response) => {
    try {
      const { email, code, magicToken } = req.body || {};

      let matchedKey: string | null = null;
      let challenge: {
        code: string;
        magicToken: string;
        userId: string;
        email: string;
        expiresAt: number;
        attempts: number;
      } | null = null;

      if (magicToken && typeof magicToken === 'string') {
        for (const [k, v] of emailLoginChallenges.entries()) {
          if (v.magicToken === magicToken.trim()) {
            matchedKey = k;
            challenge = v;
            break;
          }
        }
      } else if (email && typeof email === 'string' && code && typeof code === 'string') {
        const key = email.toLowerCase().trim();
        matchedKey = key;
        challenge = emailLoginChallenges.get(key) || null;
      } else {
        return res.status(400).json({ error: 'Enter your email and 6-digit verification code.' });
      }

      if (!challenge || !matchedKey) {
        return res.status(400).json({ error: 'Verification code is invalid or expired. Request a new code.' });
      }

      if (Date.now() > challenge.expiresAt) {
        emailLoginChallenges.delete(matchedKey);
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }

      if (!magicToken) {
        const entered = String(code).trim();
        if (entered !== challenge.code) {
          challenge.attempts += 1;
          if (challenge.attempts >= 5) {
            emailLoginChallenges.delete(matchedKey);
            return res.status(429).json({
              error: 'Too many incorrect attempts. Please request a new verification code.',
            });
          }
          return res.status(401).json({ error: 'Incorrect verification code. Please try again.' });
        }
      }

      emailLoginChallenges.delete(matchedKey);

      const db = readDB();
      const user = db.users.find((u) => u.id === challenge!.userId);
      if (!user) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, tag: user.tag },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        token,
        user: sanitizeUser(user),
      });
    } catch (err) {
      console.error('Verify email code error:', err);
      return res.status(500).json({ error: 'Email verification failed.' });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const user = db.users.find((u) => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    return res.json({ user: sanitizeUser(user) });
  });

  app.patch('/api/users/me/status', authMiddleware, (req: AuthRequest, res: Response) => {
    const { status } = req.body;
    const validStatuses: UserStatus[] = ['online', 'idle', 'dnd', 'invisible'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const db = readDB();
    const user = db.users.find((u) => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.status = status;
    writeDB(db);
    broadcastPresence();
    broadcastToAll({
      type: 'presence:status',
      userId: user.id,
      status: status === 'invisible' ? 'offline' : status,
    });
    return res.json({ user: sanitizeUser(user) });
  });

  // --- PROFILE ROUTES ---

  app.patch(
    '/api/users/me',
    authMiddleware,
    upload.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ]),
    (req: AuthRequest, res: Response) => {
      const db = readDB();
      const user = db.users.find((u) => u.id === req.user!.id);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const { name, bio, squadTitle, presetAvatarUrl, removeAvatar, removeBanner } = req.body;
      if (name && typeof name === 'string' && name.trim()) {
        user.name = name.trim();
        if (user.avatarUrl.startsWith('data:image/svg+xml') && !presetAvatarUrl && removeAvatar !== 'true') {
          // Keep existing geometric avatar unless removing
        }
      }
      if (bio !== undefined && typeof bio === 'string') user.bio = bio.trim();
      if (squadTitle !== undefined && typeof squadTitle === 'string') user.squadTitle = squadTitle.trim();

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const avatarUpload = files?.avatar?.[0];
      const bannerUpload = files?.banner?.[0];

      if (avatarUpload) {
        user.avatarUrl = `/uploads/${avatarUpload.filename}`;
      } else if (removeAvatar === 'true') {
        user.avatarUrl = makeInitialsAvatarUri(user.name);
      } else if (
        presetAvatarUrl &&
        typeof presetAvatarUrl === 'string' &&
        presetAvatarUrl.startsWith('data:image/svg+xml')
      ) {
        user.avatarUrl = presetAvatarUrl;
      }

      if (bannerUpload) {
        user.bannerUrl = `/uploads/${bannerUpload.filename}`;
      } else if (removeBanner === 'true') {
        user.bannerUrl = undefined;
      }

      for (const p of db.posts) {
        if (p.authorId === user.id) {
          p.authorName = user.name;
          p.authorAvatar = user.avatarUrl;
        }
        for (const c of p.comments) {
          if (c.authorId === user.id) {
            c.authorName = user.name;
            c.authorAvatar = user.avatarUrl;
          }
        }
      }

      for (const m of db.messages) {
        if (m.authorId === user.id) {
          m.authorName = user.name;
          m.authorAvatar = user.avatarUrl;
        }
      }

      writeDB(db);
      return res.json({ user: sanitizeUser(user) });
    }
  );

  app.get('/api/users/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const friendIds = getFriendIds(db, req.user!.id);
    const targetFriends = getFriendIds(db, target.id);
    const pendingReq = db.friendRequests.find(
      (fr) =>
        fr.status === 'pending' &&
        ((fr.fromUserId === req.user!.id && fr.toUserId === target.id) ||
          (fr.fromUserId === target.id && fr.toUserId === req.user!.id))
    );

    return res.json({
      user: sanitizeUser(target),
      isFriend: friendIds.has(target.id),
      friendCount: targetFriends.size,
      pendingDirection: pendingReq
        ? pendingReq.fromUserId === req.user!.id
          ? 'outgoing'
          : 'incoming'
        : null,
    });
  });

  app.post('/api/users/block', authMiddleware, (req: AuthRequest, res: Response) => {
    const { targetUserId } = req.body;
    const db = readDB();
    const me = db.users.find((u) => u.id === req.user!.id);
    if (!me) return res.status(404).json({ error: 'User not found.' });

    if (targetUserId === me.id) {
      return res.status(400).json({ error: 'Cannot block yourself.' });
    }

    const idx = me.blockedUserIds.indexOf(targetUserId);
    let blocked = false;
    if (idx === -1) {
      me.blockedUserIds.push(targetUserId);
      blocked = true;
    } else {
      me.blockedUserIds.splice(idx, 1);
      blocked = false;
    }

    writeDB(db);
    return res.json({ blocked, blockedUserIds: me.blockedUserIds });
  });

  // --- SERVERS & REAL-TIME CHAT ---

  app.get('/api/servers', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const q = (req.query.q as string)?.toLowerCase().trim() || '';
    const userId = req.user!.id;

    let servers = db.servers.map(ensureServerDefaults);
    if (q) {
      servers = servers.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    const enriched = servers.map((s) => ({
      ...s,
      isMember: s.memberIds.includes(userId),
      memberCount: s.memberIds.length,
    }));

    return res.json({ servers: enriched });
  });

  app.post('/api/servers', authMiddleware, upload.single('icon'), (req: AuthRequest, res: Response) => {
    const { name, description, category, iconStyle } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please enter a server name.' });
    }

    const db = readDB();
    const userId = req.user!.id;
    const serverId = `srv_${Date.now()}`;
    const roles = makeDefaultRoles(serverId);
    const newServer: Server = {
      id: serverId,
      name: name.trim(),
      description: description?.trim() || 'A Pilgrim community server.',
      category: category?.trim() || 'Community & Hangout',
      iconUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      iconStyle: iconStyle || 'shield',
      ownerId: userId,
      memberIds: [userId],
      channels: [
        { id: `ch_${Date.now()}_1`, name: 'general', type: 'text', topic: `Welcome to ${name.trim()}!` },
        { id: `ch_${Date.now()}_2`, name: 'media-showcase', type: 'text', topic: 'Share clips, images, and updates' },
        { id: `ch_${Date.now()}_3`, name: 'Lounge Voice', type: 'voice', topic: 'Live voice room' },
      ],
      roles,
      memberRoles: {
        [userId]: [roles[0].id],
      },
      createdAt: new Date().toISOString(),
    };

    db.servers.push(newServer);
    writeDB(db);

    broadcastToAll({ type: 'server:created', server: newServer });
    return res.status(201).json({
      server: { ...newServer, isMember: true, memberCount: 1 },
    });
  });

  app.post('/api/servers/:id/join', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!srv.memberIds.includes(req.user!.id)) {
      srv.memberIds.push(req.user!.id);
    }
    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    return res.json({
      server: { ...srv, isMember: true, memberCount: srv.memberIds.length },
    });
  });

  app.post('/api/servers/:id/channels', authMiddleware, (req: AuthRequest, res: Response) => {
    const { name, topic, type = 'text' } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Channel name is required.' });
    }

    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'manageChannels')) {
      return res.status(403).json({
        error: 'Only the server owner or members with Manage Channels permission can create channels.',
      });
    }

    const channelType: 'text' | 'voice' = type === 'voice' ? 'voice' : 'text';
    const cleanName =
      channelType === 'voice'
        ? name.trim()
        : name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '');

    const channel: Channel = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: cleanName || (channelType === 'voice' ? 'Voice Room' : 'new-channel'),
      type: channelType,
      topic: topic?.trim() || '',
    };

    srv.channels.push(channel);
    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers(srv.memberIds, { type: 'server:updated', server: srv });
    return res.status(201).json({ channel, server: srv });
  });

  app.post('/api/servers/:id/roles', authMiddleware, (req: AuthRequest, res: Response) => {
    const { name, color = '#e4e4e7', permissions } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required.' });
    }
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'manageRoles')) {
      return res.status(403).json({ error: 'Only the server owner or role managers can create roles.' });
    }

    const role: ServerRole = {
      id: `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      color: typeof color === 'string' && color.trim() ? color.trim() : '#e4e4e7',
      permissions: {
        ...DEFAULT_MEMBER_PERMS,
        ...(permissions && typeof permissions === 'object' ? permissions : {}),
      },
    };
    srv.roles = [...(srv.roles || []), role];
    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers(srv.memberIds, { type: 'server:updated', server: srv });
    return res.status(201).json({ role, server: srv });
  });

  app.patch('/api/servers/:id/roles/:roleId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'manageRoles')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const role = (srv.roles || []).find((r) => r.id === req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Role not found.' });

    const { name, color, permissions } = req.body;
    if (name && typeof name === 'string' && name.trim()) role.name = name.trim();
    if (color && typeof color === 'string') role.color = color;
    if (permissions && typeof permissions === 'object') {
      role.permissions = { ...role.permissions, ...permissions };
    }

    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers(srv.memberIds, { type: 'server:updated', server: srv });
    return res.json({ role, server: srv });
  });

  app.delete('/api/servers/:id/roles/:roleId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'manageRoles')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    srv.roles = (srv.roles || []).filter((r) => r.id !== req.params.roleId);
    const nextMemberRoles: Record<string, string[]> = {};
    for (const [uid, rids] of Object.entries(srv.memberRoles || {})) {
      nextMemberRoles[uid] = rids.filter((id) => id !== req.params.roleId);
    }
    srv.memberRoles = nextMemberRoles;

    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers(srv.memberIds, { type: 'server:updated', server: srv });
    return res.json({ server: srv });
  });

  app.post('/api/servers/:id/members/:userId/roles', authMiddleware, (req: AuthRequest, res: Response) => {
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'roleIds array is required.' });
    }
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'manageRoles')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const validIds = new Set((srv.roles || []).map((r) => r.id));
    srv.memberRoles = {
      ...(srv.memberRoles || {}),
      [req.params.userId]: roleIds.filter((id: string) => validIds.has(id)),
    };

    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers(srv.memberIds, { type: 'server:updated', server: srv });
    return res.json({ server: srv });
  });

  app.delete('/api/servers/:id/members/:userId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    if (!hasServerPermission(srv, req.user!.id, 'kickMembers')) {
      return res.status(403).json({ error: 'Your role does not allow removing members.' });
    }
    if (req.params.userId === srv.ownerId) {
      return res.status(400).json({ error: 'Cannot remove the server owner.' });
    }

    srv.memberIds = srv.memberIds.filter((id) => id !== req.params.userId);
    if (srv.memberRoles) {
      delete srv.memberRoles[req.params.userId];
    }

    const idx = db.servers.findIndex((s) => s.id === srv.id);
    if (idx !== -1) db.servers[idx] = srv;
    writeDB(db);

    broadcastToUsers([...srv.memberIds, req.params.userId], { type: 'server:updated', server: srv });
    return res.json({ server: srv });
  });

  app.get('/api/servers/:id/voice', authMiddleware, (req: AuthRequest, res: Response) => {
    return res.json({ participants: getServerVoiceParticipants(req.params.id) });
  });

  app.get('/api/servers/:id/messages', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const rawSrv = db.servers.find((s) => s.id === req.params.id);
    if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
    const srv = ensureServerDefaults(rawSrv);

    const me = db.users.find((u) => u.id === req.user!.id);
    const blocked = new Set(me?.blockedUserIds || []);

    const channelId =
      (req.query.channelId as string) ||
      srv.channels.find((c) => c.type === 'text')?.id ||
      srv.channels[0]?.id;
    const messages = db.messages.filter(
      (m) => m.serverId === srv.id && m.channelId === channelId && !blocked.has(m.authorId)
    );

    const members = db.users
      .filter((u) => srv.memberIds.includes(u.id))
      .map((u) => {
        const safe = sanitizeUser(u);
        if (safe.id !== req.user!.id && safe.status === 'invisible') {
          safe.status = undefined;
        }
        return safe;
      });

    return res.json({ messages, members });
  });

  app.post(
    '/api/servers/:id/messages',
    authMiddleware,
    upload.single('attachment'),
    (req: AuthRequest, res: Response) => {
      const { channelId, content, sharedPostId, replyToMessageId, forwardedFromAuthor, audioDurationSec } =
        req.body || {};
      const file = req.file;

      if ((!content || !String(content).trim()) && !sharedPostId && !file) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
      }

      const db = readDB();
      const rawSrv = db.servers.find((s) => s.id === req.params.id);
      if (!rawSrv) return res.status(404).json({ error: 'Server not found.' });
      const srv = ensureServerDefaults(rawSrv);

      if (!srv.memberIds.includes(req.user!.id)) {
        srv.memberIds.push(req.user!.id);
      }

      if (!hasServerPermission(srv, req.user!.id, 'sendMessages')) {
        return res.status(403).json({ error: 'Your role does not allow sending messages in this server.' });
      }
      if (file && !hasServerPermission(srv, req.user!.id, 'attachFiles')) {
        return res.status(403).json({ error: 'Your role does not allow uploading attachments.' });
      }

      const author = db.users.find((u) => u.id === req.user!.id);
      if (!author) return res.status(404).json({ error: 'User not found.' });

      let sharedPostPreview: ChatMessage['sharedPostPreview'];
      if (sharedPostId) {
        const post = db.posts.find((p) => p.id === sharedPostId);
        if (post) {
          post.sharesCount = (post.sharesCount || 0) + 1;
          sharedPostPreview = {
            id: post.id,
            title: post.title,
            content: post.content,
            mediaType: post.mediaType,
            mediaUrl: post.mediaUrl,
            authorName: post.authorName,
          };
        }
      }

      let attachmentType: ChatMessage['attachmentType'];
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      if (file) {
        if (file.mimetype.startsWith('audio/')) attachmentType = 'audio';
        else if (file.mimetype.startsWith('video/')) attachmentType = 'video';
        else attachmentType = 'image';
        attachmentUrl = `/uploads/${file.filename}`;
        attachmentName = file.originalname;
      }

      let replyPreview: ChatMessage['replyPreview'];
      if (replyToMessageId) {
        const refMsg = db.messages.find((m) => m.id === replyToMessageId);
        if (refMsg) {
          replyPreview = {
            id: refMsg.id,
            authorName: refMsg.authorName,
            content: refMsg.content || (refMsg.attachmentType ? `[${refMsg.attachmentType}]` : ''),
            attachmentType: refMsg.attachmentType,
          };
        }
      }

      const fallbackText =
        attachmentType === 'audio'
          ? 'Voice message'
          : attachmentType === 'image'
          ? ''
          : sharedPostId
          ? 'Shared a post'
          : '';

      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        serverId: srv.id,
        channelId: channelId || srv.channels.find((c) => c.type === 'text')?.id || srv.channels[0]?.id,
        authorId: author.id,
        authorName: author.name,
        authorTag: author.tag,
        authorAvatar: author.avatarUrl,
        content: content !== undefined ? String(content).trim() : fallbackText,
        attachmentType,
        attachmentUrl,
        attachmentName,
        audioDurationSec: audioDurationSec ? Number(audioDurationSec) : undefined,
        reactions: {},
        pinned: false,
        bookmarkedByUserIds: [],
        replyToMessageId: replyToMessageId || undefined,
        replyPreview,
        forwardedFrom: forwardedFromAuthor ? { authorName: String(forwardedFromAuthor) } : undefined,
        sharedPostId,
        sharedPostPreview,
        createdAt: new Date().toISOString(),
      };

      db.messages.push(message);
      writeDB(db);

      broadcastToUsers(srv.memberIds, { type: 'chat:message', message });
      return res.status(201).json({ message });
    }
  );

  // --- FRIENDS & DIRECT MESSAGES ---

  app.get('/api/friends', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const meId = req.user!.id;
    const friendIds = getFriendIds(db, meId);

    const sanitizePublicUser = (u: StoredUser) => {
      const safe = sanitizeUser(u);
      if (safe.id !== meId && safe.status === 'invisible') {
        safe.status = undefined;
      }
      return safe;
    };

    const friends = db.users.filter((u) => friendIds.has(u.id)).map(sanitizePublicUser);

    const incomingRequests = db.friendRequests
      .filter((fr) => fr.toUserId === meId && fr.status === 'pending')
      .map((fr) => {
        const sender = db.users.find((u) => u.id === fr.fromUserId);
        return sender ? { ...fr, user: sanitizePublicUser(sender) } : null;
      })
      .filter(Boolean);

    const outgoingRequests = db.friendRequests
      .filter((fr) => fr.fromUserId === meId && fr.status === 'pending')
      .map((fr) => {
        const recipient = db.users.find((u) => u.id === fr.toUserId);
        return recipient ? { ...fr, user: sanitizePublicUser(recipient) } : null;
      })
      .filter(Boolean);

    const pendingUserIds = new Set<string>();
    db.friendRequests
      .filter((fr) => fr.status === 'pending' && (fr.fromUserId === meId || fr.toUserId === meId))
      .forEach((fr) => {
        pendingUserIds.add(fr.fromUserId);
        pendingUserIds.add(fr.toUserId);
      });

    const discoverPlayers = db.users
      .filter((u) => u.id !== meId && !friendIds.has(u.id) && !pendingUserIds.has(u.id))
      .map(sanitizePublicUser);

    return res.json({
      friends,
      incomingRequests,
      outgoingRequests,
      discoverPlayers,
    });
  });

  app.post('/api/friends/request', authMiddleware, (req: AuthRequest, res: Response) => {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'Enter a gamer tag (e.g. KitsuneDrift#0419) or email.' });
    }

    const db = readDB();
    const meId = req.user!.id;
    const q = identifier.trim().toLowerCase();

    const target = db.users.find(
      (u) => u.tag.toLowerCase() === q || u.email.toLowerCase() === q || u.name.toLowerCase() === q
    );

    if (!target) {
      return res.status(404).json({ error: `No user found matching "${identifier.trim()}".` });
    }
    if (target.id === meId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    const existing = db.friendRequests.find(
      (fr) =>
        (fr.fromUserId === meId && fr.toUserId === target.id) ||
        (fr.fromUserId === target.id && fr.toUserId === meId)
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: `You are already friends with ${target.name}.` });
      }
      if (existing.status === 'pending') {
        if (existing.fromUserId === target.id) {
          existing.status = 'accepted';
          writeDB(db);
          broadcastToUsers([meId, target.id], { type: 'friend:update' });
          return res.json({ message: `Accepted incoming request from ${target.name}!`, status: 'accepted' });
        }
        return res.status(409).json({ error: `Friend request already pending with ${target.name}.` });
      }
      existing.fromUserId = meId;
      existing.toUserId = target.id;
      existing.status = 'pending';
      existing.createdAt = new Date().toISOString();
      writeDB(db);
      broadcastToUsers([meId, target.id], { type: 'friend:update' });
      return res.status(201).json({ message: `Friend request sent to ${target.tag}.` });
    }

    const newReq: FriendRequest = {
      id: `fr_${Date.now()}`,
      fromUserId: meId,
      toUserId: target.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.friendRequests.push(newReq);
    writeDB(db);

    broadcastToUsers([meId, target.id], { type: 'friend:update' });
    return res.status(201).json({ message: `Friend request sent to ${target.tag}.` });
  });

  app.post('/api/friends/respond', authMiddleware, (req: AuthRequest, res: Response) => {
    const { requestId, action } = req.body;
    const db = readDB();
    const fr = db.friendRequests.find((f) => f.id === requestId && f.toUserId === req.user!.id);
    if (!fr) return res.status(404).json({ error: 'Friend request not found.' });

    fr.status = action === 'accept' ? 'accepted' : 'declined';
    writeDB(db);
    broadcastToUsers([fr.fromUserId, fr.toUserId], { type: 'friend:update' });
    return res.json({ request: fr });
  });

  app.delete('/api/friends/:friendId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const meId = req.user!.id;
    const fid = req.params.friendId;
    db.friendRequests = db.friendRequests.filter(
      (fr) =>
        !(
          (fr.fromUserId === meId && fr.toUserId === fid) ||
          (fr.fromUserId === fid && fr.toUserId === meId)
        )
    );
    writeDB(db);
    broadcastToUsers([meId, fid], { type: 'friend:update' });
    return res.json({ success: true });
  });

  app.get('/api/dms/:friendId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const dmKey = getDmKey(req.user!.id, req.params.friendId);
    const messages = db.messages.filter((m) => m.dmKey === dmKey);
    return res.json({ messages });
  });

  app.post(
    '/api/dms/:friendId',
    authMiddleware,
    upload.single('attachment'),
    (req: AuthRequest, res: Response) => {
      const { content, replyToMessageId, forwardedFromAuthor, audioDurationSec } = req.body || {};
      const file = req.file;
      if ((!content || !String(content).trim()) && !file) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
      }
      const db = readDB();
      const author = db.users.find((u) => u.id === req.user!.id);
      if (!author) return res.status(404).json({ error: 'User not found.' });

      let attachmentType: ChatMessage['attachmentType'];
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      if (file) {
        if (file.mimetype.startsWith('audio/')) attachmentType = 'audio';
        else if (file.mimetype.startsWith('video/')) attachmentType = 'video';
        else attachmentType = 'image';
        attachmentUrl = `/uploads/${file.filename}`;
        attachmentName = file.originalname;
      }

      let replyPreview: ChatMessage['replyPreview'];
      if (replyToMessageId) {
        const refMsg = db.messages.find((m) => m.id === replyToMessageId);
        if (refMsg) {
          replyPreview = {
            id: refMsg.id,
            authorName: refMsg.authorName,
            content: refMsg.content || (refMsg.attachmentType ? `[${refMsg.attachmentType}]` : ''),
            attachmentType: refMsg.attachmentType,
          };
        }
      }

      const friendId = req.params.friendId;
      const dmKey = getDmKey(author.id, friendId);
      const message: ChatMessage = {
        id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        dmKey,
        authorId: author.id,
        authorName: author.name,
        authorTag: author.tag,
        authorAvatar: author.avatarUrl,
        content: content !== undefined ? String(content).trim() : '',
        attachmentType,
        attachmentUrl,
        attachmentName,
        audioDurationSec: audioDurationSec ? Number(audioDurationSec) : undefined,
        reactions: {},
        pinned: false,
        bookmarkedByUserIds: [],
        replyToMessageId: replyToMessageId || undefined,
        replyPreview,
        forwardedFrom: forwardedFromAuthor ? { authorName: String(forwardedFromAuthor) } : undefined,
        createdAt: new Date().toISOString(),
      };

      db.messages.push(message);
      writeDB(db);
      broadcastToUsers([author.id, friendId], { type: 'chat:message', message });
      return res.status(201).json({ message });
    }
  );

  // --- MESSAGE INTERACTIONS (EDIT, DELETE, REACT, PIN, BOOKMARK) ---

  function broadcastMessageEvent(db: PilgrimDB, msg: ChatMessage, eventType: 'chat:message_updated' | 'chat:message_deleted') {
    const payload =
      eventType === 'chat:message_updated'
        ? { type: eventType, message: msg }
        : { type: eventType, messageId: msg.id, serverId: msg.serverId, channelId: msg.channelId, dmKey: msg.dmKey };

    if (msg.serverId) {
      const srv = db.servers.find((s) => s.id === msg.serverId);
      if (srv) broadcastToUsers(srv.memberIds, payload);
    } else if (msg.dmKey) {
      broadcastToUsers(msg.dmKey.split('__'), payload);
    }
  }

  app.patch('/api/messages/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }
    const db = readDB();
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    if (msg.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }
    msg.content = content.trim();
    msg.editedAt = new Date().toISOString();
    writeDB(db);
    broadcastMessageEvent(db, msg, 'chat:message_updated');
    return res.json({ message: msg });
  });

  app.delete('/api/messages/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const idx = db.messages.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Message not found.' });
    const msg = db.messages[idx];

    let allowed = msg.authorId === req.user!.id;
    if (!allowed && msg.serverId) {
      const rawSrv = db.servers.find((s) => s.id === msg.serverId);
      if (rawSrv && hasServerPermission(ensureServerDefaults(rawSrv), req.user!.id, 'manageMessages')) {
        allowed = true;
      }
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    db.messages.splice(idx, 1);
    writeDB(db);
    broadcastMessageEvent(db, msg, 'chat:message_deleted');
    return res.json({ success: true });
  });

  app.post('/api/messages/:id/react', authMiddleware, (req: AuthRequest, res: Response) => {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
      return res.status(400).json({ error: 'Emoji is required.' });
    }
    const db = readDB();
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    if (msg.serverId) {
      const rawSrv = db.servers.find((s) => s.id === msg.serverId);
      if (rawSrv && !hasServerPermission(ensureServerDefaults(rawSrv), req.user!.id, 'addReactions')) {
        return res.status(403).json({ error: 'Your role does not allow adding reactions.' });
      }
    }

    const reactions = { ...(msg.reactions || {}) };
    const clean = emoji.trim();
    const users = [...(reactions[clean] || [])];
    const uid = req.user!.id;
    const i = users.indexOf(uid);
    if (i === -1) users.push(uid);
    else users.splice(i, 1);

    if (users.length === 0) delete reactions[clean];
    else reactions[clean] = users;
    msg.reactions = reactions;
    writeDB(db);
    broadcastMessageEvent(db, msg, 'chat:message_updated');
    return res.json({ message: msg });
  });

  app.post('/api/messages/:id/pin', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    if (msg.serverId) {
      const rawSrv = db.servers.find((s) => s.id === msg.serverId);
      const srv = rawSrv ? ensureServerDefaults(rawSrv) : null;
      const canPin =
        msg.authorId === req.user!.id ||
        (srv &&
          (hasServerPermission(srv, req.user!.id, 'pinMessages') ||
            hasServerPermission(srv, req.user!.id, 'manageMessages')));
      if (!canPin) {
        return res.status(403).json({ error: 'Your role does not allow pinning messages.' });
      }
    }

    msg.pinned = !msg.pinned;
    writeDB(db);
    broadcastMessageEvent(db, msg, 'chat:message_updated');
    return res.json({ message: msg });
  });

  app.post('/api/messages/:id/bookmark', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const msg = db.messages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    const uid = req.user!.id;
    const list = [...(msg.bookmarkedByUserIds || [])];
    const idx = list.indexOf(uid);
    let bookmarked = false;
    if (idx === -1) {
      list.push(uid);
      bookmarked = true;
    } else {
      list.splice(idx, 1);
    }
    msg.bookmarkedByUserIds = list;
    writeDB(db);
    return res.json({ bookmarked, message: msg });
  });

  // --- POSTS, VIDEOS, IMAGES & SOCIAL INTERACTIONS ---

  app.get('/api/posts', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const meId = req.user!.id;
    const me = db.users.find((u) => u.id === meId);
    const blocked = new Set(me?.blockedUserIds || []);
    const friendIds = getFriendIds(db, meId);

    const { scope = 'feed', userId, mediaType } = req.query;

    let posts = db.posts.filter((p) => {
      if (blocked.has(p.authorId)) return false;

      if (p.authorId === meId) return true;
      if (p.visibility === 'private') return false;
      if (p.visibility === 'friends' && !friendIds.has(p.authorId)) return false;
      return true;
    });

    if (scope === 'profile' && typeof userId === 'string') {
      posts = posts.filter((p) => p.authorId === userId);
    }

    if (mediaType && mediaType !== 'all') {
      posts = posts.filter((p) => p.mediaType === mediaType);
    }

    const cleaned = posts
      .map((p) => ({
        ...p,
        comments: p.comments.filter((c) => !blocked.has(c.authorId)),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ posts: cleaned });
  });

  app.post('/api/posts', authMiddleware, upload.single('media'), (req: AuthRequest, res: Response) => {
    try {
      const { title, content, visibility = 'public' } = req.body;
      const file = req.file;

      if ((!content || !content.trim()) && !file) {
        return res.status(400).json({ error: 'Please write a thought or attach an image or video.' });
      }

      const db = readDB();
      const author = db.users.find((u) => u.id === req.user!.id);
      if (!author) return res.status(404).json({ error: 'Account not found.' });

      let mediaType: 'none' | 'image' | 'video' = 'none';
      let mediaUrl: string | undefined;

      if (file) {
        mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
        mediaUrl = `/uploads/${file.filename}`;
      }

      const validVisibility: Visibility =
        visibility === 'private' || visibility === 'friends' ? visibility : 'public';

      const newPost: Post = {
        id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        authorId: author.id,
        authorName: author.name,
        authorTag: author.tag,
        authorAvatar: author.avatarUrl,
        title: title?.trim() || undefined,
        content: content?.trim() || '',
        mediaType,
        mediaUrl,
        visibility: validVisibility,
        likes: [],
        sharesCount: 0,
        comments: [],
        createdAt: new Date().toISOString(),
      };

      db.posts.unshift(newPost);
      writeDB(db);

      return res.status(201).json({ post: newPost });
    } catch (err) {
      console.error('Create post error:', err);
      return res.status(500).json({ error: 'Failed to publish post.' });
    }
  });

  app.patch('/api/posts/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (post.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the author can edit this post.' });
    }

    const { visibility, content, title } = req.body;
    if (visibility === 'public' || visibility === 'friends' || visibility === 'private') {
      post.visibility = visibility;
    }
    if (content !== undefined) post.content = content.trim();
    if (title !== undefined) post.title = title.trim() || undefined;

    writeDB(db);
    return res.json({ post });
  });

  app.delete('/api/posts/:id', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const idx = db.posts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Post not found.' });
    if (db.posts[idx].authorId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }

    db.posts.splice(idx, 1);
    writeDB(db);
    return res.json({ success: true });
  });

  app.post('/api/posts/:id/like', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const uid = req.user!.id;
    const idx = post.likes.indexOf(uid);
    if (idx === -1) {
      post.likes.push(uid);
    } else {
      post.likes.splice(idx, 1);
    }

    writeDB(db);
    return res.json({ likes: post.likes });
  });

  app.post('/api/posts/:id/share', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    post.sharesCount = (post.sharesCount || 0) + 1;
    writeDB(db);
    return res.json({ sharesCount: post.sharesCount });
  });

  app.post('/api/posts/:id/comments', authMiddleware, (req: AuthRequest, res: Response) => {
    const { content, parentCommentId } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty.' });
    }

    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const author = db.users.find((u) => u.id === req.user!.id);
    if (!author) return res.status(404).json({ error: 'Account not found.' });

    let validParentId: string | undefined;
    if (parentCommentId && typeof parentCommentId === 'string') {
      const parentExists = post.comments.some((c) => c.id === parentCommentId);
      if (parentExists) {
        validParentId = parentCommentId;
      }
    }

    const comment: PostComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      postId: post.id,
      parentCommentId: validParentId,
      authorId: author.id,
      authorName: author.name,
      authorTag: author.tag,
      authorAvatar: author.avatarUrl,
      content: content.trim(),
      reactions: {},
      hiddenByUserIds: [],
      createdAt: new Date().toISOString(),
    };

    post.comments.push(comment);
    writeDB(db);
    const blocked = new Set(author.blockedUserIds || []);
    return res.status(201).json({
      comment,
      comments: post.comments.filter((c) => !blocked.has(c.authorId)),
    });
  });

  app.patch('/api/posts/:id/comments/:commentId', authMiddleware, (req: AuthRequest, res: Response) => {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty.' });
    }

    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.find((c) => c.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    if (comment.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only edit your own comments.' });
    }

    comment.content = content.trim();
    comment.editedAt = new Date().toISOString();
    writeDB(db);

    const me = db.users.find((u) => u.id === req.user!.id);
    const blocked = new Set(me?.blockedUserIds || []);
    return res.json({
      comment,
      comments: post.comments.filter((c) => !blocked.has(c.authorId)),
    });
  });

  app.post('/api/posts/:id/comments/:commentId/react', authMiddleware, (req: AuthRequest, res: Response) => {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
      return res.status(400).json({ error: 'Emoji reaction is required.' });
    }

    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.find((c) => c.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const reactions = { ...(comment.reactions || {}) };
    const cleanEmoji = emoji.trim();
    const list = [...(reactions[cleanEmoji] || [])];
    const uid = req.user!.id;
    const idx = list.indexOf(uid);
    if (idx === -1) {
      list.push(uid);
    } else {
      list.splice(idx, 1);
    }

    if (list.length === 0) {
      delete reactions[cleanEmoji];
    } else {
      reactions[cleanEmoji] = list;
    }

    comment.reactions = reactions;
    writeDB(db);

    const me = db.users.find((u) => u.id === uid);
    const blocked = new Set(me?.blockedUserIds || []);
    return res.json({
      comments: post.comments.filter((c) => !blocked.has(c.authorId)),
    });
  });

  app.post('/api/posts/:id/comments/:commentId/hide', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.find((c) => c.id === req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const hiddenBy = [...(comment.hiddenByUserIds || [])];
    const uid = req.user!.id;
    const idx = hiddenBy.indexOf(uid);
    let hidden = false;
    if (idx === -1) {
      hiddenBy.push(uid);
      hidden = true;
    } else {
      hiddenBy.splice(idx, 1);
    }

    comment.hiddenByUserIds = hiddenBy;
    writeDB(db);

    const me = db.users.find((u) => u.id === uid);
    const blocked = new Set(me?.blockedUserIds || []);
    return res.json({
      hidden,
      comments: post.comments.filter((c) => !blocked.has(c.authorId)),
    });
  });

  app.delete('/api/posts/:id/comments/:commentId', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const post = db.posts.find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const target = post.comments.find((c) => c.id === req.params.commentId);
    if (!target) return res.status(404).json({ error: 'Comment not found.' });
    if (target.authorId !== req.user!.id && post.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    // Remove the comment and any nested replies beneath it
    const toDelete = new Set<string>([target.id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of post.comments) {
        if (c.parentCommentId && toDelete.has(c.parentCommentId) && !toDelete.has(c.id)) {
          toDelete.add(c.id);
          added = true;
        }
      }
    }

    post.comments = post.comments.filter((c) => !toDelete.has(c.id));
    writeDB(db);

    const me = db.users.find((u) => u.id === req.user!.id);
    const blocked = new Set(me?.blockedUserIds || []);
    return res.json({ comments: post.comments.filter((c) => !blocked.has(c.authorId)) });
  });

  // --- SAFETY & BAD ACTOR REPORTS ---

  app.post('/api/reports', authMiddleware, (req: AuthRequest, res: Response) => {
    const { targetType, targetId, targetUserId, targetUserName, reason, details, alsoBlock } = req.body;
    if (!reason || !targetUserId) {
      return res.status(400).json({ error: 'Please choose a reason for your report.' });
    }

    const db = readDB();
    const report: ReportRecord = {
      id: `rpt_${Date.now()}`,
      reporterId: req.user!.id,
      targetType: targetType || 'user',
      targetId: targetId || targetUserId,
      targetUserId,
      targetUserName: targetUserName || 'Unknown User',
      reason,
      details: details?.trim() || '',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };

    db.reports.unshift(report);

    if (alsoBlock && targetUserId !== req.user!.id) {
      const me = db.users.find((u) => u.id === req.user!.id);
      if (me && !me.blockedUserIds.includes(targetUserId)) {
        me.blockedUserIds.push(targetUserId);
      }
    }

    writeDB(db);
    return res.status(201).json({ report, message: 'Report submitted to Pilgrim Safety Team.' });
  });

  app.get('/api/reports/mine', authMiddleware, (req: AuthRequest, res: Response) => {
    const db = readDB();
    const reports = db.reports.filter((r) => r.reporterId === req.user!.id);
    return res.json({ reports });
  });

  // Ensure unknown /api/* routes and upload/server errors always return JSON (never HTML)
  app.use('/api', (_req: Request, res: Response) => {
    return res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const message = err instanceof Error ? err.message : 'Internal server error.';
      return res.status(500).json({ error: message });
    }
    return next(err);
  });

  // Vite middleware integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Pilgrim server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
