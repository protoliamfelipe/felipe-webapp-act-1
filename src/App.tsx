import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Video,
  Image as ImageIcon,
  MessageSquare,
  Home,
  Flame,
  Compass,
  Users,
  Settings,
} from 'lucide-react';
import {
  User,
  UserStatus,
  Server,
  Channel,
  Post,
  ChatMessage,
  FriendsOverview,
  Visibility,
  UserPreferences,
  VoiceParticipant,
  VoiceSettings,
  AppNotification,
} from './types';
import { api, getStoredToken, clearStoredAuth } from './services/api';
import { localFallback } from './services/localFallback';
import { makeInitialsAvatar } from './utils/avatars';
import { hasServerPermission, isMessagePingForUser } from './utils/permissions';
import {
  playVcJoinSound,
  playVcLeaveSound,
  playVcMuteSound,
  playVcUnmuteSound,
  playVcDeafenSound,
  playVcUndeafenSound,
  playVcPeerJoinSound,
  playVcPeerLeaveSound,
  playNotificationChime,
} from './utils/sounds';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar, AppView, ActiveVoiceInfo } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { StartupPage } from './components/StartupPage';
import { PostCard } from './components/PostCard';
import { PostComposerModal } from './components/PostComposerModal';
import { ProfileDashboard } from './components/ProfileDashboard';
import { ServerWorkspace } from './components/ServerWorkspace';
import { FriendsView } from './components/FriendsView';
import { NewServerModal } from './components/NewServerModal';
import { ReportModal, ReportTarget } from './components/ReportModal';
import { SharePostModal } from './components/SharePostModal';
import { ForwardMessageModal } from './components/ForwardMessageModal';
import { SafetyView } from './components/SafetyView';
import { SettingsView } from './components/SettingsView';
import { DiscoverServersView } from './components/DiscoverServersView';
import { LiveStreamModal } from './components/LiveStreamModal';

const PREFERENCES_STORAGE_KEY = 'pilgrim_user_preferences';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputMode: 'vad',
  pttKey: 'Space',
  inputVolume: 100,
  outputVolume: 100,
  sensitivity: 45,
  noiseSuppression: true,
  echoCancellation: true,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  fontSize: 'standard',
  letterSpacing: 'normal',
  contentSpacing: 'comfortable',
  notificationSound: true,
  voice: DEFAULT_VOICE_SETTINGS,
};

function loadStoredPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      fontSize: ['compact', 'standard', 'large', 'xlarge'].includes(parsed.fontSize)
        ? parsed.fontSize
        : 'standard',
      letterSpacing: ['tight', 'normal', 'relaxed', 'wide'].includes(parsed.letterSpacing)
        ? parsed.letterSpacing
        : 'normal',
      contentSpacing: ['compact', 'comfortable', 'spacious'].includes(parsed.contentSpacing)
        ? parsed.contentSpacing
        : 'comfortable',
      notificationSound:
        typeof parsed.notificationSound === 'boolean' ? parsed.notificationSound : true,
      voice: {
        ...DEFAULT_VOICE_SETTINGS,
        ...(parsed.voice && typeof parsed.voice === 'object' ? parsed.voice : {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadStoredPreferences());

  // Navigation & Views
  const [activeView, setActiveView] = useState<AppView>('startup');
  const [settingsFocusSection, setSettingsFocusSection] = useState<'appearance' | 'voice'>('appearance');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false);

  // Servers & Chat
  const [servers, setServers] = useState<Array<Server & { isMember: boolean; memberCount: number }>>([]);
  const [serverSearch, setServerSearch] = useState('');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [incomingWsMessage, setIncomingWsMessage] = useState<ChatMessage | null>(null);
  const [incomingWsUpdatedMessage, setIncomingWsUpdatedMessage] = useState<ChatMessage | null>(null);
  const [incomingWsDeletedMessageId, setIncomingWsDeletedMessageId] = useState<string | null>(null);

  // Voice Channels & WebRTC Refs
  const [voiceParticipantsByServer, setVoiceParticipantsByServer] = useState<
    Record<string, VoiceParticipant[]>
  >({});
  const [activeVoice, setActiveVoice] = useState<ActiveVoiceInfo | null>(null);

  // Feed & Profile
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedFilter, setFeedFilter] = useState<'all' | 'video' | 'image' | 'none'>('all');
  const [viewedProfile, setViewedProfile] = useState<{
    user: User;
    isFriend: boolean;
    friendCount: number;
    pendingDirection: 'incoming' | 'outgoing' | null;
  } | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);

  // Friends, DMs & Live Notifications
  const [friendsData, setFriendsData] = useState<FriendsOverview & { discoverPlayers: User[] }>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    discoverPlayers: [],
  });
  const [activeDmFriendId, setActiveDmFriendId] = useState<string | null>(null);
  const [unreadDmByFriendId, setUnreadDmByFriendId] = useState<Record<string, number>>({});
  const [lastDmAtByFriendId, setLastDmAtByFriendId] = useState<Record<string, string>>({});
  const [pingsByServerId, setPingsByServerId] = useState<Record<string, number>>({});
  const [pingsByChannelId, setPingsByChannelId] = useState<Record<string, number>>({});
  const [unreadServerIds, setUnreadServerIds] = useState<string[]>([]);
  const [dmPopupFriendIds, setDmPopupFriendIds] = useState<string[]>([]);
  const [dmSendersById, setDmSendersById] = useState<Record<string, User>>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Modals & Invite Handling
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isNewServerOpen, setIsNewServerOpen] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('invite') || '').trim();
    } catch {
      return '';
    }
  });
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [sharePostTarget, setSharePostTarget] = useState<Post | null>(null);
  const [forwardMessageTarget, setForwardMessageTarget] = useState<ChatMessage | null>(null);

  // Live Streaming State
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState<Record<string, MediaStream>>({});
  const [streamingUsersMap, setStreamingUsersMap] = useState<Record<string, { isStreaming: boolean; streamTitle?: string }>>({});
  const [liveModalConfig, setLiveModalConfig] = useState<{
    isOpen: boolean;
    defaultSource: 'camera' | 'screen';
    contextLabel: string;
    allowFeedAnnouncement: boolean;
  }>({
    isOpen: false,
    defaultSource: 'camera',
    contextLabel: 'Profile Live Stream',
    allowFeedAnnouncement: true,
  });

  // Live Refs for WS, Voice Engine, and Notification rules
  const wsRef = useRef<WebSocket | null>(null);
  const userRef = useRef<User | null>(user);
  const preferencesRef = useRef<UserPreferences>(preferences);
  const activeVoiceRef = useRef<ActiveVoiceInfo | null>(activeVoice);
  const serversRef = useRef(servers);
  const activeViewRef = useRef<AppView>(activeView);
  const activeDmFriendIdRef = useRef<string | null>(activeDmFriendId);
  const selectedServerIdRef = useRef<string | null>(selectedServerId);
  const selectedChannelIdRef = useRef<string | null>(selectedChannelId);
  const voiceParticipantsRef = useRef<Record<string, VoiceParticipant[]>>(voiceParticipantsByServer);
  const serverSearchRef = useRef(serverSearch);
  const friendsDataRef = useRef(friendsData);
  const dismissedDmPopupsRef = useRef<Record<string, number>>({});
  const reminderTimersRef = useRef<number[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSendersByPeerRef = useRef<Map<string, RTCRtpSender[]>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    localVideoStreamRef.current = localVideoStream;
  }, [localVideoStream]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    activeVoiceRef.current = activeVoice;
  }, [activeVoice]);
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);
  useEffect(() => {
    activeDmFriendIdRef.current = activeDmFriendId;
  }, [activeDmFriendId]);
  useEffect(() => {
    selectedServerIdRef.current = selectedServerId;
  }, [selectedServerId]);
  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId;
  }, [selectedChannelId]);
  useEffect(() => {
    voiceParticipantsRef.current = voiceParticipantsByServer;
  }, [voiceParticipantsByServer]);
  useEffect(() => {
    serverSearchRef.current = serverSearch;
  }, [serverSearch]);
  useEffect(() => {
    friendsDataRef.current = friendsData;
  }, [friendsData]);

  // Open invite modal automatically once authenticated if ?invite=CODE was visited
  useEffect(() => {
    if (!user || !pendingInviteCode) return;
    setIsNewServerOpen(true);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('invite')) {
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    } catch {
      // ignore history errors
    }
  }, [user, pendingInviteCode]);

  // Ensure selectedChannelId stays valid whenever selectedServerId changes
  useEffect(() => {
    if (!selectedServerId) {
      setSelectedChannelId(null);
      return;
    }
    const srv = servers.find((s) => s.id === selectedServerId);
    if (!srv) return;
    const textChannels = srv.channels.filter((c) => c.type !== 'voice');
    const exists = srv.channels.some((c) => c.id === selectedChannelId);
    if (!selectedChannelId || !exists) {
      setSelectedChannelId(textChannels[0]?.id || srv.channels[0]?.id || null);
    }
  }, [selectedServerId, servers, selectedChannelId]);

  const showToast = useCallback((_msg: string) => {
    // Floating pill toast notifications disabled
  }, []);

  const sendWs = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications((prev) => [
      {
        ...notif,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const clearDmUnread = useCallback((friendId: string) => {
    delete dismissedDmPopupsRef.current[friendId];
    setUnreadDmByFriendId((prev) => {
      if (!prev[friendId]) return prev;
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
    api.markDmRead(friendId).catch(() => {});
  }, []);

  const clearChannelPings = useCallback((serverId: string, channelId: string) => {
    setPingsByChannelId((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      const srv = serversRef.current.find((s) => s.id === serverId);
      if (srv) {
        const remaining = srv.channels.reduce((sum, ch) => sum + (next[ch.id] || 0), 0);
        setPingsByServerId((srvPrev) => {
          const srvNext = { ...srvPrev };
          if (remaining > 0) srvNext[serverId] = remaining;
          else delete srvNext[serverId];
          return srvNext;
        });
      }
      return next;
    });
    api.markChannelRead(serverId, channelId).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || activeView !== 'server' || !selectedServerId || !selectedChannelId) return;
    const srv = serversRef.current.find((s) => s.id === selectedServerId);
    const ch = srv?.channels.find((c) => c.id === selectedChannelId);
    if (ch && ch.type !== 'voice') {
      clearChannelPings(selectedServerId, selectedChannelId);
    }
  }, [user?.id, activeView, selectedServerId, selectedChannelId, clearChannelPings]);

  const touchDmTimestamp = useCallback((friendId: string, timestamp?: string) => {
    const ts = timestamp || new Date().toISOString();
    setLastDmAtByFriendId((prev) => {
      const existing = prev[friendId];
      if (existing && new Date(existing).getTime() >= new Date(ts).getTime()) return prev;
      return { ...prev, [friendId]: ts };
    });
  }, []);

  // Status-driven incoming message & inbox notification handler
  const dispatchIncomingNotification = useCallback(
    (msg: ChatMessage) => {
      const me = userRef.current;
      if (!me || msg.authorId === me.id) return;

      const preview =
        msg.content ||
        (msg.attachmentType === 'audio'
          ? 'Sent a voice message'
          : msg.attachmentType === 'video'
          ? 'Sent a video'
          : msg.attachmentType === 'image'
          ? 'Sent an image'
          : 'Sent a message');

      const isDm = Boolean(msg.dmKey);
      const isViewingThisDm =
        isDm && activeViewRef.current === 'friends' && activeDmFriendIdRef.current === msg.authorId;
      const isViewingThisChannel =
        !isDm &&
        activeViewRef.current === 'server' &&
        selectedServerIdRef.current === msg.serverId &&
        selectedChannelIdRef.current === msg.channelId;

      if (isDm) {
        touchDmTimestamp(msg.authorId, msg.createdAt);
        setDmSendersById((prev) => ({
          ...prev,
          [msg.authorId]: {
            ...(prev[msg.authorId] || {}),
            id: msg.authorId,
            name: msg.authorName,
            tag: msg.authorTag,
            avatarUrl: msg.authorAvatar,
            status: prev[msg.authorId]?.status || 'online',
            isStreaming:
              prev[msg.authorId]?.isStreaming ?? Boolean(streamingUsersMap[msg.authorId]?.isStreaming),
            createdAt: prev[msg.authorId]?.createdAt || msg.createdAt,
          },
        }));

        if (!isViewingThisDm) {
          delete dismissedDmPopupsRef.current[msg.authorId];
          setUnreadDmByFriendId((prev) => ({
            ...prev,
            [msg.authorId]: (prev[msg.authorId] || 0) + 1,
          }));
          setDmPopupFriendIds((prev) => [msg.authorId, ...prev.filter((id) => id !== msg.authorId)].slice(0, 8));
          addNotification({
            kind: 'dm',
            title: `DM from ${msg.authorName}`,
            body: preview,
            avatarUrl: msg.authorAvatar,
            friendId: msg.authorId,
            messageId: msg.id,
          });
        } else {
          api.markDmRead(msg.authorId).catch(() => {});
        }
      } else if (!isViewingThisChannel) {
        const srv = serversRef.current.find((s) => s.id === msg.serverId);
        const ch = srv?.channels.find((c) => c.id === msg.channelId);
        const isPing = isMessagePingForUser(msg, me);

        if (msg.serverId) {
          const sid = msg.serverId;
          setUnreadServerIds((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
        }

        if (isPing && msg.serverId && msg.channelId) {
          const cid = msg.channelId;
          const sid = msg.serverId;
          setPingsByChannelId((prev) => ({
            ...prev,
            [cid]: (prev[cid] || 0) + 1,
          }));
          setPingsByServerId((prev) => ({
            ...prev,
            [sid]: (prev[sid] || 0) + 1,
          }));
          addNotification({
            kind: 'mention',
            title: `Ping from ${msg.authorName}${ch ? ` in #${ch.name}` : ''}`,
            body: preview,
            avatarUrl: msg.authorAvatar,
            serverId: msg.serverId,
            channelId: msg.channelId,
            messageId: msg.id,
          });
        } else {
          addNotification({
            kind: 'server_message',
            title: `${msg.authorName}${ch ? ` in #${ch.name}` : ''}`,
            body: preview,
            avatarUrl: msg.authorAvatar,
            serverId: msg.serverId,
            channelId: msg.channelId,
            messageId: msg.id,
          });
        }
      } else if (msg.serverId && msg.channelId) {
        api.markChannelRead(msg.serverId, msg.channelId).catch(() => {});
      }

      const status: UserStatus = me.status || 'online';
      // Do Not Disturb & Invisible suppress desktop popups & notification sounds
      if (status === 'dnd' || status === 'invisible') {
        return;
      }

      if (!isViewingThisDm && !isViewingThisChannel) {
        showToast(`${msg.authorName}: ${preview}`);
      }

      if (status === 'online') {
        if (preferencesRef.current.notificationSound && !isViewingThisDm && !isViewingThisChannel) {
          playNotificationChime();
        }
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          try {
            new Notification(`ArkLine · ${msg.authorName}`, {
              body: preview,
            });
          } catch {
            // Ignore browser Notification restrictions
          }
        }
      }
    },
    [showToast, addNotification, touchDmTimestamp]
  );

  // Voice Media Cleanup
  const cleanupVoiceMedia = useCallback(() => {
    if (vadIntervalRef.current) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();
    videoSendersByPeerRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setRemoteVideoStreams({});
    for (const el of remoteAudioElsRef.current.values()) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    remoteAudioElsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      cleanupVoiceMedia();
      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      reminderTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, [cleanupVoiceMedia]);

  // Keep output volume & deafened state synced across remote audio streams
  useEffect(() => {
    const vol = activeVoice?.deafened ? 0 : preferences.voice.outputVolume / 100;
    for (const el of remoteAudioElsRef.current.values()) {
      el.volume = Math.max(0, Math.min(1, vol));
      el.muted = Boolean(activeVoice?.deafened);
    }
  }, [activeVoice?.deafened, preferences.voice.outputVolume]);

  // Keep local mic track enabled state synced with mute & PTT/VAD mode
  const syncMicTransmission = useCallback(
    (voiceInfo: ActiveVoiceInfo | null) => {
      if (!voiceInfo) return;
      const mode = preferencesRef.current.voice.inputMode;
      const canTransmit = !voiceInfo.muted && (mode === 'vad' || voiceInfo.pttActive);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = canTransmit;
        });
      }
      sendWs({
        type: 'voice:state',
        muted: voiceInfo.muted,
        deafened: voiceInfo.deafened,
        speaking: voiceInfo.speaking,
        isStreaming: Boolean(voiceInfo.isStreaming),
        streamTitle: voiceInfo.streamTitle || '',
      });

      const me = userRef.current;
      if (me) {
        const token = getStoredToken();
        if (token?.startsWith('local_token:')) {
          localFallback.updateLocalVoiceState(me.id, {
            muted: voiceInfo.muted,
            deafened: voiceInfo.deafened,
            speaking: voiceInfo.speaking,
            isStreaming: Boolean(voiceInfo.isStreaming),
            streamTitle: voiceInfo.streamTitle || '',
          });
        }
        setVoiceParticipantsByServer((prev) => {
          const list = prev[voiceInfo.serverId] || [];
          if (!list.some((p) => p.userId === me.id)) return prev;
          return {
            ...prev,
            [voiceInfo.serverId]: list.map((p) =>
              p.userId === me.id
                ? {
                    ...p,
                    muted: voiceInfo.muted,
                    deafened: voiceInfo.deafened,
                    speaking: voiceInfo.speaking,
                    isStreaming: Boolean(voiceInfo.isStreaming),
                    streamTitle: voiceInfo.streamTitle || '',
                  }
                : p
            ),
          };
        });
      }
    },
    [sendWs]
  );

  // Create/get WebRTC PeerConnection for a peer in the same voice channel
  const getOrCreatePeerConnection = useCallback(
    (peerUserId: string, channelId: string) => {
      const existing = peerConnectionsRef.current.get(peerUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      if (localVideoStreamRef.current) {
        const senders: RTCRtpSender[] = [];
        localVideoStreamRef.current.getTracks().forEach((track) => {
          senders.push(pc.addTrack(track, localVideoStreamRef.current!));
        });
        videoSendersByPeerRef.current.set(peerUserId, senders);
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWs({
            type: 'voice:signal',
            targetUserId: peerUserId,
            channelId,
            signal: { candidate: ev.candidate },
          });
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        if (ev.track.kind === 'video') {
          setRemoteVideoStreams((prev) => ({
            ...prev,
            [peerUserId]: stream,
          }));
          ev.track.onended = () => {
            setRemoteVideoStreams((prev) => {
              const next = { ...prev };
              delete next[peerUserId];
              return next;
            });
          };
          return;
        }

        let audioEl = remoteAudioElsRef.current.get(peerUserId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          remoteAudioElsRef.current.set(peerUserId, audioEl);
        }
        audioEl.srcObject = stream;
        const voiceState = activeVoiceRef.current;
        audioEl.muted = Boolean(voiceState?.deafened);
        audioEl.volume = voiceState?.deafened
          ? 0
          : Math.max(0, Math.min(1, preferencesRef.current.voice.outputVolume / 100));
        audioEl.play().catch(() => {});
      };

      peerConnectionsRef.current.set(peerUserId, pc);
      return pc;
    },
    [sendWs]
  );

  // Apply & persist appearance preferences (Dark Mode, Letter Sizing, Spaces)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', preferences.theme === 'dark');

    const fontSizeMap: Record<UserPreferences['fontSize'], string> = {
      compact: '14px',
      standard: '16px',
      large: '18px',
      xlarge: '20px',
    };
    root.style.fontSize = fontSizeMap[preferences.fontSize];

    const letterSpacingMap: Record<UserPreferences['letterSpacing'], string> = {
      tight: '-0.015em',
      normal: '0em',
      relaxed: '0.02em',
      wide: '0.05em',
    };
    root.style.setProperty('--pilgrim-letter-spacing', letterSpacingMap[preferences.letterSpacing]);
    root.setAttribute('data-spacing', preferences.contentSpacing);

    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota issues
    }
  }, [preferences]);

  // Verify existing auth session
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    api
      .getMe()
      .then((res) => setUser(res.user))
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  const loadServers = useCallback(async (q = '') => {
    const res = await api.getServers(q);
    setServers(res.servers);
  }, []);

  const loadPosts = useCallback(async () => {
    const res = await api.getPosts({ scope: 'feed' });
    setPosts(res.posts);
  }, []);

  const loadFriends = useCallback(async () => {
    const res = await api.getFriends();
    setFriendsData(res);
  }, []);

  const loadNotificationSummary = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const summary = await api.getNotificationSummary();
      const viewingDmId =
        activeViewRef.current === 'friends' ? activeDmFriendIdRef.current : null;
      const viewingChId =
        activeViewRef.current === 'server' ? selectedChannelIdRef.current : null;

      setLastDmAtByFriendId((prev) => {
        const merged = { ...prev };
        for (const [fid, ts] of Object.entries(summary.lastDmAtByFriendId || {})) {
          if (!merged[fid] || new Date(ts).getTime() > new Date(merged[fid]).getTime()) {
            merged[fid] = ts;
          }
        }
        return merged;
      });

      if (summary.dmSenders?.length) {
        setDmSendersById((prev) => {
          const next = { ...prev };
          for (const sender of summary.dmSenders) {
            next[sender.id] = { ...(next[sender.id] || {}), ...sender };
          }
          return next;
        });
      }

      const nextUnreadDm = { ...(summary.unreadDmByFriendId || {}) };
      if (viewingDmId && nextUnreadDm[viewingDmId]) {
        delete nextUnreadDm[viewingDmId];
        api.markDmRead(viewingDmId).catch(() => {});
      }
      setUnreadDmByFriendId(nextUnreadDm);

      const nextChPings = { ...(summary.pingsByChannelId || {}) };
      if (viewingChId && nextChPings[viewingChId]) {
        delete nextChPings[viewingChId];
        if (selectedServerIdRef.current) {
          api.markChannelRead(selectedServerIdRef.current, viewingChId).catch(() => {});
        }
      }
      setPingsByChannelId(nextChPings);

      const nextSrvPings: Record<string, number> = {};
      for (const srv of serversRef.current) {
        const sum = srv.channels.reduce((acc, ch) => acc + (nextChPings[ch.id] || 0), 0);
        if (sum > 0) nextSrvPings[srv.id] = sum;
      }
      for (const [sid, cnt] of Object.entries(summary.pingsByServerId || {})) {
        if (!serversRef.current.some((s) => s.id === sid) && cnt > 0) {
          nextSrvPings[sid] = cnt;
        }
      }
      setPingsByServerId(nextSrvPings);
      setUnreadServerIds(summary.unreadServerIds || []);

      const activePopupIds = Object.entries(nextUnreadDm)
        .filter(([fid, count]) => count > 0 && count > (dismissedDmPopupsRef.current[fid] || 0))
        .sort((a, b) => {
          const ta = Date.parse(summary.lastDmAtByFriendId?.[a[0]] || '') || 0;
          const tb = Date.parse(summary.lastDmAtByFriendId?.[b[0]] || '') || 0;
          return tb - ta;
        })
        .map(([fid]) => fid);

      if (activePopupIds.length > 0) {
        setDmPopupFriendIds((prev) =>
          Array.from(new Set([...activePopupIds, ...prev]))
            .filter((fid) => fid !== viewingDmId)
            .slice(0, 8)
        );
      }
    } catch {
      // Ignore transient summary errors
    }
  }, []);

  // Initial Data Load when signed in + periodic notification summary sync
  useEffect(() => {
    if (!user) return;
    loadServers(serverSearch);
    loadPosts();
    loadFriends();
    loadNotificationSummary();
    const timer = window.setInterval(loadNotificationSummary, 5000);
    return () => window.clearInterval(timer);
  }, [user?.id, loadNotificationSummary]);

  // Live server search
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      loadServers(serverSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [serverSearch, user?.id, loadServers]);

  // Handle voice participants update (peer join/leave SFX, cleanup disconnected peers, and WebRTC offer initiation)
  const handleVoiceParticipantsSync = useCallback(
    async (serverId: string, participants: VoiceParticipant[]) => {
      const prevServerList = voiceParticipantsRef.current[serverId] || [];
      const currentVoice = activeVoiceRef.current;
      const me = userRef.current;

      if (currentVoice && me && currentVoice.serverId === serverId) {
        const prevRoomPeers = new Set(
          prevServerList
            .filter((p) => p.channelId === currentVoice.channelId && p.userId !== me.id)
            .map((p) => p.userId)
        );
        const nextRoomPeers = participants.filter(
          (p) => p.channelId === currentVoice.channelId && p.userId !== me.id
        );
        const nextRoomIds = new Set(nextRoomPeers.map((p) => p.userId));

        for (const nextPeer of nextRoomPeers) {
          if (!prevRoomPeers.has(nextPeer.userId)) {
            if (!currentVoice.deafened) playVcPeerJoinSound();
            break;
          }
        }
        for (const prevPeerId of prevRoomPeers) {
          if (!nextRoomIds.has(prevPeerId)) {
            if (!currentVoice.deafened) playVcPeerLeaveSound();
            const pc = peerConnectionsRef.current.get(prevPeerId);
            if (pc) {
              pc.close();
              peerConnectionsRef.current.delete(prevPeerId);
            }
            videoSendersByPeerRef.current.delete(prevPeerId);
            pendingIceCandidatesRef.current.delete(prevPeerId);
            setRemoteVideoStreams((prev) => {
              if (!prev[prevPeerId]) return prev;
              const next = { ...prev };
              delete next[prevPeerId];
              return next;
            });
            const el = remoteAudioElsRef.current.get(prevPeerId);
            if (el) {
              el.pause();
              el.srcObject = null;
              el.remove();
              remoteAudioElsRef.current.delete(prevPeerId);
            }
          }
        }

        for (const peer of nextRoomPeers) {
          if (!peerConnectionsRef.current.has(peer.userId) && me.id < peer.userId) {
            const pc = getOrCreatePeerConnection(peer.userId, currentVoice.channelId);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendWs({
                type: 'voice:signal',
                targetUserId: peer.userId,
                channelId: currentVoice.channelId,
                signal: { sdp: pc.localDescription },
              });
            } catch {
              // Ignore signaling race
            }
          }
        }
      }

      setVoiceParticipantsByServer((prev) => ({
        ...prev,
        [serverId]: participants,
      }));
    },
    [getOrCreatePeerConnection, sendWs]
  );

  // Poll voice participants reliably for active server & active voice connection
  useEffect(() => {
    if (!user) return;
    const targetIds = Array.from(
      new Set([selectedServerId, activeVoice?.serverId].filter(Boolean) as string[])
    );
    if (targetIds.length === 0) return;

    const fetchAll = () => {
      targetIds.forEach((sid) => {
        api
          .getVoiceParticipants(sid)
          .then((res) => {
            handleVoiceParticipantsSync(sid, res.participants || []);
          })
          .catch(() => {});
      });
    };

    fetchAll();
    const interval = window.setInterval(fetchAll, 3000);
    return () => window.clearInterval(interval);
  }, [user?.id, selectedServerId, activeVoice?.serverId, handleVoiceParticipantsSync]);

  // Local multi-tab BroadcastChannel sync for fallback mode
  const dispatchIncomingNotificationRef = useRef(dispatchIncomingNotification);
  const addNotificationRef = useRef(addNotification);
  const loadServersRef = useRef(loadServers);
  const loadPostsRef = useRef(loadPosts);
  const handleVoiceParticipantsSyncRef = useRef(handleVoiceParticipantsSync);
  const getOrCreatePeerConnectionRef = useRef(getOrCreatePeerConnection);

  useEffect(() => {
    dispatchIncomingNotificationRef.current = dispatchIncomingNotification;
    addNotificationRef.current = addNotification;
    loadServersRef.current = loadServers;
    loadPostsRef.current = loadPosts;
    handleVoiceParticipantsSyncRef.current = handleVoiceParticipantsSync;
    getOrCreatePeerConnectionRef.current = getOrCreatePeerConnection;
  }, [
    dispatchIncomingNotification,
    addNotification,
    loadServers,
    loadPosts,
    handleVoiceParticipantsSync,
    getOrCreatePeerConnection,
  ]);

  useEffect(() => {
    if (!user || typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel('pilgrim_realtime_sync');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'voice:sync' && Array.isArray(ev.data.participants)) {
        const list: VoiceParticipant[] = ev.data.participants;
        const grouped: Record<string, VoiceParticipant[]> = {};
        for (const p of list) {
          if (!grouped[p.serverId]) grouped[p.serverId] = [];
          grouped[p.serverId].push(p);
        }
        const checkIds = new Set([
          ...Object.keys(voiceParticipantsRef.current),
          ...Object.keys(grouped),
        ]);
        checkIds.forEach((sid) => {
          handleVoiceParticipantsSyncRef.current(sid, grouped[sid] || []);
        });
      } else if (ev.data?.type === 'chat:message' && ev.data.message) {
        const msg: ChatMessage = ev.data.message;
        const me = userRef.current;
        if (!me || msg.authorId === me.id) return;
        if (msg.dmKey && !msg.dmKey.split('__').includes(me.id)) return;
        setIncomingWsMessage(msg);
        dispatchIncomingNotificationRef.current(msg);
      }
    };
    return () => bc.close();
  }, [user?.id]);

  // WebSocket Connection for Real-Time Chat, Presence, and Voice Channels
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    if (!token || token.startsWith('local_token:')) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const currentVoice = activeVoiceRef.current;
      if (currentVoice) {
        ws.send(
          JSON.stringify({
            type: 'voice:join',
            serverId: currentVoice.serverId,
            channelId: currentVoice.channelId,
            muted: currentVoice.muted,
            deafened: currentVoice.deafened,
          })
        );
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence:update') {
          setOnlineUserIds(data.onlineUserIds || []);
        } else if (data.type === 'presence:status' && data.userId) {
          setFriendsData((prev) => ({
            ...prev,
            friends: prev.friends.map((f) =>
              f.id === data.userId ? { ...f, status: data.status } : f
            ),
          }));
        } else if (data.type === 'presence:stream' && data.userId) {
          setStreamingUsersMap((prev) => ({
            ...prev,
            [data.userId]: {
              isStreaming: Boolean(data.isStreaming),
              streamTitle: data.streamTitle || '',
            },
          }));
          setFriendsData((prev) => ({
            ...prev,
            friends: prev.friends.map((f) =>
              f.id === data.userId
                ? { ...f, isStreaming: Boolean(data.isStreaming), streamTitle: data.streamTitle || '' }
                : f
            ),
          }));
          setViewedProfile((prev) =>
            prev && prev.user.id === data.userId
              ? {
                  ...prev,
                  user: {
                    ...prev.user,
                    isStreaming: Boolean(data.isStreaming),
                    streamTitle: data.streamTitle || '',
                  },
                }
              : prev
          );
          if (!data.isStreaming) {
            setRemoteVideoStreams((prev) => {
              if (!prev[data.userId]) return prev;
              const next = { ...prev };
              delete next[data.userId];
              return next;
            });
          }
        } else if (data.type === 'chat:message' && data.message) {
          setIncomingWsMessage(data.message);
          dispatchIncomingNotificationRef.current(data.message);
        } else if (data.type === 'chat:message_updated' && data.message) {
          setIncomingWsUpdatedMessage(data.message);
        } else if (data.type === 'chat:reaction_added' && data.message) {
          const me = userRef.current;
          if (me && data.actorId && data.actorId !== me.id) {
            const msg: ChatMessage = data.message;
            addNotificationRef.current({
              kind: 'reaction',
              title: `${data.actorName || 'Someone'} reacted ${data.emoji || ''}`,
              body: msg.content || (msg.attachmentType ? `[${msg.attachmentType}]` : 'Message'),
              avatarUrl: data.actorAvatar,
              serverId: msg.serverId,
              channelId: msg.channelId,
              friendId: msg.dmKey ? data.actorId : undefined,
              messageId: msg.id,
            });
          }
        } else if (data.type === 'chat:message_deleted' && data.messageId) {
          setIncomingWsDeletedMessageId(data.messageId);
        } else if (
          data.type === 'server:created' ||
          data.type === 'server:channel_created' ||
          data.type === 'server:updated'
        ) {
          loadServersRef.current(serverSearchRef.current);
        } else if (data.type === 'friend:update') {
          const prevReqIds = new Set(friendsDataRef.current.incomingRequests.map((r) => r.id));
          api
            .getFriends()
            .then((res) => {
              setFriendsData(res);
              for (const req of res.incomingRequests) {
                if (!prevReqIds.has(req.id)) {
                  addNotificationRef.current({
                    kind: 'friend_request',
                    title: `Friend request from ${req.user.name}`,
                    body: req.user.tag,
                    avatarUrl: req.user.avatarUrl,
                    friendId: req.user.id,
                  });
                }
              }
            })
            .catch(() => {});
          loadPostsRef.current();
        } else if (data.type === 'voice:participants' && data.serverId) {
          await handleVoiceParticipantsSyncRef.current(data.serverId, data.participants || []);
        } else if (data.type === 'voice:signal' && data.fromUserId && data.signal) {
          const currentVoice = activeVoiceRef.current;
          if (!currentVoice || currentVoice.channelId !== data.channelId) return;
          const pc = getOrCreatePeerConnectionRef.current(data.fromUserId, data.channelId);
          try {
            if (data.signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
              const queued = pendingIceCandidatesRef.current.get(data.fromUserId) || [];
              if (queued.length > 0) {
                pendingIceCandidatesRef.current.delete(data.fromUserId);
                for (const cand of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
              }
              if (data.signal.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendWs({
                  type: 'voice:signal',
                  targetUserId: data.fromUserId,
                  channelId: data.channelId,
                  signal: { sdp: pc.localDescription },
                });
              }
            } else if (data.signal.candidate) {
              if (!pc.remoteDescription) {
                const q = pendingIceCandidatesRef.current.get(data.fromUserId) || [];
                q.push(data.signal.candidate);
                pendingIceCandidatesRef.current.set(data.fromUserId, q);
              } else {
                await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
              }
            }
          } catch {
            // Ignore transient ICE errors
          }
        }
      } catch {
        // Ignore malformed packets
      }
    };

    return () => {
      if (wsRef.current === ws) wsRef.current = null;
      ws.close();
    };
  }, [user?.id, sendWs]);

  // Desktop Push-to-Talk Keyboard Listener
  const handlePttHoldStart = useCallback(() => {
    const current = activeVoiceRef.current;
    const me = userRef.current;
    if (!current || !me || preferencesRef.current.voice.inputMode !== 'ptt') return;
    const srv = serversRef.current.find((s) => s.id === current.serverId);
    if (srv && !hasServerPermission(srv, me.id, 'speakVoice')) return;
    if (current.pttActive) return;

    const next: ActiveVoiceInfo = {
      ...current,
      pttActive: true,
      speaking: !current.muted,
    };
    setActiveVoice(next);
    syncMicTransmission(next);
  }, [syncMicTransmission]);

  const handlePttHoldEnd = useCallback(() => {
    const current = activeVoiceRef.current;
    if (!current || !current.pttActive) return;
    const next: ActiveVoiceInfo = {
      ...current,
      pttActive: false,
      speaking: false,
    };
    setActiveVoice(next);
    syncMicTransmission(next);
  }, [syncMicTransmission]);

  useEffect(() => {
    const isTypingInInput = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!activeVoiceRef.current || preferencesRef.current.voice.inputMode !== 'ptt') return;
      if (isTypingInInput(e.target)) return;
      if (e.code === preferencesRef.current.voice.pttKey) {
        e.preventDefault();
        handlePttHoldStart();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!activeVoiceRef.current) return;
      if (e.code === preferencesRef.current.voice.pttKey) {
        handlePttHoldEnd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', handlePttHoldEnd);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', handlePttHoldEnd);
    };
  }, [handlePttHoldStart, handlePttHoldEnd]);

  const handleJoinVoiceChannel = async (server: Server, channel: Channel) => {
    if (!user) return;
    if (!hasServerPermission(server, user.id, 'connectVoice')) {
      showToast('Your server role does not allow joining voice channels.');
      return;
    }

    const canSpeak = hasServerPermission(server, user.id, 'speakVoice');
    cleanupVoiceMedia();
    playVcJoinSound();

    const isAlreadyStreaming = Boolean(localVideoStreamRef.current);
    const activeTitle = user.streamTitle || '';

    const nextVoice: ActiveVoiceInfo = {
      serverId: server.id,
      serverName: server.name,
      channelId: channel.id,
      channelName: channel.name,
      muted: !canSpeak,
      deafened: false,
      speaking: false,
      pttActive: false,
      isStreaming: isAlreadyStreaming,
      streamTitle: activeTitle,
    };
    setActiveVoice(nextVoice);

    // Try capturing microphone with user's configured audio filters
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const vs = preferencesRef.current.voice;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: vs.inputDeviceId ? { exact: vs.inputDeviceId } : undefined,
            noiseSuppression: vs.noiseSuppression,
            echoCancellation: vs.echoCancellation,
          },
        });
        localStreamRef.current = stream;

        const initialTransmit = !nextVoice.muted && vs.inputMode === 'vad';
        stream.getAudioTracks().forEach((t) => {
          t.enabled = initialTransmit;
        });

        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          vadIntervalRef.current = window.setInterval(() => {
            const cur = activeVoiceRef.current;
            if (!cur) return;
            const mode = preferencesRef.current.voice.inputMode;
            if (mode !== 'vad' || cur.muted) return;

            analyser.getByteFrequencyData(dataArr);
            let sum = 0;
            for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
            const avg = sum / dataArr.length;
            const threshold = Math.max(4, (100 - preferencesRef.current.voice.sensitivity) * 0.45);
            const isSpeaking = avg > threshold;

            if (isSpeaking !== cur.speaking) {
              const updated = { ...cur, speaking: isSpeaking };
              setActiveVoice(updated);
              syncMicTransmission(updated);
            }
          }, 160);
        }
      }
    } catch {
      showToast('Joined voice in listen-only mode (no microphone access).');
    }

    const participantEntry: VoiceParticipant = {
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatarUrl,
      serverId: server.id,
      channelId: channel.id,
      muted: nextVoice.muted,
      deafened: false,
      speaking: false,
      isStreaming: isAlreadyStreaming,
      streamTitle: activeTitle,
    };

    const token = getStoredToken();
    if (token?.startsWith('local_token:')) {
      localFallback.joinLocalVoice(participantEntry);
    }

    // Optimistic local participant entry
    setVoiceParticipantsByServer((prev) => {
      const cleaned: Record<string, VoiceParticipant[]> = {};
      for (const [sid, list] of Object.entries(prev)) {
        cleaned[sid] = list.filter((p) => p.userId !== user.id);
      }
      const existing = cleaned[server.id] || [];
      cleaned[server.id] = [...existing, participantEntry];
      return cleaned;
    });

    sendWs({
      type: 'voice:join',
      serverId: server.id,
      channelId: channel.id,
      muted: nextVoice.muted,
      deafened: false,
      isStreaming: isAlreadyStreaming,
      streamTitle: activeTitle,
    });
    api
      .getVoiceParticipants(server.id)
      .then((res) => {
        if (res.participants?.length) {
          handleVoiceParticipantsSync(server.id, res.participants);
        }
      })
      .catch(() => {});
    showToast(`Joined voice channel: ${channel.name}`);
  };

  const handleLeaveVoice = useCallback(() => {
    const wasInVoice = Boolean(activeVoiceRef.current);
    const me = userRef.current;
    sendWs({ type: 'voice:leave' });
    cleanupVoiceMedia();
    setActiveVoice(null);
    if (wasInVoice) {
      playVcLeaveSound();
      showToast('Disconnected from voice channel.');
    }
    if (me) {
      const token = getStoredToken();
      if (token?.startsWith('local_token:')) {
        localFallback.leaveLocalVoice(me.id);
      }
      setVoiceParticipantsByServer((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [sid, list] of Object.entries(prev)) {
          next[sid] = list.filter((p) => p.userId !== me.id);
        }
        return next;
      });
    }
  }, [cleanupVoiceMedia, sendWs, showToast]);

  const handleStopLiveStream = useCallback(async () => {
    const stream = localVideoStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      localVideoStreamRef.current = null;
    }
    setLocalVideoStream(null);

    const currentVoice = activeVoiceRef.current;
    for (const [peerUserId, pc] of peerConnectionsRef.current.entries()) {
      const senders = videoSendersByPeerRef.current.get(peerUserId) || [];
      for (const s of senders) {
        try {
          pc.removeTrack(s);
        } catch {
          // ignore
        }
      }
      videoSendersByPeerRef.current.delete(peerUserId);
      if (currentVoice && senders.length > 0) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWs({
            type: 'voice:signal',
            targetUserId: peerUserId,
            channelId: currentVoice.channelId,
            signal: { sdp: pc.localDescription },
          });
        } catch {
          // ignore
        }
      }
    }

    if (currentVoice) {
      const nextVoice: ActiveVoiceInfo = { ...currentVoice, isStreaming: false, streamTitle: '' };
      setActiveVoice(nextVoice);
      syncMicTransmission(nextVoice);
    }

    try {
      const res = await api.updateStreamStatus(false, '');
      setUser(res.user);
      setViewedProfile((prev) =>
        prev && prev.user.id === res.user.id ? { ...prev, user: res.user } : prev
      );
    } catch {
      setUser((prev) => (prev ? { ...prev, isStreaming: false, streamTitle: '' } : prev));
    }

    const me = userRef.current;
    if (me) {
      setStreamingUsersMap((prev) => ({
        ...prev,
        [me.id]: { isStreaming: false, streamTitle: '' },
      }));
    }
    showToast('Live stream ended.');
  }, [sendWs, showToast, syncMicTransmission]);

  const handleStartLiveStream = useCallback(
    async (options: {
      source: 'camera' | 'screen';
      title: string;
      announceToFeed?: boolean;
      announceVisibility?: Visibility;
    }) => {
      if (!navigator.mediaDevices) {
        throw new Error('Media streaming is not supported in this browser.');
      }

      if (localVideoStreamRef.current) {
        localVideoStreamRef.current.getTracks().forEach((t) => {
          t.onended = null;
          t.stop();
        });
      }

      let stream: MediaStream;
      if (options.source === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing is not supported in this browser.');
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: !activeVoiceRef.current,
        });
      }

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          handleStopLiveStream();
        };
      }

      localVideoStreamRef.current = stream;
      setLocalVideoStream(stream);

      const currentVoice = activeVoiceRef.current;
      for (const [peerUserId, pc] of peerConnectionsRef.current.entries()) {
        const prevSenders = videoSendersByPeerRef.current.get(peerUserId) || [];
        for (const s of prevSenders) {
          try {
            pc.removeTrack(s);
          } catch {
            // ignore
          }
        }
        const nextSenders: RTCRtpSender[] = [];
        stream.getTracks().forEach((t) => {
          nextSenders.push(pc.addTrack(t, stream));
        });
        videoSendersByPeerRef.current.set(peerUserId, nextSenders);

        if (currentVoice) {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendWs({
              type: 'voice:signal',
              targetUserId: peerUserId,
              channelId: currentVoice.channelId,
              signal: { sdp: pc.localDescription },
            });
          } catch {
            // ignore
          }
        }
      }

      if (currentVoice) {
        const nextVoice: ActiveVoiceInfo = {
          ...currentVoice,
          isStreaming: true,
          streamTitle: options.title,
        };
        setActiveVoice(nextVoice);
        syncMicTransmission(nextVoice);
      }

      const res = await api.updateStreamStatus(true, options.title);
      setUser(res.user);
      setViewedProfile((prev) =>
        prev && prev.user.id === res.user.id ? { ...prev, user: res.user } : prev
      );
      setStreamingUsersMap((prev) => ({
        ...prev,
        [res.user.id]: { isStreaming: true, streamTitle: options.title },
      }));

      if (options.announceToFeed) {
        try {
          const postRes = await api.createPost({
            title: `🔴 LIVE NOW: ${options.title}`,
            content: `${res.user.name} started a live stream: "${options.title}". Visit their profile or join them in voice to tune in!`,
            visibility: options.announceVisibility || 'public',
          });
          setPosts((prev) => [postRes.post, ...prev]);
          setProfilePosts((prev) => [postRes.post, ...prev]);
        } catch {
          // optional announcement failure is non-fatal
        }
      }

      showToast(`Live stream started: ${options.title}`);
    },
    [handleStopLiveStream, sendWs, showToast, syncMicTransmission]
  );

  const handleToggleVoiceMute = () => {
    if (!activeVoice || !user) return;
    const srv = servers.find((s) => s.id === activeVoice.serverId);
    if (activeVoice.muted && srv && !hasServerPermission(srv, user.id, 'speakVoice')) {
      showToast('Your role does not allow speaking in voice channels.');
      return;
    }
    const nextMuted = !activeVoice.muted;
    if (nextMuted) playVcMuteSound();
    else playVcUnmuteSound();

    const next: ActiveVoiceInfo = {
      ...activeVoice,
      muted: nextMuted,
      speaking: nextMuted ? false : activeVoice.speaking,
      pttActive: nextMuted ? false : activeVoice.pttActive,
    };
    setActiveVoice(next);
    syncMicTransmission(next);
  };

  const handleToggleVoiceDeafen = () => {
    if (!activeVoice) return;
    const nextDeafened = !activeVoice.deafened;
    if (nextDeafened) playVcDeafenSound();
    else playVcUndeafenSound();

    const next: ActiveVoiceInfo = {
      ...activeVoice,
      deafened: nextDeafened,
      muted: nextDeafened ? true : activeVoice.muted,
      speaking: nextDeafened ? false : activeVoice.speaking,
    };
    setActiveVoice(next);
    syncMicTransmission(next);
  };

  const handleSendInviteDm = async (friendId: string, inviteUrl: string, serverName: string) => {
    const res = await api.sendDirectMessage(friendId, {
      content: `Join me on "${serverName}" in ArkLine! ${inviteUrl}`,
    });
    touchDmTimestamp(friendId, res.message.createdAt);
    showToast('Invite sent via Direct Message!');
  };

  const handleSelectDmPopup = (friendId: string) => {
    setActiveDmFriendId(friendId);
    clearDmUnread(friendId);
    setDmPopupFriendIds((prev) => prev.filter((id) => id !== friendId));
    setActiveView('friends');
  };

  const handleDismissDmPopup = (friendId: string) => {
    dismissedDmPopupsRef.current[friendId] = Math.max(unreadDmByFriendId[friendId] || 1, 1);
    setDmPopupFriendIds((prev) => prev.filter((id) => id !== friendId));
  };

  const handleSelectNotification = (notif: AppNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    if (notif.friendId) {
      handleSelectDmPopup(notif.friendId);
    } else if (notif.serverId) {
      setSelectedServerId(notif.serverId);
      if (notif.channelId) setSelectedChannelId(notif.channelId);
      setActiveView('server');
    } else if (notif.kind === 'friend_request' || notif.kind === 'friend_accept') {
      setActiveView('friends');
    }
  };

  const handleAuthSuccess = (authenticatedUser: User, newSignup = false) => {
    setUser(authenticatedUser);
    setIsNewSignup(newSignup);
    setActiveView('startup');
  };

  const handleSignOut = () => {
    if (localVideoStreamRef.current) {
      handleStopLiveStream();
    }
    handleLeaveVoice();
    api.logout();
    setUser(null);
    setPosts([]);
    setServers([]);
    setSelectedServerId(null);
    setUnreadDmByFriendId({});
    setLastDmAtByFriendId({});
    setPingsByServerId({});
    setPingsByChannelId({});
    setUnreadServerIds([]);
    setDmPopupFriendIds([]);
    setDmSendersById({});
    setNotifications([]);
    dismissedDmPopupsRef.current = {};
    showToast('You have been signed out.');
  };

  const handleChangeStatus = async (status: UserStatus) => {
    try {
      const res = await api.updateStatus(status);
      setUser(res.user);
      if (status === 'online') {
        showToast('Status set to Online.');
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      } else if (status === 'idle') {
        showToast('Status set to Idle — subtle notifications active.');
      } else if (status === 'dnd') {
        showToast('Status set to Do Not Disturb — desktop notifications muted.');
      } else {
        showToast('Status set to Invisible — you will appear offline.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not update status.');
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    const text = msg.content || `${msg.authorName} sent an attachment.`;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(`${msg.authorName} says: ${text}`);
      window.speechSynthesis.speak(utter);
      showToast('Speaking message...');
    } else {
      showToast('Text-to-speech is not available in this browser.');
    }
  };

  const handleCreateReminder = (msg: ChatMessage, minutes: number) => {
    const preview = msg.content || '[Attachment]';
    const timerId = window.setTimeout(() => {
      const me = userRef.current;
      if (me && me.status !== 'dnd') {
        showToast(`Reminder (${msg.authorName}): ${preview}`);
        if (preferencesRef.current.notificationSound && me.status === 'online') {
          playNotificationChime();
        }
      }
    }, minutes * 60 * 1000);
    reminderTimersRef.current.push(timerId);
    showToast(`Reminder set for ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  };

  const openProfileById = async (targetUserId: string) => {
    if (!user) return;
    const [profileRes, postsRes] = await Promise.all([
      api.getUserProfile(targetUserId),
      api.getPosts({ scope: 'profile', userId: targetUserId }),
    ]);
    setViewedProfile(profileRes);
    setProfilePosts(postsRes.posts);
    setActiveView('profile');
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    if (viewedProfile && viewedProfile.user.id === newPost.authorId) {
      setProfilePosts((prev) => [newPost, ...prev]);
    }
    showToast('Post published!');
  };

  const handleLike = async (postId: string) => {
    const res = await api.toggleLike(postId);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, likes: res.likes } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
  };

  const handleComment = async (postId: string, content: string, parentCommentId?: string) => {
    const res = await api.addComment(postId, content, parentCommentId);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
  };

  const handleEditComment = async (postId: string, commentId: string, content: string) => {
    const res = await api.editComment(postId, commentId, content);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
    showToast('Comment updated.');
  };

  const handleReactComment = async (postId: string, commentId: string, emoji: string) => {
    const res = await api.reactComment(postId, commentId, emoji);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
  };

  const handleHideComment = async (postId: string, commentId: string) => {
    const res = await api.toggleHideComment(postId, commentId);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
    showToast(res.hidden ? 'Comment hidden.' : 'Comment unhidden.');
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const res = await api.deleteComment(postId, commentId);
    const updateList = (list: Post[]) =>
      list.map((p) => (p.id === postId ? { ...p, comments: res.comments } : p));
    setPosts(updateList);
    setProfilePosts(updateList);
    showToast('Comment deleted.');
  };

  const handleBlockUser = async (targetUserId: string, targetUserName: string) => {
    const res = await api.toggleBlockUser(targetUserId);
    setUser((prev) => (prev ? { ...prev, blockedUserIds: res.blockedUserIds } : prev));
    await loadPosts();
    if (viewedProfile) {
      const postsRes = await api.getPosts({ scope: 'profile', userId: viewedProfile.user.id });
      setProfilePosts(postsRes.posts);
    }
    showToast(res.blocked ? `Blocked ${targetUserName}.` : `Unblocked ${targetUserName}.`);
  };

  const handleChangeVisibility = async (postId: string, visibility: Visibility) => {
    const res = await api.updatePost(postId, { visibility });
    const updateList = (list: Post[]) => list.map((p) => (p.id === postId ? res.post : p));
    setPosts(updateList);
    setProfilePosts(updateList);
    showToast(`Post visibility set to ${visibility}.`);
  };

  const handleDeletePost = async (postId: string) => {
    await api.deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setProfilePosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Post deleted.');
  };

  const handleJoinServer = async (serverId: string) => {
    const res = await api.joinServer(serverId);
    setServers((prev) => prev.map((s) => (s.id === serverId ? res.server : s)));
    setSelectedServerId(serverId);
    setActiveView('server');
    showToast(`Joined ${res.server.name}!`);
  };

  const handleSendFriendRequest = async (identifier: string) => {
    try {
      const res = await api.sendFriendRequest(identifier);
      showToast(res.message);
      await loadFriends();
      if (viewedProfile) {
        const refreshed = await api.getUserProfile(viewedProfile.user.id);
        setViewedProfile(refreshed);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not send friend request.');
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'decline') => {
    await api.respondFriendRequest(requestId, action);
    showToast(action === 'accept' ? 'Friend request accepted!' : 'Friend request declined.');
    await Promise.all([loadFriends(), loadPosts()]);
  };

  const handleRemoveFriend = async (friendId: string) => {
    await api.removeFriend(friendId);
    if (activeDmFriendId === friendId) setActiveDmFriendId(null);
    showToast('Friend removed.');
    await Promise.all([loadFriends(), loadPosts()]);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-950 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const activeServer = servers.find((s) => s.id === selectedServerId) || null;
  const isFlushServerView = activeView === 'server' && Boolean(activeServer);
  const isFlushDmView = activeView === 'friends' && Boolean(activeDmFriendId);
  const totalUnreadDms = Object.values(unreadDmByFriendId).reduce((sum, n) => sum + n, 0);
  const totalServerPings = Object.values(pingsByServerId).reduce((sum, n) => sum + n, 0);

  // Aggregate live streaming user IDs across state, friends, voice rooms, and profile
  const streamingUserIds = new Set<string>();
  if (user.isStreaming || localVideoStream) streamingUserIds.add(user.id);
  for (const f of friendsData.friends) {
    if (f.isStreaming) streamingUserIds.add(f.id);
  }
  for (const list of Object.values(voiceParticipantsByServer)) {
    for (const p of list) {
      if (p.isStreaming) streamingUserIds.add(p.userId);
    }
  }
  if (viewedProfile?.user.isStreaming) {
    streamingUserIds.add(viewedProfile.user.id);
  }
  for (const [uid, info] of Object.entries(streamingUsersMap)) {
    if (info.isStreaming) streamingUserIds.add(uid);
    else streamingUserIds.delete(uid);
  }

  const getHeaderTitle = () => {
    if (activeView === 'startup') return 'Welcome & Features';
    if (activeView === 'feed') return 'Community Feed';
    if (activeView === 'friends') {
      if (activeDmFriendId) {
        const partner =
          friendsData.friends.find((f) => f.id === activeDmFriendId) ||
          friendsData.discoverPlayers.find((f) => f.id === activeDmFriendId) ||
          dmSendersById[activeDmFriendId];
        return partner ? `Direct Message · ${partner.name}` : 'Direct Message';
      }
      return 'Friends & Add Friend';
    }
    if (activeView === 'discover') return 'Discover Servers';
    if (activeView === 'settings') return 'Appearance, Voice & Account';
    if (activeView === 'safety') return 'Safety & Reports';
    if (activeView === 'profile') return viewedProfile?.user.name || 'Profile Dashboard';
    if (activeView === 'server') return activeServer?.name || 'Server Chat';
    return 'ArkLine';
  };

  const filteredFeedPosts = posts.filter((p) => {
    if (feedFilter === 'all') return true;
    return p.mediaType === feedFilter;
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 75 || Math.abs(dy) > 55) return;

    if (dx > 0) {
      if (isMobileMembersOpen) {
        setIsMobileMembersOpen(false);
      } else {
        setIsMobileSidebarOpen(true);
      }
    } else {
      if (isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      } else if (activeView === 'server' && activeServer) {
        setIsMobileMembersOpen(true);
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 flex transition-colors"
    >

      {/* Black Sidebar */}
      <Sidebar
        user={user}
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'settings') setSettingsFocusSection('appearance');
          if (view === 'friends') setActiveDmFriendId(null);
          setActiveView(view);
        }}
        servers={servers}
        selectedServerId={selectedServerId}
        selectedChannelId={selectedChannelId}
        onSelectChannelId={(cid) => setSelectedChannelId(cid)}
        onSelectServer={(sid) => {
          setSelectedServerId(sid);
          setActiveView('server');
        }}
        onJoinVoiceChannel={handleJoinVoiceChannel}
        voiceParticipants={selectedServerId ? voiceParticipantsByServer[selectedServerId] || [] : []}
        onOpenNewServerModal={() => setIsNewServerOpen(true)}
        onOpenMyProfile={() => openProfileById(user.id)}
        onChangeStatus={handleChangeStatus}
        pendingFriendCount={friendsData.incomingRequests.length}
        friends={friendsData.friends}
        onlineUserIds={onlineUserIds}
        activeDmFriendId={activeDmFriendId}
        dmPopupFriendIds={dmPopupFriendIds}
        dmSendersById={dmSendersById}
        unreadDmByFriendId={unreadDmByFriendId}
        lastDmAtByFriendId={lastDmAtByFriendId}
        pingsByServerId={pingsByServerId}
        pingsByChannelId={pingsByChannelId}
        unreadServerIds={unreadServerIds}
        onSelectDmPopup={handleSelectDmPopup}
        onDismissDmPopup={handleDismissDmPopup}
        streamingUserIds={streamingUserIds}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        activeVoice={activeVoice}
        voiceSettings={preferences.voice}
        onToggleVoiceMute={handleToggleVoiceMute}
        onToggleVoiceDeafen={handleToggleVoiceDeafen}
        onToggleVoiceStream={() => {
          if (activeVoice?.isStreaming || localVideoStream) {
            handleStopLiveStream();
          } else {
            setLiveModalConfig({
              isOpen: true,
              defaultSource: 'screen',
              contextLabel: `Streaming in ${activeVoice?.channelName || 'Voice Channel'}`,
              allowFeedAnnouncement: false,
            });
          }
        }}
        onPttHoldStart={handlePttHoldStart}
        onPttHoldEnd={handlePttHoldEnd}
        onLeaveVoice={handleLeaveVoice}
        onOpenVoiceSettings={() => {
          setSettingsFocusSection('voice');
          setActiveView('settings');
        }}
      />

      {/* Main Workspace (Collapses offset to 68px on desktop when viewing a server) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isFlushServerView ? 'lg:pl-[68px]' : 'lg:pl-[308px]'
        }`}
      >
        <TopBar
          title={getHeaderTitle()}
          activeView={activeView}
          notifications={notifications}
          onMarkAllNotificationsRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          onClearNotifications={() => setNotifications([])}
          onSelectNotification={handleSelectNotification}
          onOpenAddFriend={() => {
            setActiveDmFriendId(null);
            setActiveView('friends');
          }}
          unreadDmCount={totalUnreadDms + totalServerPings}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
        />

        <main
          className={
            isFlushServerView
              ? 'flex-1 p-2 sm:p-4 lg:p-0 max-w-none w-full pb-16 lg:pb-0'
              : isFlushDmView
              ? 'flex-1 p-0 max-w-none w-full pb-14 lg:pb-0'
              : 'flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-20 lg:pb-8'
          }
        >
          {activeView === 'startup' && (
            <StartupPage
              user={user}
              isNewSignup={isNewSignup}
              onNavigate={(view) => setActiveView(view)}
              onOpenMyProfile={() => openProfileById(user.id)}
              onOpenNewServer={() => setIsNewServerOpen(true)}
            />
          )}

          {activeView === 'discover' && (
            <DiscoverServersView
              servers={servers}
              serverSearch={serverSearch}
              setServerSearch={setServerSearch}
              onJoinServer={handleJoinServer}
              onSelectServer={(sid) => {
                setSelectedServerId(sid);
                setActiveView('server');
              }}
              onOpenNewServerModal={() => setIsNewServerOpen(true)}
            />
          )}

          {activeView === 'feed' && (
            <div className="pilgrim-stack max-w-3xl mx-auto">
              {/* Quick Post Banner */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = makeInitialsAvatar(user.name);
                    }}
                    className={`w-10 h-10 rounded-full object-cover shrink-0 ${
                      streamingUserIds.has(user.id)
                        ? 'ring-2 ring-red-500 border border-zinc-950'
                        : 'border border-zinc-200 dark:border-zinc-700'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      Share with the ArkLine Community
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Upload a video, image, or thought — Public, Friends-Only, or Private.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(true)}
                  className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Post</span>
                </button>
              </div>

              {/* Feed Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-zinc-200/70 dark:bg-zinc-900 border border-transparent dark:border-zinc-800 rounded-xl w-fit">
                {[
                  { id: 'all' as const, label: 'All Posts', icon: null },
                  { id: 'video' as const, label: 'Videos', icon: Video },
                  { id: 'image' as const, label: 'Images', icon: ImageIcon },
                  { id: 'none' as const, label: 'Thoughts', icon: MessageSquare },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeedFilter(tab.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      feedFilter === tab.id
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Feed Posts */}
              <div className="pilgrim-stack">
                {filteredFeedPosts.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      No posts in this category yet
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Be the first to upload a video, share an image, or post a thought.
                    </p>
                  </div>
                ) : (
                  filteredFeedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      streamingUserIds={streamingUserIds}
                      onLike={handleLike}
                      onComment={handleComment}
                      onEditComment={handleEditComment}
                      onReactComment={handleReactComment}
                      onHideComment={handleHideComment}
                      onDeleteComment={handleDeleteComment}
                      onBlockUser={handleBlockUser}
                      onShare={(p) => setSharePostTarget(p)}
                      onChangeVisibility={handleChangeVisibility}
                      onDeletePost={handleDeletePost}
                      onReport={(t) => setReportTarget(t)}
                      onOpenProfile={openProfileById}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {activeView === 'profile' && viewedProfile && (
            <div className="max-w-3xl mx-auto">
              <ProfileDashboard
                profileUser={viewedProfile.user}
                currentUser={user}
                isFriend={viewedProfile.isFriend}
                pendingDirection={viewedProfile.pendingDirection}
                friendCount={viewedProfile.friendCount}
                posts={profilePosts}
                streamingUserIds={streamingUserIds}
                localVideoStream={localVideoStream}
                remoteVideoStreams={remoteVideoStreams}
                onOpenLiveModal={() =>
                  setLiveModalConfig({
                    isOpen: true,
                    defaultSource: 'camera',
                    contextLabel: 'Facebook-Style Profile Live Stream',
                    allowFeedAnnouncement: true,
                  })
                }
                onStopLiveStream={handleStopLiveStream}
                onProfileUpdated={(updated) => {
                  setUser(updated);
                  setViewedProfile((prev) => (prev ? { ...prev, user: updated } : null));
                  loadPosts();
                  showToast('Profile updated.');
                }}
                onPostCreated={handlePostCreated}
                onLike={handleLike}
                onComment={handleComment}
                onEditComment={handleEditComment}
                onReactComment={handleReactComment}
                onHideComment={handleHideComment}
                onDeleteComment={handleDeleteComment}
                onBlockUser={handleBlockUser}
                onShare={(p) => setSharePostTarget(p)}
                onChangeVisibility={handleChangeVisibility}
                onDeletePost={handleDeletePost}
                onAddFriend={handleSendFriendRequest}
                onStartDm={(friendId) => {
                  setActiveDmFriendId(friendId);
                  setActiveView('friends');
                }}
                onReport={(t) => setReportTarget(t)}
                onOpenProfile={openProfileById}
              />
            </div>
          )}

          {activeView === 'server' && activeServer && (
            <ServerWorkspace
              server={activeServer}
              currentUser={user}
              friendsData={friendsData}
              onlineUserIds={onlineUserIds}
              streamingUserIds={streamingUserIds}
              selectedChannelId={selectedChannelId}
              onSelectChannelId={(cid) => setSelectedChannelId(cid)}
              pingsByChannelId={pingsByChannelId}
              incomingWsMessage={incomingWsMessage}
              incomingWsUpdatedMessage={incomingWsUpdatedMessage}
              incomingWsDeletedMessageId={incomingWsDeletedMessageId}
              voiceParticipants={voiceParticipantsByServer[activeServer.id] || []}
              activeVoice={activeVoice}
              voiceSettings={preferences.voice}
              localVideoStream={localVideoStream}
              remoteVideoStreams={remoteVideoStreams}
              isMobileMembersOpen={isMobileMembersOpen}
              setIsMobileMembersOpen={setIsMobileMembersOpen}
              onOpenMobileDrawer={() => setIsMobileSidebarOpen(true)}
              onJoinVoiceChannel={handleJoinVoiceChannel}
              onLeaveVoice={handleLeaveVoice}
              onToggleVoiceMute={handleToggleVoiceMute}
              onToggleVoiceDeafen={handleToggleVoiceDeafen}
              onStartVoiceStream={() =>
                setLiveModalConfig({
                  isOpen: true,
                  defaultSource: 'screen',
                  contextLabel: `Go Live in ${activeServer.name}`,
                  allowFeedAnnouncement: false,
                })
              }
              onStopVoiceStream={handleStopLiveStream}
              onPttHoldStart={handlePttHoldStart}
              onPttHoldEnd={handlePttHoldEnd}
              onSwitchVoiceInputMode={(mode) => {
                setPreferences((prev) => ({
                  ...prev,
                  voice: { ...prev.voice, inputMode: mode },
                }));
                if (activeVoice) {
                  const next = { ...activeVoice, pttActive: false, speaking: false };
                  setActiveVoice(next);
                  syncMicTransmission(next);
                }
                showToast(
                  mode === 'ptt'
                    ? 'Switched to Push to Talk.'
                    : 'Switched to Voice Activity.'
                );
              }}
              onOpenVoiceSettings={() => {
                setSettingsFocusSection('voice');
                setActiveView('settings');
              }}
              onOpenUserSettings={() => {
                setSettingsFocusSection('appearance');
                setActiveView('settings');
              }}
              onChangeStatus={handleChangeStatus}
              onServerUpdated={(updatedSrv) => {
                setServers((prev) =>
                  prev.map((s) => (s.id === updatedSrv.id ? { ...s, ...updatedSrv } : s))
                );
              }}
              onOpenProfile={openProfileById}
              onStartDm={(friendId) => {
                handleSelectDmPopup(friendId);
              }}
              onSendInviteDm={handleSendInviteDm}
              onForwardMessage={(msg) => setForwardMessageTarget(msg)}
              onCreateReminder={handleCreateReminder}
              onSpeakMessage={handleSpeakMessage}
              onNotify={showToast}
              onReport={(t) => setReportTarget(t)}
              onAddFriend={handleSendFriendRequest}
            />
          )}

          {activeView === 'friends' && (
            <FriendsView
              currentUser={user}
              friendsData={friendsData}
              onlineUserIds={onlineUserIds}
              streamingUserIds={streamingUserIds}
              activeDmFriendId={activeDmFriendId}
              setActiveDmFriendId={(fid) => {
                setActiveDmFriendId(fid);
                if (fid) {
                  clearDmUnread(fid);
                  setDmPopupFriendIds((prev) => prev.filter((id) => id !== fid));
                }
              }}
              dmSendersById={dmSendersById}
              unreadDmByFriendId={unreadDmByFriendId}
              onClearDmUnread={clearDmUnread}
              onDmSent={(fid, msg) => {
                touchDmTimestamp(fid, msg.createdAt);
              }}
              incomingWsMessage={incomingWsMessage}
              incomingWsUpdatedMessage={incomingWsUpdatedMessage}
              incomingWsDeletedMessageId={incomingWsDeletedMessageId}
              onRefreshFriends={loadFriends}
              onSendFriendRequest={handleSendFriendRequest}
              onRespondRequest={handleRespondRequest}
              onRemoveFriend={handleRemoveFriend}
              onOpenProfile={openProfileById}
              onForwardMessage={(msg) => setForwardMessageTarget(msg)}
              onCreateReminder={handleCreateReminder}
              onSpeakMessage={handleSpeakMessage}
              onNotify={showToast}
              onReport={(t) => setReportTarget(t)}
            />
          )}

          {activeView === 'safety' && (
            <SafetyView
              currentUser={user}
              onUserUpdated={(updated) => {
                setUser(updated);
                loadPosts();
                showToast('Blocked list updated.');
              }}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              preferences={preferences}
              onUpdatePreferences={(nextPrefs) => {
                const prevMode = preferencesRef.current.voice.inputMode;
                preferencesRef.current = nextPrefs;
                setPreferences(nextPrefs);
                if (activeVoice && nextPrefs.voice.inputMode !== prevMode) {
                  const nextVoice: ActiveVoiceInfo = {
                    ...activeVoice,
                    pttActive: false,
                    speaking: false,
                  };
                  setActiveVoice(nextVoice);
                  syncMicTransmission(nextVoice);
                }
              }}
              onResetDefaults={() => {
                preferencesRef.current = DEFAULT_PREFERENCES;
                setPreferences(DEFAULT_PREFERENCES);
                if (activeVoice) {
                  const nextVoice: ActiveVoiceInfo = {
                    ...activeVoice,
                    pttActive: false,
                    speaking: false,
                  };
                  setActiveVoice(nextVoice);
                  syncMicTransmission(nextVoice);
                }
                showToast('Settings reset to defaults.');
              }}
              onSignOut={handleSignOut}
              focusSection={settingsFocusSection}
            />
          )}
        </main>
      </div>

      {/* Discord-inspired Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#09090b] border-t border-zinc-800 grid grid-cols-5 items-center px-1"
      >
        <button
          type="button"
          onClick={() => setActiveView('startup')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeView === 'startup' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('feed')}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeView === 'feed' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className={`min-h-[44px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeView === 'server' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Compass className="w-4 h-4" />
            {totalServerPings > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                {totalServerPings > 99 ? '99+' : totalServerPings}
              </span>
            )}
          </div>
          <span>Servers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('friends')}
          className={`min-h-[44px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeView === 'friends' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Users className="w-4 h-4" />
            {(totalUnreadDms > 0 || friendsData.incomingRequests.length > 0) && (
              <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                {totalUnreadDms + friendsData.incomingRequests.length > 9
                  ? '9+'
                  : totalUnreadDms + friendsData.incomingRequests.length}
              </span>
            )}
          </div>
          <span>DMs</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSettingsFocusSection('appearance');
            setActiveView('settings');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold cursor-pointer ${
            activeView === 'settings' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>You</span>
        </button>
      </nav>

      {/* Modals */}
      <PostComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onPostCreated={handlePostCreated}
      />

      <NewServerModal
        isOpen={isNewServerOpen}
        initialInviteCode={pendingInviteCode}
        onClose={() => {
          setIsNewServerOpen(false);
          setPendingInviteCode('');
        }}
        onServerCreated={(newSrv) => {
          setServers((prev) => {
            const exists = prev.some((s) => s.id === newSrv.id);
            return exists
              ? prev.map((s) => (s.id === newSrv.id ? newSrv : s))
              : [newSrv, ...prev];
          });
          setSelectedServerId(newSrv.id);
          setActiveView('server');
          setPendingInviteCode('');
          showToast(`Joined "${newSrv.name}"!`);
        }}
      />

      <ReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={(blocked) => {
          showToast(
            blocked
              ? 'Report submitted and user blocked.'
              : 'Report submitted to ArkLine Safety Team.'
          );
          if (blocked) {
            api.getMe().then((res) => setUser(res.user));
            loadPosts();
          }
        }}
      />

      <SharePostModal
        post={sharePostTarget}
        servers={servers}
        onClose={() => setSharePostTarget(null)}
        onShared={(postId, newCount) => {
          const updateCount = (list: Post[]) =>
            list.map((p) => (p.id === postId ? { ...p, sharesCount: newCount } : p));
          setPosts(updateCount);
          setProfilePosts(updateCount);
          showToast('Post shared!');
        }}
      />

      <ForwardMessageModal
        message={forwardMessageTarget}
        servers={servers}
        friends={friendsData.friends}
        onClose={() => setForwardMessageTarget(null)}
        onForwarded={(dest) => showToast(`Message forwarded to ${dest}.`)}
      />

      <LiveStreamModal
        isOpen={liveModalConfig.isOpen}
        defaultSource={liveModalConfig.defaultSource}
        contextLabel={liveModalConfig.contextLabel}
        allowFeedAnnouncement={liveModalConfig.allowFeedAnnouncement}
        isCurrentlyStreaming={Boolean(user.isStreaming || localVideoStream)}
        activeStreamTitle={user.streamTitle}
        localVideoStream={localVideoStream}
        onClose={() => setLiveModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onStartStream={handleStartLiveStream}
        onStopStream={handleStopLiveStream}
      />
    </div>
  );
}
