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
  GifItem,
} from '../types';
import { localFallback } from './localFallback';
import { searchBuiltInGifs } from '../utils/gifLibrary';

const TOKEN_KEY = 'pilgrim_auth_token';
const USER_KEY = 'pilgrim_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit & { skipLocalTokenCheck?: boolean } = {}
): Promise<T> {
  const { skipLocalTokenCheck, ...fetchOptions } = options;
  const token = getStoredToken();
  if (!skipLocalTokenCheck && token?.startsWith('local_token:')) {
    throw new BackendUnavailableError('Using local session store.');
  }

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token && !skipLocalTokenCheck) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(endpoint, { ...fetchOptions, headers });
  } catch {
    throw new BackendUnavailableError('Backend server is unreachable.');
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const looksLikeHtml =
    contentType.includes('text/html') ||
    rawText.trimStart().toLowerCase().startsWith('<!doctype') ||
    rawText.trimStart().toLowerCase().startsWith('<html');

  if (looksLikeHtml) {
    throw new BackendUnavailableError('Static preview returned HTML instead of API JSON.');
  }

  let parsed: any = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      throw new BackendUnavailableError('Backend returned non-JSON response.');
    }
  }

  if (!res.ok) {
    const msg = parsed?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return parsed as T;
}

async function withFallback<T>(remoteFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> {
  try {
    return await remoteFn();
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return fallbackFn();
    }
    throw err;
  }
}

