import { ChatMessage, RolePermissions, Server, ServerRole, User, UserStatus } from '../types';

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
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

export function createDefaultRolesForServer(serverId: string): ServerRole[] {
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
      permissions: { ...DEFAULT_ROLE_PERMISSIONS },
    },
  ];
}

export function getMemberRoles(server: Server | null | undefined, userId: string): ServerRole[] {
  if (!server || !server.roles) return [];
  const roleIds = server.memberRoles?.[userId] || [];
  return server.roles.filter((r) => roleIds.includes(r.id));
}

export function hasServerPermission(
  server: Server | null | undefined,
  userId: string,
  perm: keyof RolePermissions
): boolean {
  if (!server) return false;
  if (server.ownerId === userId) return true;
  if (!server.memberIds.includes(userId)) return false;

  const assigned = getMemberRoles(server, userId);
  if (assigned.length === 0) {
    // Baseline member permissions when no custom roles are assigned
    return DEFAULT_ROLE_PERMISSIONS[perm];
  }
  return assigned.some((r) => r.permissions.administrator || r.permissions[perm]);
}

export function getEffectiveStatus(
  targetUser: Pick<User, 'id' | 'status'>,
  onlineUserIds: string[],
  currentUserId?: string
): 'online' | 'idle' | 'dnd' | 'offline' {
  const isSelf = currentUserId && targetUser.id === currentUserId;
  const connected = isSelf || onlineUserIds.includes(targetUser.id);
  const raw: UserStatus = targetUser.status || 'online';

  if (!connected) return 'offline';
  if (raw === 'invisible') {
    return isSelf ? 'offline' : 'offline';
  }
  return raw;
}

export function formatKeybindLabel(code: string): string {
  if (!code) return 'Space';
  if (code === 'Space') return 'Spacebar';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  return code;
}

export function isMessagePingForUser(
  msg: Pick<ChatMessage, 'authorId' | 'content' | 'replyPreview'>,
  user: Pick<User, 'id' | 'name' | 'tag'>
): boolean {
  if (!user || msg.authorId === user.id) return false;
  if (msg.replyPreview) {
    if (msg.replyPreview.authorId && msg.replyPreview.authorId === user.id) return true;
    if (!msg.replyPreview.authorId && msg.replyPreview.authorName === user.name) return true;
  }
  const text = (msg.content || '').toLowerCase();
  if (!text.includes('@')) return false;
  if (/(^|\s)@(everyone|here)\b/i.test(text)) return true;

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = Array.from(
    new Set(
      [user.name, user.tag, user.tag.split('#')[0]]
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  return candidates.some((name) => new RegExp(`(^|\\s)@${esc(name)}(?=\\s|$|[.,!?:;])`, 'i').test(text));
}
