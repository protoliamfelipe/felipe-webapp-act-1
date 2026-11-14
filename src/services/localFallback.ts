import {
  User,
  UserStatus,
  Server,
  ServerRole,
  RolePermissions,
  ChannelCategory,
  Channel,
  CustomEmoji,
  ServerInvite,
  ChatMessage,
  VoiceParticipant,
  Post,
  PostComment,
  FriendsOverview,
  ReportRecord,
  Visibility,
} from '../types';
import { makeInitialsAvatar } from '../utils/avatars';
import {
  createDefaultRolesForServer,
  DEFAULT_ROLE_PERMISSIONS,
  hasServerPermission,
} from '../utils/permissions';

const LOCAL_DB_KEY = 'pilgrim_local_db_v4';
const LOCAL_VOICE_KEY = 'pilgrim_local_voice_v1';

function readLocalVoice(): VoiceParticipant[] {
  try {
    const raw = localStorage.getItem(LOCAL_VOICE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalVoice(list: VoiceParticipant[]) {
  try {
    localStorage.setItem(LOCAL_VOICE_KEY, JSON.stringify(list));
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('pilgrim_realtime_sync');
      ch.postMessage({ type: 'voice:sync', participants: list });
      ch.close();
    }
  } catch {
    // ignore storage quota
  }
}

const localEmailChallenges = new Map<
  string,
  { code: string; magicToken: string; userId: string; expiresAt: number }
>();

interface LocalUser extends User {
  password: string;
}

interface LocalFriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

interface LocalDB {
  users: LocalUser[];
  servers: Server[];
  messages: ChatMessage[];
  posts: Post[];
  friendRequests: LocalFriendRequest[];
  reports: ReportRecord[];
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function sanitize(u: LocalUser): User {
  const { password: _pw, ...safe } = u;
  return safe;
}

function ensureLocalServerDefaults(srv: Server): Server {
  const roles = srv.roles && srv.roles.length > 0 ? srv.roles : createDefaultRolesForServer(srv.id);
  const memberRoles: Record<string, string[]> = { ...(srv.memberRoles || {}) };
  if (!memberRoles[srv.ownerId] && roles[0]) {
    memberRoles[srv.ownerId] = [roles[0].id];
  }
  const channels = (srv.channels || []).map((ch) => ({
    ...ch,
    type: ch.type === 'voice' ? ('voice' as const) : ('text' as const),
  }));
  return {
    ...srv,
    roles,
    memberRoles,
    channels,
    categories: srv.categories || [],
    customEmojis: srv.customEmojis || [],
    invites: srv.invites || [],
    bannedUserIds: srv.bannedUserIds || [],
    timedOutUntil: srv.timedOutUntil || {},
  };
}

function createInitialLocalDB(): LocalDB {
  const now = Date.now();
  const frostByte: LocalUser = {
    id: 'usr_frostbyte',
    email: 'frostbyte@pilgrim.app',
    password: 'password123',
    name: 'FrostByte',
    tag: 'FrostByte#0001',
    bio: 'Co-op gamer, clip editor, and UI tinkerer. Sharing match highlights, capture setups, and hosting weekend rooms.',
    avatarUrl: makeInitialsAvatar('FrostByte'),
    birthDate: '2001-05-14',
    status: 'online',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
  };

  const kitsuneDrift: LocalUser = {
    id: 'usr_kitsune',
    email: 'kitsune@pilgrim.app',
    password: 'password123',
    name: 'KitsuneDrift',
    tag: 'KitsuneDrift#0419',
    bio: 'Indie dev and multiplayer strategist. Always down for evening ranked queues, playtests, and chill voice rooms.',
    avatarUrl: makeInitialsAvatar('KitsuneDrift'),
    birthDate: '2000-09-02',
    status: 'online',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 25).toISOString(),
  };

  const pixelVanguard: LocalUser = {
    id: 'usr_pixel',
    email: 'pixel@pilgrim.app',
    password: 'password123',
    name: 'PixelVanguard',
    tag: 'PixelVanguard#0777',
    bio: 'Motion designer and tournament host. Archiving tutorials, clip reels, and weekend bracket recaps.',
    avatarUrl: makeInitialsAvatar('PixelVanguard'),
    birthDate: '1999-11-21',
    status: 'idle',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
  };

  const nightfallGG: LocalUser = {
    id: 'usr_nightfall',
    email: 'nightfall@pilgrim.app',
    password: 'password123',
    name: 'NightfallGG',
    tag: 'NightfallGG#2026',
    bio: 'Audio producer and tactical RPG player. Connecting creators and teams across communities.',
    avatarUrl: makeInitialsAvatar('NightfallGG'),
    birthDate: '1998-03-11',
    status: 'dnd',
    blockedUserIds: [],
    createdAt: new Date(now - 1000 * 60 * 60 * 24 * 15).toISOString(),
  };

  const loungeRoles = createDefaultRolesForServer('srv_lounge');
  const gamingRoles = createDefaultRolesForServer('srv_gaming');
  const creatorRoles = createDefaultRolesForServer('srv_creators');

  const servers: Server[] = [
    {
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
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
    {
      id: 'srv_gaming',
      name: 'Co-Op & Gaming Hub',
      description: 'Matchmaking, LFG party finder, strategy discussions, and highlight clips.',
      category: 'Gaming & Co-Op',
      iconStyle: 'crosshair',
      ownerId: kitsuneDrift.id,
      memberIds: [frostByte.id, kitsuneDrift.id, pixelVanguard.id, nightfallGG.id],
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
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
    },
    {
      id: 'srv_creators',
      name: 'Creator Studio',
      description: 'Discoverable server for video editors, designers, and streamers exchanging feedback.',
      category: 'Creators & Video',
      iconStyle: 'compass',
      ownerId: pixelVanguard.id,
      memberIds: [pixelVanguard.id, frostByte.id],
      channels: [
        { id: 'ch_creators_feedback', name: 'feedback', type: 'text', topic: 'Post work-in-progress clips and thumbnails for critique' },
        { id: 'ch_creators_voice', name: 'Review Stage', type: 'voice', topic: 'Live review & audio feedback room' },
      ],
      roles: creatorRoles,
      memberRoles: {
        [pixelVanguard.id]: [creatorRoles[0].id],
      },
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ];

  const messages: ChatMessage[] = [
    {
      id: 'msg_seed_1',
      serverId: 'srv_lounge',
      channelId: 'ch_lounge_welcome',
      authorId: frostByte.id,
      authorName: frostByte.name,
      authorTag: frostByte.tag,
      authorAvatar: frostByte.avatarUrl,
      content: 'Welcome to Pilgrim Lounge! Drop an intro here or share your latest video post in #media-showcase.',
      reactions: { '👋': [kitsuneDrift.id] },
      pinned: true,
      bookmarkedByUserIds: [],
      createdAt: new Date(now - 1000 * 60 * 55).toISOString(),
    },
    {
      id: 'msg_seed_2',
      serverId: 'srv_lounge',
      channelId: 'ch_lounge_welcome',
      authorId: kitsuneDrift.id,
      authorName: kitsuneDrift.name,
      authorTag: kitsuneDrift.tag,
      authorAvatar: kitsuneDrift.avatarUrl,
      content: 'Glad to be here! I am running co-op lobbies tonight if anyone wants to join in #lfg-party.',
      reactions: {},
      pinned: false,
      bookmarkedByUserIds: [],
      createdAt: new Date(now - 1000 * 60 * 42).toISOString(),
    },
  ];

  const posts: Post[] = [
    {
      id: 'post_1',
      authorId: frostByte.id,
      authorName: frostByte.name,
      authorTag: frostByte.tag,
      authorAvatar: frostByte.avatarUrl,
      title: '60fps Capture Settings & Color Grading Notes for Gameplay Clips',
      content:
        'Switched to 1440p60 CBR at 18 Mbps and clean lossless audio tracks before exporting highlights. Keeps fast camera pans crisp without bloating upload sizes.',
      mediaType: 'none',
      visibility: 'public',
      likes: [kitsuneDrift.id, pixelVanguard.id, nightfallGG.id],
      sharesCount: 4,
      comments: [
        {
          id: 'cmt_seed_1',
          postId: 'post_1',
          authorId: kitsuneDrift.id,
          authorName: kitsuneDrift.name,
          authorTag: kitsuneDrift.tag,
          authorAvatar: kitsuneDrift.avatarUrl,
          content: 'Tried 18 Mbps last week and the motion clarity is night and day.',
          reactions: { '🔥': [frostByte.id, pixelVanguard.id], '👍': [nightfallGG.id] },
          hiddenByUserIds: [],
          createdAt: new Date(now - 1000 * 60 * 110).toISOString(),
        },
        {
          id: 'cmt_seed_1_reply',
          postId: 'post_1',
          parentCommentId: 'cmt_seed_1',
          authorId: frostByte.id,
          authorName: frostByte.name,
          authorTag: frostByte.tag,
          authorAvatar: frostByte.avatarUrl,
          content: 'Right? Pair it with P6 preset and zero dropped frames.',
          reactions: { '👍': [kitsuneDrift.id] },
          hiddenByUserIds: [],
          createdAt: new Date(now - 1000 * 60 * 80).toISOString(),
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
        'Hosting open co-op lobbies Friday and Saturday evenings. Beginners welcome — drop your tag in Friends & DMs if you want an invite.',
      mediaType: 'none',
      visibility: 'public',
      likes: [frostByte.id],
      sharesCount: 2,
      comments: [],
      createdAt: new Date(now - 1000 * 60 * 300).toISOString(),
    },
  ];

  const friendRequests: LocalFriendRequest[] = [
    {
      id: 'fr_seed_1',
      fromUserId: frostByte.id,
      toUserId: kitsuneDrift.id,
      status: 'accepted',
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
    },
    {
      id: 'fr_seed_2',
      fromUserId: frostByte.id,
      toUserId: pixelVanguard.id,
      status: 'accepted',
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 9).toISOString(),
    },
    {
      id: 'fr_seed_3',
      fromUserId: nightfallGG.id,
      toUserId: frostByte.id,
      status: 'pending',
      createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(),
    },
  ];

  return { users: [frostByte, kitsuneDrift, pixelVanguard, nightfallGG], servers, messages, posts, friendRequests, reports: [] };
}

function readLocalDB(): LocalDB {
  try {
    localStorage.removeItem('pilgrim_local_db_v1');
    localStorage.removeItem('pilgrim_local_db_v2');
    localStorage.removeItem('pilgrim_local_db_v3');
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDB;
      if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Corrupted local DB -> reset cleanly
  }
  const initial = createInitialLocalDB();
  writeLocalDB(initial);
  return initial;
}

function writeLocalDB(db: LocalDB): void {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

function makeLocalToken(userId: string): string {
  return `local_token:${userId}`;
}

function getCurrentLocalUser(db: LocalDB, token: string | null): LocalUser | null {
  if (!token) return null;
  if (token.startsWith('local_token:')) {
    const uid = token.slice('local_token:'.length);
    return db.users.find((u) => u.id === uid) || null;
  }
  try {
    const storedRaw = localStorage.getItem('pilgrim_auth_user');
    if (storedRaw) {
      const stored = JSON.parse(storedRaw) as User;
      return db.users.find((u) => u.id === stored.id || u.email === stored.email) || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function requireLocalUser(db: LocalDB, token: string | null): LocalUser {
  const user = getCurrentLocalUser(db, token);
  if (!user) throw new Error('Please sign in to continue.');
  return user;
}

function getFriendIds(db: LocalDB, userId: string): Set<string> {
  const set = new Set<string>();
  for (const fr of db.friendRequests) {
    if (fr.status === 'accepted') {
      if (fr.fromUserId === userId) set.add(fr.toUserId);
      if (fr.toUserId === userId) set.add(fr.fromUserId);
    }
  }
  return set;
}

export const localFallback = {
  async register(data: {
    email: string;
    password: string;
    name: string;
    bio?: string;
    birthDate: string;
    squadTitle?: string;
    avatarFile?: File | null;
    presetAvatarUrl?: string;
  }) {
    if (!data.email || !data.password || !data.name || !data.birthDate) {
      throw new Error('Please provide your name, email, password, and date of birth.');
    }
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    const age = calculateAge(data.birthDate);
    if (age === null || age < 0 || age > 120) {
      throw new Error('Please enter a valid date of birth.');
    }
    if (age <= 12) {
      throw new Error(
        'Access Denied: Pilgrim requires users to be at least 13 years old. Accounts for ages 12 and below cannot be created until you reach age 13.'
      );
    }

    const db = readLocalDB();
    const normalizedEmail = data.email.toLowerCase().trim();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const cleanBase = data.name.trim().replace(/[^a-zA-Z0-9]/g, '') || 'Pilgrim';
    const discrim = Math.floor(1000 + Math.random() * 9000);

    let avatarUrl = makeInitialsAvatar(data.name.trim());
    if (data.avatarFile) {
      avatarUrl = await fileToDataUrl(data.avatarFile);
    } else if (data.presetAvatarUrl) {
      avatarUrl = data.presetAvatarUrl;
    }

    const newUser: LocalUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: normalizedEmail,
      password: data.password,
      name: data.name.trim(),
      tag: `${cleanBase}#${discrim}`,
      bio: data.bio?.trim() || 'New to Pilgrim. Exploring communities and sharing posts.',
      avatarUrl,
      birthDate: data.birthDate,
      squadTitle: data.squadTitle?.trim() || undefined,
      status: 'online',
      blockedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    // New accounts start with 0 servers joined
    writeLocalDB(db);

    return {
      token: makeLocalToken(newUser.id),
      user: sanitize(newUser),
      isNewSignup: true,
    };
  },

  async login(data: { email: string; password: string }) {
    if (!data.email || !data.password) {
      throw new Error('Please enter both email and password.');
    }
    const db = readLocalDB();
    const ident = data.email.toLowerCase().trim();
    const found = db.users.find(
      (u) => u.email.toLowerCase() === ident || u.tag.toLowerCase() === ident
    );
    if (!found || found.password !== data.password) {
      throw new Error('Invalid email or password.');
    }
    return {
      token: makeLocalToken(found.id),
      user: sanitize(found),
    };
  },

  async requestEmailLoginCode(_email: string): Promise<{ sent: boolean; deliveryMode: 'email'; expiresInSeconds: number }> {
    throw new Error(
      'Cannot send email verification code because the live backend email service is unavailable in this preview or has no email provider configured. Please sign in with your password.'
    );
  },

  async verifyEmailLoginCode(data: { email?: string; code?: string; magicToken?: string }) {
    const db = readLocalDB();
    let matchedKey: string | null = null;
    let challenge: { code: string; magicToken: string; userId: string; expiresAt: number } | null = null;

    if (data.magicToken) {
      for (const [k, v] of localEmailChallenges.entries()) {
        if (v.magicToken === data.magicToken) {
          matchedKey = k;
          challenge = v;
          break;
        }
      }
    } else if (data.email && data.code) {
      matchedKey = data.email.toLowerCase().trim();
      challenge = localEmailChallenges.get(matchedKey) || null;
    }

    if (!challenge || !matchedKey) {
      throw new Error('Verification code is invalid or expired. Request a new code.');
    }
    if (Date.now() > challenge.expiresAt) {
      localEmailChallenges.delete(matchedKey);
      throw new Error('Verification code has expired. Please request a new one.');
    }
    if (!data.magicToken && String(data.code || '').trim() !== challenge.code) {
      throw new Error('Incorrect verification code. Please try again.');
    }
    localEmailChallenges.delete(matchedKey);

    const found = db.users.find((u) => u.id === challenge!.userId);
    if (!found) {
      throw new Error('Account not found.');
    }
    return {
      token: makeLocalToken(found.id),
      user: sanitize(found),
    };
  },

  async getMe(token: string | null) {
    const db = readLocalDB();
    const user = requireLocalUser(db, token);
    return { user: sanitize(user) };
  },

  async updateStatus(token: string | null, status: UserStatus) {
    const db = readLocalDB();
    const user = requireLocalUser(db, token);
    user.status = status;
    writeLocalDB(db);
    return { user: sanitize(user) };
  },

  async updateStreamStatus(token: string | null, isStreaming: boolean, streamTitle?: string) {
    const db = readLocalDB();
    const user = requireLocalUser(db, token);
    user.isStreaming = Boolean(isStreaming);
    user.streamTitle =
      user.isStreaming && streamTitle?.trim() ? streamTitle.trim().slice(0, 120) : undefined;
    writeLocalDB(db);
    const list = readLocalVoice().map((p) =>
      p.userId === user.id
        ? { ...p, isStreaming: user.isStreaming, streamTitle: user.streamTitle }
        : p
    );
    writeLocalVoice(list);
    return { user: sanitize(user) };
  },

  async updateProfile(
    token: string | null,
    data: {
      name?: string;
      bio?: string;
      squadTitle?: string;
      avatarFile?: File | null;
      bannerFile?: File | null;
      presetAvatarUrl?: string;
      removeAvatar?: boolean;
      removeBanner?: boolean;
    }
  ) {
    const db = readLocalDB();
    const user = requireLocalUser(db, token);
    if (data.name?.trim()) user.name = data.name.trim();
    if (data.bio !== undefined) user.bio = data.bio.trim();
    if (data.squadTitle !== undefined) user.squadTitle = data.squadTitle.trim();
    if (data.avatarFile) {
      user.avatarUrl = await fileToDataUrl(data.avatarFile);
    } else if (data.removeAvatar) {
      user.avatarUrl = makeInitialsAvatar(user.name);
    } else if (data.presetAvatarUrl) {
      user.avatarUrl = data.presetAvatarUrl;
    }

    if (data.bannerFile) {
      user.bannerUrl = await fileToDataUrl(data.bannerFile);
    } else if (data.removeBanner) {
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
    writeLocalDB(db);
    return { user: sanitize(user) };
  },

  async getUserProfile(token: string | null, userId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const target = db.users.find((u) => u.id === userId);
    if (!target) throw new Error('User not found.');
    const myFriends = getFriendIds(db, me.id);
    const pendingReq = db.friendRequests.find(
      (fr) =>
        fr.status === 'pending' &&
        ((fr.fromUserId === me.id && fr.toUserId === target.id) ||
          (fr.fromUserId === target.id && fr.toUserId === me.id))
    );
    return {
      user: sanitize(target),
      isFriend: myFriends.has(target.id),
      friendCount: getFriendIds(db, target.id).size,
      pendingDirection: pendingReq
        ? pendingReq.fromUserId === me.id
          ? ('outgoing' as const)
          : ('incoming' as const)
        : null,
    };
  },

  async toggleBlockUser(token: string | null, targetUserId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = me.blockedUserIds.indexOf(targetUserId);
    let blocked = false;
    if (idx === -1) {
      me.blockedUserIds.push(targetUserId);
      blocked = true;
    } else {
      me.blockedUserIds.splice(idx, 1);
    }
    writeLocalDB(db);
    return { blocked, blockedUserIds: me.blockedUserIds };
  },

  async getServers(token: string | null, q = '') {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const query = q.trim().toLowerCase();
    const servers = db.servers
      .map(ensureLocalServerDefaults)
      .filter(
        (s) =>
          !query ||
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.category.toLowerCase().includes(query)
      )
      .map((s) => ({
        ...s,
        isMember: s.memberIds.includes(me.id),
        memberCount: s.memberIds.length,
      }));
    return { servers };
  },

  async createServer(
    token: string | null,
    data: { name: string; description: string; category?: string; iconStyle?: string; iconFile?: File | null }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    if (!data.name.trim()) throw new Error('Server name is required.');
    const iconUrl = data.iconFile ? await fileToDataUrl(data.iconFile) : undefined;
    const serverId = `srv_${Date.now()}`;
    const roles = createDefaultRolesForServer(serverId);
    const srv: Server = {
      id: serverId,
      name: data.name.trim(),
      description: data.description.trim() || 'A Pilgrim gaming community server.',
      category: data.category?.trim() || 'Community',
      iconUrl,
      iconStyle: data.iconStyle || 'monogram',
      ownerId: me.id,
      memberIds: [me.id],
      categories: [],
      channels: [
        { id: `ch_${Date.now()}_1`, name: 'general', type: 'text', topic: 'Main server chat' },
        { id: `ch_${Date.now()}_2`, name: 'clips-and-guides', type: 'text', topic: 'Share highlights & strategies' },
        { id: `ch_${Date.now()}_3`, name: 'Lounge Voice', type: 'voice', topic: 'Live voice room' },
      ],
      roles,
      memberRoles: { [me.id]: [roles[0].id] },
      customEmojis: [],
      invites: [],
      bannedUserIds: [],
      timedOutUntil: {},
      createdAt: new Date().toISOString(),
    };
    db.servers.unshift(srv);
    writeLocalDB(db);
    return { server: { ...srv, isMember: true, memberCount: 1 } };
  },

  async updateServer(
    token: string | null,
    serverId: string,
    data: {
      name?: string;
      description?: string;
      iconStyle?: string;
      iconFile?: File | null;
      bannerFile?: File | null;
      removeIcon?: boolean;
      removeBanner?: boolean;
    }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageServer')) {
      throw new Error('Only server managers or owners can update server settings.');
    }
    if (data.name?.trim()) srv.name = data.name.trim();
    if (data.description !== undefined) srv.description = data.description.trim();
    if (data.iconStyle) srv.iconStyle = data.iconStyle;
    if (data.iconFile) srv.iconUrl = await fileToDataUrl(data.iconFile);
    else if (data.removeIcon) srv.iconUrl = undefined;
    if (data.bannerFile) srv.bannerUrl = await fileToDataUrl(data.bannerFile);
    else if (data.removeBanner) srv.bannerUrl = undefined;
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: { ...srv, isMember: srv.memberIds.includes(me.id), memberCount: srv.memberIds.length } };
  },

  async joinServer(token: string | null, serverId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (srv.bannedUserIds?.includes(me.id)) {
      throw new Error('You are banned from joining this server.');
    }
    if (!srv.memberIds.includes(me.id)) {
      srv.memberIds.push(me.id);
    }
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: { ...srv, isMember: true, memberCount: srv.memberIds.length } };
  },

  async createCategory(token: string | null, serverId: string, name: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) throw new Error('Permission denied.');
    const category: ChannelCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: name.trim(),
      collapsed: false,
    };
    srv.categories = [...(srv.categories || []), category];
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { category, server: srv };
  },

  async updateCategory(
    token: string | null,
    serverId: string,
    catId: string,
    data: { name?: string; collapsed?: boolean }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) throw new Error('Permission denied.');
    const cat = (srv.categories || []).find((c) => c.id === catId);
    if (!cat) throw new Error('Category not found.');
    if (data.name?.trim()) cat.name = data.name.trim();
    if (typeof data.collapsed === 'boolean') cat.collapsed = data.collapsed;
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { category: cat, server: srv };
  },

  async deleteCategory(token: string | null, serverId: string, catId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) throw new Error('Permission denied.');
    srv.categories = (srv.categories || []).filter((c) => c.id !== catId);
    srv.channels = srv.channels.map((ch) => (ch.categoryId === catId ? { ...ch, categoryId: undefined } : ch));
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async createChannel(
    token: string | null,
    serverId: string,
    data: { name: string; topic?: string; type?: 'text' | 'voice'; categoryId?: string }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) {
      throw new Error('Only the server owner or members with Manage Channels permission can create channels.');
    }
    const channelType: 'text' | 'voice' = data.type === 'voice' ? 'voice' : 'text';
    const clean =
      channelType === 'voice'
        ? data.name.trim()
        : data.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const channel: Channel = {
      id: `ch_${Date.now()}`,
      name: clean || (channelType === 'voice' ? 'Voice Room' : 'channel'),
      type: channelType,
      topic: data.topic?.trim() || '',
      categoryId: data.categoryId || undefined,
    };
    srv.channels.push(channel);
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { channel, server: srv };
  },

  async updateChannel(
    token: string | null,
    serverId: string,
    channelId: string,
    data: { name?: string; topic?: string; categoryId?: string | null }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) throw new Error('Permission denied.');
    const ch = srv.channels.find((c) => c.id === channelId);
    if (!ch) throw new Error('Channel not found.');
    if (data.name?.trim()) {
      ch.name =
        ch.type === 'voice'
          ? data.name.trim()
          : data.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || ch.name;
    }
    if (data.topic !== undefined) ch.topic = data.topic.trim();
    if (data.categoryId !== undefined) ch.categoryId = data.categoryId || undefined;
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { channel: ch, server: srv };
  },

  async deleteChannel(token: string | null, serverId: string, channelId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageChannels')) throw new Error('Permission denied.');
    srv.channels = srv.channels.filter((c) => c.id !== channelId);
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async uploadServerEmoji(
    token: string | null,
    serverId: string,
    data: { name: string; file: File; animated: boolean }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageServer') && !hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    const url = await fileToDataUrl(data.file);
    const cleanName =
      data.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') ||
      `emoji_${Date.now().toString().slice(-4)}`;
    const emoji: CustomEmoji = {
      id: `ce_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: cleanName,
      url,
      animated: data.animated,
      uploadedBy: me.id,
      createdAt: new Date().toISOString(),
    };
    srv.customEmojis = [...(srv.customEmojis || []), emoji];
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { emoji, server: srv };
  },

  async deleteServerEmoji(token: string | null, serverId: string, emojiId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageServer') && !hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    srv.customEmojis = (srv.customEmojis || []).filter((e) => e.id !== emojiId);
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async createInvite(
    token: string | null,
    serverId: string,
    options?: { maxUses?: number; maxAgeHours?: number }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const invite: ServerInvite = {
      code,
      createdBy: me.id,
      createdByName: me.name,
      uses: 0,
      maxUses: options?.maxUses && options.maxUses > 0 ? options.maxUses : undefined,
      expiresAt:
        options?.maxAgeHours && options.maxAgeHours > 0
          ? new Date(Date.now() + options.maxAgeHours * 3600 * 1000).toISOString()
          : undefined,
      createdAt: new Date().toISOString(),
    };
    srv.invites = [invite, ...(srv.invites || [])];
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { invite, server: srv };
  },

  async deleteInvite(token: string | null, serverId: string, code: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    const inv = (srv.invites || []).find((i) => i.code === code);
    if (!inv) throw new Error('Invite not found.');
    if (inv.createdBy !== me.id && !hasServerPermission(srv, me.id, 'manageServer')) {
      throw new Error('Permission denied.');
    }
    srv.invites = (srv.invites || []).filter((i) => i.code !== code);
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async getInvitePreview(code: string) {
    const db = readLocalDB();
    const clean = code.trim().toUpperCase();
    for (const raw of db.servers) {
      const srv = ensureLocalServerDefaults(raw);
      const inv = (srv.invites || []).find((i) => i.code.toUpperCase() === clean);
      if (inv) {
        if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
          throw new Error('This invite link has expired.');
        }
        if (inv.maxUses && inv.uses >= inv.maxUses) {
          throw new Error('This invite link has reached its maximum uses.');
        }
        return {
          invite: inv,
          server: {
            id: srv.id,
            name: srv.name,
            description: srv.description,
            iconUrl: srv.iconUrl,
            bannerUrl: srv.bannerUrl,
            iconStyle: srv.iconStyle,
            memberCount: srv.memberIds.length,
          },
        };
      }
    }
    throw new Error('Invalid or expired invite code.');
  },

  async joinByInvite(token: string | null, code: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const clean = code.trim().toUpperCase();
    for (let i = 0; i < db.servers.length; i++) {
      const srv = ensureLocalServerDefaults(db.servers[i]);
      const inv = (srv.invites || []).find((item) => item.code.toUpperCase() === clean);
      if (inv) {
        if (srv.bannedUserIds?.includes(me.id)) {
          throw new Error('You are banned from this server.');
        }
        if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
          throw new Error('This invite link has expired.');
        }
        if (inv.maxUses && inv.uses >= inv.maxUses) {
          throw new Error('This invite link has reached its maximum uses.');
        }
        inv.uses += 1;
        if (!srv.memberIds.includes(me.id)) srv.memberIds.push(me.id);
        db.servers[i] = srv;
        writeLocalDB(db);
        return { server: { ...srv, isMember: true, memberCount: srv.memberIds.length } };
      }
    }
    throw new Error('Invalid or expired invite code.');
  },

  async createRole(
    token: string | null,
    serverId: string,
    data: { name: string; color?: string; permissions?: Partial<RolePermissions> }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    const role: ServerRole = {
      id: `role_${Date.now()}`,
      name: data.name.trim(),
      color: data.color || '#e4e4e7',
      permissions: { ...DEFAULT_ROLE_PERMISSIONS, ...(data.permissions || {}) },
    };
    srv.roles = [...(srv.roles || []), role];
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { role, server: srv };
  },

  async updateRole(
    token: string | null,
    serverId: string,
    roleId: string,
    data: { name?: string; color?: string; permissions?: Partial<RolePermissions> }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    const role = srv.roles.find((r) => r.id === roleId);
    if (!role) throw new Error('Role not found.');
    if (data.name?.trim()) role.name = data.name.trim();
    if (data.color) role.color = data.color;
    if (data.permissions) role.permissions = { ...role.permissions, ...data.permissions };
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { role, server: srv };
  },

  async deleteRole(token: string | null, serverId: string, roleId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    srv.roles = srv.roles.filter((r) => r.id !== roleId);
    for (const uid of Object.keys(srv.memberRoles || {})) {
      srv.memberRoles[uid] = srv.memberRoles[uid].filter((id) => id !== roleId);
    }
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async assignMemberRoles(token: string | null, serverId: string, userId: string, roleIds: string[]) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'manageRoles')) {
      throw new Error('Permission denied.');
    }
    srv.memberRoles = { ...(srv.memberRoles || {}), [userId]: roleIds };
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async timeoutMember(token: string | null, serverId: string, userId: string, minutes: number) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'kickMembers') && !hasServerPermission(srv, me.id, 'manageServer')) {
      throw new Error('Permission denied.');
    }
    const timedOutUntil = { ...(srv.timedOutUntil || {}) };
    if (minutes <= 0) delete timedOutUntil[userId];
    else timedOutUntil[userId] = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    srv.timedOutUntil = timedOutUntil;
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async banMember(token: string | null, serverId: string, userId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'kickMembers') && !hasServerPermission(srv, me.id, 'manageServer')) {
      throw new Error('Permission denied.');
    }
    srv.memberIds = srv.memberIds.filter((id) => id !== userId);
    if (srv.memberRoles) delete srv.memberRoles[userId];
    if (!srv.bannedUserIds?.includes(userId)) {
      srv.bannedUserIds = [...(srv.bannedUserIds || []), userId];
    }
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async unbanMember(token: string | null, serverId: string, userId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'kickMembers') && !hasServerPermission(srv, me.id, 'manageServer')) {
      throw new Error('Permission denied.');
    }
    srv.bannedUserIds = (srv.bannedUserIds || []).filter((id) => id !== userId);
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async kickMember(token: string | null, serverId: string, userId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const idx = db.servers.findIndex((s) => s.id === serverId);
    if (idx === -1) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(db.servers[idx]);
    if (!hasServerPermission(srv, me.id, 'kickMembers')) {
      throw new Error('Permission denied.');
    }
    srv.memberIds = srv.memberIds.filter((id) => id !== userId);
    if (srv.memberRoles) delete srv.memberRoles[userId];
    db.servers[idx] = srv;
    writeLocalDB(db);
    return { server: srv };
  },

  async getVoiceParticipants(serverId: string) {
    const list = readLocalVoice().filter((p) => p.serverId === serverId);
    return { participants: list };
  },

  joinLocalVoice(participant: VoiceParticipant) {
    const next = readLocalVoice().filter((p) => p.userId !== participant.userId);
    next.push(participant);
    writeLocalVoice(next);
    return next.filter((p) => p.serverId === participant.serverId);
  },

  updateLocalVoiceState(
    userId: string,
    patch: Partial<Pick<VoiceParticipant, 'muted' | 'deafened' | 'speaking' | 'isStreaming' | 'streamTitle'>>
  ) {
    const list = readLocalVoice().map((p) => (p.userId === userId ? { ...p, ...patch } : p));
    writeLocalVoice(list);
    return list;
  },

  leaveLocalVoice(userId: string) {
    const next = readLocalVoice().filter((p) => p.userId !== userId);
    writeLocalVoice(next);
    return next;
  },

  async getServerMessages(token: string | null, serverId: string, channelId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const rawSrv = db.servers.find((s) => s.id === serverId);
    if (!rawSrv) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(rawSrv);
    const blocked = new Set(me.blockedUserIds);
    const messages = db.messages.filter(
      (m) => m.serverId === serverId && m.channelId === channelId && !blocked.has(m.authorId)
    );
    const members = db.users
      .filter((u) => srv.memberIds.includes(u.id))
      .map((u) => {
        const s = sanitize(u);
        if (s.id !== me.id && s.status === 'invisible') s.status = undefined;
        return s;
      });
    return { messages, members };
  },

  async sendServerMessage(
    token: string | null,
    serverId: string,
    data: {
      channelId: string;
      content: string;
      sharedPostId?: string;
      attachmentFile?: File | null;
      replyToMessageId?: string;
      forwardedFromAuthor?: string;
      audioDurationSec?: number;
    }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const rawSrv = db.servers.find((s) => s.id === serverId);
    if (!rawSrv) throw new Error('Server not found.');
    const srv = ensureLocalServerDefaults(rawSrv);
    if (srv.bannedUserIds?.includes(me.id)) {
      throw new Error('You are banned from this server.');
    }
    const timeoutIso = srv.timedOutUntil?.[me.id];
    if (timeoutIso && new Date(timeoutIso).getTime() > Date.now()) {
      const minsLeft = Math.max(1, Math.ceil((new Date(timeoutIso).getTime() - Date.now()) / 60000));
      throw new Error(`You are timed out in this server (${minsLeft} min remaining).`);
    }
    if (!hasServerPermission(srv, me.id, 'sendMessages')) {
      throw new Error('Your role does not allow sending messages.');
    }
    if (data.attachmentFile && !hasServerPermission(srv, me.id, 'attachFiles')) {
      throw new Error('Your role does not allow uploading attachments.');
    }

    const sharedPost = data.sharedPostId ? db.posts.find((p) => p.id === data.sharedPostId) : undefined;
    let attachmentType: ChatMessage['attachmentType'];
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (data.attachmentFile) {
      if (data.attachmentFile.type.startsWith('audio/')) attachmentType = 'audio';
      else if (data.attachmentFile.type.startsWith('video/')) attachmentType = 'video';
      else attachmentType = 'image';
      attachmentUrl = await fileToDataUrl(data.attachmentFile);
      attachmentName = data.attachmentFile.name;
    }

    let replyPreview: ChatMessage['replyPreview'];
    if (data.replyToMessageId) {
      const refMsg = db.messages.find((m) => m.id === data.replyToMessageId);
      if (refMsg) {
        replyPreview = {
          id: refMsg.id,
          authorName: refMsg.authorName,
          content: refMsg.content || (refMsg.attachmentType ? `[${refMsg.attachmentType}]` : ''),
          attachmentType: refMsg.attachmentType,
        };
      }
    }

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      serverId,
      channelId: data.channelId,
      authorId: me.id,
      authorName: me.name,
      authorTag: me.tag,
      authorAvatar: me.avatarUrl,
      content: data.content.trim(),
      attachmentType,
      attachmentUrl,
      attachmentName,
      audioDurationSec: data.audioDurationSec,
      reactions: {},
      pinned: false,
      bookmarkedByUserIds: [],
      replyToMessageId: data.replyToMessageId,
      replyPreview,
      forwardedFrom: data.forwardedFromAuthor ? { authorName: data.forwardedFromAuthor } : undefined,
      sharedPostId: sharedPost?.id,
      sharedPostPreview: sharedPost
        ? {
            id: sharedPost.id,
            title: sharedPost.title,
            content: sharedPost.content,
            mediaType: sharedPost.mediaType,
            mediaUrl: sharedPost.mediaUrl,
            authorName: sharedPost.authorName,
          }
        : undefined,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(message);
    if (sharedPost) sharedPost.sharesCount = (sharedPost.sharesCount || 0) + 1;
    writeLocalDB(db);
    return { message };
  },

  async getFriends(token: string | null): Promise<FriendsOverview & { discoverPlayers: User[] }> {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const myFriends = getFriendIds(db, me.id);
    const clean = (u: LocalUser) => {
      const s = sanitize(u);
      if (s.id !== me.id && s.status === 'invisible') s.status = undefined;
      return s;
    };
    const friends = db.users.filter((u) => myFriends.has(u.id)).map(clean);
    const incomingRequests = db.friendRequests
      .filter((fr) => fr.toUserId === me.id && fr.status === 'pending')
      .map((fr) => {
        const u = db.users.find((usr) => usr.id === fr.fromUserId);
        return u ? { ...fr, user: clean(u) } : null;
      })
      .filter((r): r is LocalFriendRequest & { user: User } => Boolean(r));
    const outgoingRequests = db.friendRequests
      .filter((fr) => fr.fromUserId === me.id && fr.status === 'pending')
      .map((fr) => {
        const u = db.users.find((usr) => usr.id === fr.toUserId);
        return u ? { ...fr, user: clean(u) } : null;
      })
      .filter((r): r is LocalFriendRequest & { user: User } => Boolean(r));
    const pendingIds = new Set([
      ...incomingRequests.map((r) => r.user.id),
      ...outgoingRequests.map((r) => r.user.id),
    ]);
    const discoverPlayers = db.users
      .filter((u) => u.id !== me.id && !myFriends.has(u.id) && !pendingIds.has(u.id))
      .map(clean);
    return { friends, incomingRequests, outgoingRequests, discoverPlayers };
  },

  async sendFriendRequest(token: string | null, identifier: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const clean = identifier.trim().toLowerCase();
    const target = db.users.find(
      (u) => u.tag.toLowerCase() === clean || u.email.toLowerCase() === clean || u.name.toLowerCase() === clean
    );
    if (!target) throw new Error('Could not find a user with that tag or email.');
    if (target.id === me.id) throw new Error('You cannot add yourself as a friend.');

    const existing = db.friendRequests.find(
      (fr) =>
        (fr.fromUserId === me.id && fr.toUserId === target.id) ||
        (fr.fromUserId === target.id && fr.toUserId === me.id)
    );
    if (existing) {
      if (existing.status === 'accepted') throw new Error('You are already friends!');
      if (existing.status === 'pending') throw new Error('A friend request is already pending.');
      existing.status = 'pending';
      existing.fromUserId = me.id;
      existing.toUserId = target.id;
    } else {
      db.friendRequests.push({
        id: `fr_${Date.now()}`,
        fromUserId: me.id,
        toUserId: target.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
    writeLocalDB(db);
    return { message: `Friend request sent to ${target.name}!`, status: 'pending' };
  },

  async respondFriendRequest(token: string | null, requestId: string, action: 'accept' | 'decline') {
    const db = readLocalDB();
    requireLocalUser(db, token);
    const reqItem = db.friendRequests.find((fr) => fr.id === requestId);
    if (!reqItem) throw new Error('Friend request not found.');
    reqItem.status = action === 'accept' ? 'accepted' : 'declined';
    writeLocalDB(db);
    return { request: { id: reqItem.id, status: reqItem.status } };
  },

  async removeFriend(token: string | null, friendId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    db.friendRequests = db.friendRequests.filter(
      (fr) =>
        !(
          (fr.fromUserId === me.id && fr.toUserId === friendId) ||
          (fr.fromUserId === friendId && fr.toUserId === me.id)
        )
    );
    writeLocalDB(db);
    return { success: true };
  },

  async getDirectMessages(token: string | null, friendId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const dmKey = [me.id, friendId].sort().join('__');
    return { messages: db.messages.filter((m) => m.dmKey === dmKey) };
  },

  async sendDirectMessage(
    token: string | null,
    friendId: string,
    data: {
      content: string;
      attachmentFile?: File | null;
      replyToMessageId?: string;
      forwardedFromAuthor?: string;
      audioDurationSec?: number;
    }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const dmKey = [me.id, friendId].sort().join('__');

    let attachmentType: ChatMessage['attachmentType'];
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (data.attachmentFile) {
      if (data.attachmentFile.type.startsWith('audio/')) attachmentType = 'audio';
      else if (data.attachmentFile.type.startsWith('video/')) attachmentType = 'video';
      else attachmentType = 'image';
      attachmentUrl = await fileToDataUrl(data.attachmentFile);
      attachmentName = data.attachmentFile.name;
    }

    let replyPreview: ChatMessage['replyPreview'];
    if (data.replyToMessageId) {
      const refMsg = db.messages.find((m) => m.id === data.replyToMessageId);
      if (refMsg) {
        replyPreview = {
          id: refMsg.id,
          authorName: refMsg.authorName,
          content: refMsg.content || (refMsg.attachmentType ? `[${refMsg.attachmentType}]` : ''),
          attachmentType: refMsg.attachmentType,
        };
      }
    }

    const message: ChatMessage = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      dmKey,
      authorId: me.id,
      authorName: me.name,
      authorTag: me.tag,
      authorAvatar: me.avatarUrl,
      content: data.content.trim(),
      attachmentType,
      attachmentUrl,
      attachmentName,
      audioDurationSec: data.audioDurationSec,
      reactions: {},
      pinned: false,
      bookmarkedByUserIds: [],
      replyToMessageId: data.replyToMessageId,
      replyPreview,
      forwardedFrom: data.forwardedFromAuthor ? { authorName: data.forwardedFromAuthor } : undefined,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(message);
    writeLocalDB(db);
    return { message };
  },

  async editMessage(token: string | null, messageId: string, content: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    if (msg.authorId !== me.id) throw new Error('You can only edit your own messages.');
    msg.content = content.trim();
    msg.editedAt = new Date().toISOString();
    writeLocalDB(db);
    return { message: msg };
  },

  async deleteMessage(token: string | null, messageId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    let allowed = msg.authorId === me.id;
    if (!allowed && msg.serverId) {
      const srv = db.servers.find((s) => s.id === msg.serverId);
      if (srv && hasServerPermission(ensureLocalServerDefaults(srv), me.id, 'manageMessages')) {
        allowed = true;
      }
    }
    if (!allowed) throw new Error('Permission denied.');
    db.messages = db.messages.filter((m) => m.id !== messageId);
    writeLocalDB(db);
    return { success: true };
  },

  async reactMessage(token: string | null, messageId: string, emoji: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    const reactions = { ...(msg.reactions || {}) };
    const list = [...(reactions[emoji] || [])];
    const idx = list.indexOf(me.id);
    if (idx === -1) list.push(me.id);
    else list.splice(idx, 1);
    if (list.length === 0) delete reactions[emoji];
    else reactions[emoji] = list;
    msg.reactions = reactions;
    writeLocalDB(db);
    return { message: msg };
  },

  async pinMessage(token: string | null, messageId: string) {
    const db = readLocalDB();
    requireLocalUser(db, token);
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    msg.pinned = !msg.pinned;
    writeLocalDB(db);
    return { message: msg };
  },

  async bookmarkMessage(token: string | null, messageId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found.');
    const list = [...(msg.bookmarkedByUserIds || [])];
    const idx = list.indexOf(me.id);
    let bookmarked = false;
    if (idx === -1) {
      list.push(me.id);
      bookmarked = true;
    } else {
      list.splice(idx, 1);
    }
    msg.bookmarkedByUserIds = list;
    writeLocalDB(db);
    return { bookmarked, message: msg };
  },

  async getPosts(
    token: string | null,
    params?: { scope?: 'feed' | 'profile'; userId?: string; mediaType?: 'all' | 'image' | 'video' | 'none' }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const myFriends = getFriendIds(db, me.id);
    const blocked = new Set(me.blockedUserIds);
    const posts = db.posts
      .filter((p) => {
        if (blocked.has(p.authorId)) return false;
        if (params?.scope === 'profile' && params?.userId && p.authorId !== params.userId) return false;
        if (params?.mediaType && params.mediaType !== 'all' && p.mediaType !== params.mediaType) return false;
        if (p.authorId === me.id) return true;
        if (p.visibility === 'public') return true;
        if (p.visibility === 'friends') return myFriends.has(p.authorId);
        return false;
      })
      .map((p) => ({
        ...p,
        comments: p.comments.filter((c) => !blocked.has(c.authorId)),
      }));
    return { posts };
  },

  async createPost(
    token: string | null,
    data: { title?: string; content: string; visibility: Visibility; mediaFile?: File | null }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    let mediaType: 'none' | 'image' | 'video' = 'none';
    let mediaUrl: string | undefined;
    if (data.mediaFile) {
      mediaType = data.mediaFile.type.startsWith('video/') ? 'video' : 'image';
      mediaUrl = await fileToDataUrl(data.mediaFile);
    }
    const post: Post = {
      id: `post_${Date.now()}`,
      authorId: me.id,
      authorName: me.name,
      authorTag: me.tag,
      authorAvatar: me.avatarUrl,
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      mediaType,
      mediaUrl,
      visibility: data.visibility,
      likes: [],
      sharesCount: 0,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    db.posts.unshift(post);
    writeLocalDB(db);
    return { post };
  },

  async updatePost(
    token: string | null,
    postId: string,
    updates: { visibility?: Visibility; content?: string; title?: string }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    if (post.authorId !== me.id) throw new Error('Permission denied.');
    if (updates.visibility) post.visibility = updates.visibility;
    if (updates.content !== undefined) post.content = updates.content;
    if (updates.title !== undefined) post.title = updates.title;
    writeLocalDB(db);
    return { post };
  },

  async deletePost(token: string | null, postId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    db.posts = db.posts.filter((p) => !(p.id === postId && p.authorId === me.id));
    writeLocalDB(db);
    return { success: true };
  },

  async toggleLike(token: string | null, postId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const idx = post.likes.indexOf(me.id);
    if (idx === -1) post.likes.push(me.id);
    else post.likes.splice(idx, 1);
    writeLocalDB(db);
    return { likes: post.likes };
  },

  async sharePost(token: string | null, postId: string) {
    const db = readLocalDB();
    requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    post.sharesCount = (post.sharesCount || 0) + 1;
    writeLocalDB(db);
    return { sharesCount: post.sharesCount };
  },

  async addComment(token: string | null, postId: string, content: string, parentCommentId?: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const validParentId =
      parentCommentId && post.comments.some((c) => c.id === parentCommentId)
        ? parentCommentId
        : undefined;
    const comment: PostComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      postId: post.id,
      parentCommentId: validParentId,
      authorId: me.id,
      authorName: me.name,
      authorTag: me.tag,
      authorAvatar: me.avatarUrl,
      content: content.trim(),
      reactions: {},
      hiddenByUserIds: [],
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    writeLocalDB(db);
    const blocked = new Set(me.blockedUserIds);
    return { comment, comments: post.comments.filter((c) => !blocked.has(c.authorId)) };
  },

  async editComment(token: string | null, postId: string, commentId: string, content: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    if (comment.authorId !== me.id) throw new Error('You can only edit your own comments.');
    comment.content = content.trim();
    comment.editedAt = new Date().toISOString();
    writeLocalDB(db);
    const blocked = new Set(me.blockedUserIds);
    return { comment, comments: post.comments.filter((c) => !blocked.has(c.authorId)) };
  },

  async reactComment(token: string | null, postId: string, commentId: string, emoji: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    const reactions = { ...(comment.reactions || {}) };
    const list = [...(reactions[emoji] || [])];
    const idx = list.indexOf(me.id);
    if (idx === -1) list.push(me.id);
    else list.splice(idx, 1);
    if (list.length === 0) delete reactions[emoji];
    else reactions[emoji] = list;
    comment.reactions = reactions;
    writeLocalDB(db);
    const blocked = new Set(me.blockedUserIds);
    return { comments: post.comments.filter((c) => !blocked.has(c.authorId)) };
  },

  async toggleHideComment(token: string | null, postId: string, commentId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    const hiddenBy = [...(comment.hiddenByUserIds || [])];
    const idx = hiddenBy.indexOf(me.id);
    let hidden = false;
    if (idx === -1) {
      hiddenBy.push(me.id);
      hidden = true;
    } else {
      hiddenBy.splice(idx, 1);
    }
    comment.hiddenByUserIds = hiddenBy;
    writeLocalDB(db);
    const blocked = new Set(me.blockedUserIds);
    return { hidden, comments: post.comments.filter((c) => !blocked.has(c.authorId)) };
  },

  async deleteComment(token: string | null, postId: string, commentId: string) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const post = db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    const toDelete = new Set<string>([commentId]);
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
    writeLocalDB(db);
    const blocked = new Set(me.blockedUserIds);
    return { comments: post.comments.filter((c) => !blocked.has(c.authorId)) };
  },

  async submitReport(
    token: string | null,
    data: {
      targetType: 'user' | 'post' | 'comment' | 'message';
      targetId: string;
      targetUserId: string;
      targetUserName: string;
      reason: string;
      details: string;
      alsoBlock?: boolean;
    }
  ) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    const report: ReportRecord = {
      id: `rpt_${Date.now()}`,
      reporterId: me.id,
      targetType: data.targetType,
      targetId: data.targetId,
      targetUserId: data.targetUserId,
      targetUserName: data.targetUserName,
      reason: data.reason,
      details: data.details,
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    db.reports.unshift(report);
    if (data.alsoBlock && !me.blockedUserIds.includes(data.targetUserId)) {
      me.blockedUserIds.push(data.targetUserId);
    }
    writeLocalDB(db);
    return { report, message: 'Report submitted to Pilgrim Safety Team.' };
  },

  async getMyReports(token: string | null) {
    const db = readLocalDB();
    const me = requireLocalUser(db, token);
    return { reports: db.reports.filter((r) => r.reporterId === me.id) };
  },
};