export const api = {
  // Auth
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
    const fd = new FormData();
    fd.append('email', data.email);
    fd.append('password', data.password);
    fd.append('name', data.name);
    fd.append('birthDate', data.birthDate);
    if (data.bio !== undefined) fd.append('bio', data.bio);
    if (data.squadTitle !== undefined) fd.append('squadTitle', data.squadTitle);
    if (data.avatarFile) fd.append('avatar', data.avatarFile);
    if (data.presetAvatarUrl) fd.append('presetAvatarUrl', data.presetAvatarUrl);

    const res = await withFallback(
      () =>
        request<{ token: string; user: User; isNewSignup?: boolean }>('/api/auth/register', {
          method: 'POST',
          body: fd,
          skipLocalTokenCheck: true,
        }),
      () => localFallback.register(data)
    );
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async login(data: { email: string; password: string }) {
    const res = await withFallback(
      () =>
        request<{ token: string; user: User }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(data),
          skipLocalTokenCheck: true,
        }),
      () => localFallback.login(data)
    );
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async requestEmailLoginCode(email: string) {
    return withFallback(
      () =>
        request<{
          sent: boolean;
          deliveryMode: 'email';
          expiresInSeconds: number;
        }>('/api/auth/email/request-code', {
          method: 'POST',
          body: JSON.stringify({ email }),
          skipLocalTokenCheck: true,
        }),
      () => localFallback.requestEmailLoginCode(email)
    );
  },

  async verifyEmailLoginCode(data: { email?: string; code?: string; magicToken?: string }) {
    const res = await withFallback(
      () =>
        request<{ token: string; user: User }>('/api/auth/email/verify-code', {
          method: 'POST',
          body: JSON.stringify(data),
          skipLocalTokenCheck: true,
        }),
      () => localFallback.verifyEmailLoginCode(data)
    );
    setStoredToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async getMe() {
    const token = getStoredToken();
    const res = await withFallback(
      () => request<{ user: User }>('/api/auth/me'),
      () => localFallback.getMe(token)
    );
    setStoredUser(res.user);
    return res;
  },

  logout() {
    clearStoredAuth();
  },

  // Presence & Profile
  async updateStatus(status: UserStatus) {
    const token = getStoredToken();
    const res = await withFallback(
      () =>
        request<{ user: User }>('/api/users/me/status', {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      () => localFallback.updateStatus(token, status)
    );
    setStoredUser(res.user);
    return res;
  },

  async updateStreamStatus(isStreaming: boolean, streamTitle?: string) {
    const token = getStoredToken();
    const res = await withFallback(
      () =>
        request<{ user: User }>('/api/users/me/stream', {
          method: 'PATCH',
          body: JSON.stringify({ isStreaming, streamTitle }),
        }),
      () => localFallback.updateStreamStatus(token, isStreaming, streamTitle)
    );
    setStoredUser(res.user);
    return res;
  },

  async updateProfile(data: {
    name?: string;
    bio?: string;
    squadTitle?: string;
    avatarFile?: File | null;
    bannerFile?: File | null;
    presetAvatarUrl?: string;
    removeAvatar?: boolean;
    removeBanner?: boolean;
  }) {
    const token = getStoredToken();
    const fd = new FormData();
    if (data.name !== undefined) fd.append('name', data.name);
    if (data.bio !== undefined) fd.append('bio', data.bio);
    if (data.squadTitle !== undefined) fd.append('squadTitle', data.squadTitle);
    if (data.avatarFile) fd.append('avatar', data.avatarFile);
    if (data.bannerFile) fd.append('banner', data.bannerFile);
    if (data.presetAvatarUrl) fd.append('presetAvatarUrl', data.presetAvatarUrl);
    if (data.removeAvatar) fd.append('removeAvatar', 'true');
    if (data.removeBanner) fd.append('removeBanner', 'true');

    const res = await withFallback(
      () =>
        request<{ user: User }>('/api/users/me', {
          method: 'PATCH',
          body: fd,
        }),
      () => localFallback.updateProfile(token, data)
    );
    setStoredUser(res.user);
    return res;
  },

  async getUserProfile(userId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{
          user: User;
          isFriend: boolean;
          friendCount: number;
          pendingDirection: 'incoming' | 'outgoing' | null;
        }>(`/api/users/${userId}`),
      () => localFallback.getUserProfile(token, userId)
    );
  },

  async toggleBlockUser(targetUserId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ blocked: boolean; blockedUserIds: string[] }>('/api/users/block', {
          method: 'POST',
          body: JSON.stringify({ targetUserId }),
        }),
      () => localFallback.toggleBlockUser(token, targetUserId)
    );
  },

  // Servers, Channels, Roles & Voice
  async getServers(q = '') {
    const token = getStoredToken();
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return withFallback(
      () =>
        request<{ servers: Array<Server & { isMember: boolean; memberCount: number }> }>(
          `/api/servers${qs}`
        ),
      () => localFallback.getServers(token, q)
    );
  },

  async createServer(data: {
    name: string;
    description: string;
    category?: string;
    iconStyle?: string;
    iconFile?: File | null;
  }) {
    const token = getStoredToken();
    const fd = new FormData();
    fd.append('name', data.name);
    fd.append('description', data.description);
    if (data.category) fd.append('category', data.category);
    if (data.iconStyle) fd.append('iconStyle', data.iconStyle);
    if (data.iconFile) fd.append('icon', data.iconFile);

    return withFallback(
      () =>
        request<{ server: Server & { isMember: boolean; memberCount: number } }>('/api/servers', {
          method: 'POST',
          body: fd,
        }),
      () => localFallback.createServer(token, data)
    );
  },

  async updateServer(
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
    const token = getStoredToken();
    const fd = new FormData();
    if (data.name !== undefined) fd.append('name', data.name);
    if (data.description !== undefined) fd.append('description', data.description);
    if (data.iconStyle !== undefined) fd.append('iconStyle', data.iconStyle);
    if (data.iconFile) fd.append('icon', data.iconFile);
    if (data.bannerFile) fd.append('banner', data.bannerFile);
    if (data.removeIcon) fd.append('removeIcon', 'true');
    if (data.removeBanner) fd.append('removeBanner', 'true');

    return withFallback(
      () =>
        request<{ server: Server & { isMember: boolean; memberCount: number } }>(
          `/api/servers/${serverId}`,
          {
            method: 'PATCH',
            body: fd,
          }
        ),
      () => localFallback.updateServer(token, serverId, data)
    );
  },

  async joinServer(serverId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server & { isMember: boolean; memberCount: number } }>(
          `/api/servers/${serverId}/join`,
          { method: 'POST' }
        ),
      () => localFallback.joinServer(token, serverId)
    );
  },

  async createCategory(serverId: string, name: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ category: ChannelCategory; server: Server }>(
          `/api/servers/${serverId}/categories`,
          {
            method: 'POST',
            body: JSON.stringify({ name }),
          }
        ),
      () => localFallback.createCategory(token, serverId, name)
    );
  },

  async updateCategory(
    serverId: string,
    catId: string,
    data: { name?: string; collapsed?: boolean }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ category: ChannelCategory; server: Server }>(
          `/api/servers/${serverId}/categories/${catId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(data),
          }
        ),
      () => localFallback.updateCategory(token, serverId, catId, data)
    );
  },

  async deleteCategory(serverId: string, catId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/categories/${catId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteCategory(token, serverId, catId)
    );
  },

  async createChannel(
    serverId: string,
    data: { name: string; topic?: string; type?: 'text' | 'voice'; categoryId?: string }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ channel: Channel; server: Server }>(`/api/servers/${serverId}/channels`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      () => localFallback.createChannel(token, serverId, data)
    );
  },

  async updateChannel(
    serverId: string,
    channelId: string,
    data: { name?: string; topic?: string; categoryId?: string | null }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ channel: Channel; server: Server }>(
          `/api/servers/${serverId}/channels/${channelId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(data),
          }
        ),
      () => localFallback.updateChannel(token, serverId, channelId, data)
    );
  },

  async deleteChannel(serverId: string, channelId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/channels/${channelId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteChannel(token, serverId, channelId)
    );
  },

  async uploadServerEmoji(
    serverId: string,
    data: { name: string; file: File; animated: boolean }
  ) {
    const token = getStoredToken();
    const fd = new FormData();
    fd.append('name', data.name);
    fd.append('animated', String(data.animated));
    fd.append('emoji', data.file);

    return withFallback(
      () =>
        request<{ emoji: CustomEmoji; server: Server }>(`/api/servers/${serverId}/emojis`, {
          method: 'POST',
          body: fd,
        }),
      () => localFallback.uploadServerEmoji(token, serverId, data)
    );
  },

  async deleteServerEmoji(serverId: string, emojiId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/emojis/${emojiId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteServerEmoji(token, serverId, emojiId)
    );
  },

  async createInvite(serverId: string, options?: { maxUses?: number; maxAgeHours?: number }) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ invite: ServerInvite; server: Server }>(`/api/servers/${serverId}/invites`, {
          method: 'POST',
          body: JSON.stringify(options || {}),
        }),
      () => localFallback.createInvite(token, serverId, options)
    );
  },

  async deleteInvite(serverId: string, code: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/invites/${encodeURIComponent(code)}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteInvite(token, serverId, code)
    );
  },

  async getInvitePreview(code: string) {
    return withFallback(
      () =>
        request<{
          invite: ServerInvite;
          server: {
            id: string;
            name: string;
            description: string;
            iconUrl?: string;
            bannerUrl?: string;
            iconStyle?: string;
            memberCount: number;
          };
        }>(`/api/invites/${encodeURIComponent(code)}`),
      () => localFallback.getInvitePreview(code)
    );
  },

  async joinByInvite(code: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server & { isMember: boolean; memberCount: number } }>(
          `/api/invites/${encodeURIComponent(code)}/join`,
          { method: 'POST' }
        ),
      () => localFallback.joinByInvite(token, code)
    );
  },

  async searchGifs(query = '', category = 'All') {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set('q', query.trim());
    if (category && category !== 'All') qs.set('category', category);
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    return withFallback(
      () => request<{ gifs: GifItem[] }>(`/api/gifs${queryStr}`),
      async () => ({ gifs: searchBuiltInGifs(query, category, false) })
    );
  },

  async createRole(
    serverId: string,
    data: { name: string; color?: string; permissions?: Partial<RolePermissions> }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ role: ServerRole; server: Server }>(`/api/servers/${serverId}/roles`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      () => localFallback.createRole(token, serverId, data)
    );
  },

  async updateRole(
    serverId: string,
    roleId: string,
    data: { name?: string; color?: string; permissions?: Partial<RolePermissions> }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ role: ServerRole; server: Server }>(
          `/api/servers/${serverId}/roles/${roleId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(data),
          }
        ),
      () => localFallback.updateRole(token, serverId, roleId, data)
    );
  },

  async deleteRole(serverId: string, roleId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/roles/${roleId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteRole(token, serverId, roleId)
    );
  },

  async assignMemberRoles(serverId: string, userId: string, roleIds: string[]) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/members/${userId}/roles`, {
          method: 'POST',
          body: JSON.stringify({ roleIds }),
        }),
      () => localFallback.assignMemberRoles(token, serverId, userId, roleIds)
    );
  },

  async timeoutMember(serverId: string, userId: string, minutes: number) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/members/${userId}/timeout`, {
          method: 'POST',
          body: JSON.stringify({ minutes }),
        }),
      () => localFallback.timeoutMember(token, serverId, userId, minutes)
    );
  },

  async banMember(serverId: string, userId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/members/${userId}/ban`, {
          method: 'POST',
        }),
      () => localFallback.banMember(token, serverId, userId)
    );
  },

  async unbanMember(serverId: string, userId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/bans/${userId}`, {
          method: 'DELETE',
        }),
      () => localFallback.unbanMember(token, serverId, userId)
    );
  },

  async kickMember(serverId: string, userId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ server: Server }>(`/api/servers/${serverId}/members/${userId}`, {
          method: 'DELETE',
        }),
      () => localFallback.kickMember(token, serverId, userId)
    );
  },

  async getVoiceParticipants(serverId: string) {
    return withFallback(
      () => request<{ participants: VoiceParticipant[] }>(`/api/servers/${serverId}/voice`),
      () => localFallback.getVoiceParticipants(serverId)
    );
  },

  async getServerMessages(serverId: string, channelId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ messages: ChatMessage[]; members: User[] }>(
          `/api/servers/${serverId}/messages?channelId=${encodeURIComponent(channelId)}`
        ),
      () => localFallback.getServerMessages(token, serverId, channelId)
    );
  },

  async sendServerMessage(
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
    const token = getStoredToken();
    const useMultipart = Boolean(data.attachmentFile);

    const buildBody = () => {
      if (!useMultipart) {
        return JSON.stringify({
          channelId: data.channelId,
          content: data.content,
          sharedPostId: data.sharedPostId,
          replyToMessageId: data.replyToMessageId,
          forwardedFromAuthor: data.forwardedFromAuthor,
          audioDurationSec: data.audioDurationSec,
        });
      }
      const fd = new FormData();
      fd.append('channelId', data.channelId);
      fd.append('content', data.content);
      if (data.sharedPostId) fd.append('sharedPostId', data.sharedPostId);
      if (data.replyToMessageId) fd.append('replyToMessageId', data.replyToMessageId);
      if (data.forwardedFromAuthor) fd.append('forwardedFromAuthor', data.forwardedFromAuthor);
      if (data.audioDurationSec !== undefined) fd.append('audioDurationSec', String(data.audioDurationSec));
      if (data.attachmentFile) fd.append('attachment', data.attachmentFile);
      return fd;
    };

    return withFallback(
      () =>
        request<{ message: ChatMessage }>(`/api/servers/${serverId}/messages`, {
          method: 'POST',
          body: buildBody(),
        }),
      () => localFallback.sendServerMessage(token, serverId, data)
    );
  },

  // Message Interactions (Edit, Delete, React, Pin, Bookmark)
  async editMessage(messageId: string, content: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ message: ChatMessage }>(`/api/messages/${messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        }),
      () => localFallback.editMessage(token, messageId, content)
    );
  },

  async deleteMessage(messageId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ success: boolean }>(`/api/messages/${messageId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteMessage(token, messageId)
    );
  },

  async reactMessage(messageId: string, emoji: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ message: ChatMessage }>(`/api/messages/${messageId}/react`, {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }),
      () => localFallback.reactMessage(token, messageId, emoji)
    );
  },

  async pinMessage(messageId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ message: ChatMessage }>(`/api/messages/${messageId}/pin`, {
          method: 'POST',
        }),
      () => localFallback.pinMessage(token, messageId)
    );
  },

  async bookmarkMessage(messageId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ bookmarked: boolean; message: ChatMessage }>(`/api/messages/${messageId}/bookmark`, {
          method: 'POST',
        }),
      () => localFallback.bookmarkMessage(token, messageId)
    );
  },

  // Friends & DMs
  async getFriends() {
    const token = getStoredToken();
    return withFallback(
      () => request<FriendsOverview & { discoverPlayers: User[] }>('/api/friends'),
      () => localFallback.getFriends(token)
    );
  },

  async sendFriendRequest(identifier: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ message: string; status?: string }>('/api/friends/request', {
          method: 'POST',
          body: JSON.stringify({ identifier }),
        }),
      () => localFallback.sendFriendRequest(token, identifier)
    );
  },

  async respondFriendRequest(requestId: string, action: 'accept' | 'decline') {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ request: { id: string; status: string } }>('/api/friends/respond', {
          method: 'POST',
          body: JSON.stringify({ requestId, action }),
        }),
      () => localFallback.respondFriendRequest(token, requestId, action)
    );
  },

  async removeFriend(friendId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ success: boolean }>(`/api/friends/${friendId}`, {
          method: 'DELETE',
        }),
      () => localFallback.removeFriend(token, friendId)
    );
  },

  async getDirectMessages(friendId: string) {
    const token = getStoredToken();
    return withFallback(
      () => request<{ messages: ChatMessage[] }>(`/api/dms/${friendId}`),
      () => localFallback.getDirectMessages(token, friendId)
    );
  },

  async sendDirectMessage(
    friendId: string,
    data:
      | string
      | {
          content: string;
          attachmentFile?: File | null;
          replyToMessageId?: string;
          forwardedFromAuthor?: string;
          audioDurationSec?: number;
        }
  ) {
    const token = getStoredToken();
    const payload = typeof data === 'string' ? { content: data } : data;
    const useMultipart = Boolean(payload.attachmentFile);

    const buildBody = () => {
      if (!useMultipart) {
        return JSON.stringify({
          content: payload.content,
          replyToMessageId: payload.replyToMessageId,
          forwardedFromAuthor: payload.forwardedFromAuthor,
          audioDurationSec: payload.audioDurationSec,
        });
      }
      const fd = new FormData();
      fd.append('content', payload.content);
      if (payload.replyToMessageId) fd.append('replyToMessageId', payload.replyToMessageId);
      if (payload.forwardedFromAuthor) fd.append('forwardedFromAuthor', payload.forwardedFromAuthor);
      if (payload.audioDurationSec !== undefined) fd.append('audioDurationSec', String(payload.audioDurationSec));
      if (payload.attachmentFile) fd.append('attachment', payload.attachmentFile);
      return fd;
    };

    return withFallback(
      () =>
        request<{ message: ChatMessage }>(`/api/dms/${friendId}`, {
          method: 'POST',
          body: buildBody(),
        }),
      () => localFallback.sendDirectMessage(token, friendId, payload)
    );
  },

  // Posts, Videos, Images & Thoughts
  async getPosts(params?: {
    scope?: 'feed' | 'profile';
    userId?: string;
    mediaType?: 'all' | 'image' | 'video' | 'none';
  }) {
    const token = getStoredToken();
    const query = new URLSearchParams();
    if (params?.scope) query.set('scope', params.scope);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.mediaType) query.set('mediaType', params.mediaType);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return withFallback(
      () => request<{ posts: Post[] }>(`/api/posts${qs}`),
      () => localFallback.getPosts(token, params)
    );
  },

  async createPost(data: {
    title?: string;
    content: string;
    visibility: Visibility;
    mediaFile?: File | null;
  }) {
    const token = getStoredToken();
    const fd = new FormData();
    if (data.title) fd.append('title', data.title);
    fd.append('content', data.content);
    fd.append('visibility', data.visibility);
    if (data.mediaFile) fd.append('media', data.mediaFile);

    return withFallback(
      () =>
        request<{ post: Post }>('/api/posts', {
          method: 'POST',
          body: fd,
        }),
      () => localFallback.createPost(token, data)
    );
  },

  async updatePost(
    postId: string,
    updates: { visibility?: Visibility; content?: string; title?: string }
  ) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ post: Post }>(`/api/posts/${postId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }),
      () => localFallback.updatePost(token, postId, updates)
    );
  },

  async deletePost(postId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ success: boolean }>(`/api/posts/${postId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deletePost(token, postId)
    );
  },

  async toggleLike(postId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ likes: string[] }>(`/api/posts/${postId}/like`, {
          method: 'POST',
        }),
      () => localFallback.toggleLike(token, postId)
    );
  },

  async sharePost(postId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ sharesCount: number }>(`/api/posts/${postId}/share`, {
          method: 'POST',
        }),
      () => localFallback.sharePost(token, postId)
    );
  },

  async addComment(postId: string, content: string, parentCommentId?: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ comment: PostComment; comments: PostComment[] }>(`/api/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content, parentCommentId }),
        }),
      () => localFallback.addComment(token, postId, content, parentCommentId)
    );
  },

  async editComment(postId: string, commentId: string, content: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ comment: PostComment; comments: PostComment[] }>(
          `/api/posts/${postId}/comments/${commentId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ content }),
          }
        ),
      () => localFallback.editComment(token, postId, commentId, content)
    );
  },

  async reactComment(postId: string, commentId: string, emoji: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ comments: PostComment[] }>(
          `/api/posts/${postId}/comments/${commentId}/react`,
          {
            method: 'POST',
            body: JSON.stringify({ emoji }),
          }
        ),
      () => localFallback.reactComment(token, postId, commentId, emoji)
    );
  },

  async toggleHideComment(postId: string, commentId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ hidden: boolean; comments: PostComment[] }>(
          `/api/posts/${postId}/comments/${commentId}/hide`,
          {
            method: 'POST',
          }
        ),
      () => localFallback.toggleHideComment(token, postId, commentId)
    );
  },

  async deleteComment(postId: string, commentId: string) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ comments: PostComment[] }>(`/api/posts/${postId}/comments/${commentId}`, {
          method: 'DELETE',
        }),
      () => localFallback.deleteComment(token, postId, commentId)
    );
  },

  // Safety & Reports
  async submitReport(data: {
    targetType: 'user' | 'post' | 'comment' | 'message';
    targetId: string;
    targetUserId: string;
    targetUserName: string;
    reason: string;
    details: string;
    alsoBlock?: boolean;
  }) {
    const token = getStoredToken();
    return withFallback(
      () =>
        request<{ report: ReportRecord; message: string }>('/api/reports', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      () => localFallback.submitReport(token, data)
    );
  },

  async getMyReports() {
    const token = getStoredToken();
    return withFallback(
      () => request<{ reports: ReportRecord[] }>('/api/reports/mine'),
      () => localFallback.getMyReports(token)
    );
  },
};
