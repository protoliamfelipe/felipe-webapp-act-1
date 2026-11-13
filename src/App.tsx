import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Plus, Video, Image as ImageIcon, MessageSquare } from 'lucide-react';
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
} from './types';
import { api, getStoredToken, clearStoredAuth } from './services/api';
import { makeInitialsAvatar } from './utils/avatars';
import { hasServerPermission } from './utils/permissions';
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

function playNotificationChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    // Ignore autoplay restriction errors
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

  // Servers & Chat
  const [servers, setServers] = useState<Array<Server & { isMember: boolean; memberCount: number }>>([]);
  const [serverSearch, setServerSearch] = useState('');
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
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

  // Friends & DMs
  const [friendsData, setFriendsData] = useState<FriendsOverview & { discoverPlayers: User[] }>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    discoverPlayers: [],
  });
  const [activeDmFriendId, setActiveDmFriendId] = useState<string | null>(null);

  // Modals & Notifications
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isNewServerOpen, setIsNewServerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [sharePostTarget, setSharePostTarget] = useState<Post | null>(null);
  const [forwardMessageTarget, setForwardMessageTarget] = useState<ChatMessage | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live Refs for WS, Voice Engine, and Notification rules
  const wsRef = useRef<WebSocket | null>(null);
  const userRef = useRef<User | null>(user);
  const preferencesRef = useRef<UserPreferences>(preferences);
  const activeVoiceRef = useRef<ActiveVoiceInfo | null>(activeVoice);
  const serversRef = useRef(servers);
  const reminderTimersRef = useRef<number[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    activeVoiceRef.current = activeVoice;
  }, [activeVoice]);
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const sendWs = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Status-driven incoming message notification handler
  const dispatchIncomingNotification = useCallback(
    (msg: ChatMessage) => {
      const me = userRef.current;
      if (!me || msg.authorId === me.id) return;

      const status: UserStatus = me.status || 'online';
      // Do Not Disturb & Invisible suppress desktop popups & notification sounds
      if (status === 'dnd' || status === 'invisible') {
        return;
      }

      const preview =
        msg.content ||
        (msg.attachmentType === 'audio'
          ? 'Sent a voice message'
          : msg.attachmentType === 'image'
          ? 'Sent an image'
          : 'Sent a message');

      showToast(`${msg.authorName}: ${preview}`);

      if (status === 'online') {
        if (preferencesRef.current.notificationSound) {
          playNotificationChime();
        }
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          try {
            new Notification(`Pilgrim · ${msg.authorName}`, {
              body: preview,
            });
          } catch {
            // Ignore browser Notification restrictions
          }
        }
      }
    },
    [showToast]
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
      });

      // Also update optimistic local participant list if WS is unavailable
      const me = userRef.current;
      if (me) {
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
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
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
        let audioEl = remoteAudioElsRef.current.get(peerUserId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          remoteAudioElsRef.current.set(peerUserId, audioEl);
        }
        audioEl.srcObject = ev.streams[0];
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

  // Initial Data Load when signed in
  useEffect(() => {
    if (!user) return;
    loadServers(serverSearch);
    loadPosts();
    loadFriends();
  }, [user?.id]);

  // Live server search
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      loadServers(serverSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [serverSearch, user?.id, loadServers]);

  // Load initial voice participants when opening a server
  useEffect(() => {
    if (!user || !selectedServerId) return;
    api
      .getVoiceParticipants(selectedServerId)
      .then((res) => {
        if (res.participants.length > 0) {
          setVoiceParticipantsByServer((prev) => ({
            ...prev,
            [selectedServerId]: res.participants,
          }));
        }
      })
      .catch(() => {});
  }, [user?.id, selectedServerId]);

  // WebSocket Connection for Real-Time Chat, Presence, and Voice Channels
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    if (!token || token.startsWith('local_token:')) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

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
        } else if (data.type === 'chat:message' && data.message) {
          setIncomingWsMessage(data.message);
          dispatchIncomingNotification(data.message);
        } else if (data.type === 'chat:message_updated' && data.message) {
          setIncomingWsUpdatedMessage(data.message);
        } else if (data.type === 'chat:message_deleted' && data.messageId) {
          setIncomingWsDeletedMessageId(data.messageId);
        } else if (
          data.type === 'server:created' ||
          data.type === 'server:channel_created' ||
          data.type === 'server:updated'
        ) {
          loadServers(serverSearch);
        } else if (data.type === 'friend:update') {
          loadFriends();
          loadPosts();
        } else if (data.type === 'voice:participants' && data.serverId) {
          const participants: VoiceParticipant[] = data.participants || [];
          setVoiceParticipantsByServer((prev) => ({
            ...prev,
            [data.serverId]: participants,
          }));

          // Initiate WebRTC offers cleanly if connected to the same voice channel
          const currentVoice = activeVoiceRef.current;
          const me = userRef.current;
          if (currentVoice && me && currentVoice.serverId === data.serverId) {
            const peersInRoom = participants.filter(
              (p) => p.channelId === currentVoice.channelId && p.userId !== me.id
            );
            for (const peer of peersInRoom) {
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
        } else if (data.type === 'voice:signal' && data.fromUserId && data.signal) {
          const currentVoice = activeVoiceRef.current;
          if (!currentVoice || currentVoice.channelId !== data.channelId) return;
          const pc = getOrCreatePeerConnection(data.fromUserId, data.channelId);
          try {
            if (data.signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
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
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
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
  }, [user?.id, loadServers, loadFriends, loadPosts, serverSearch, dispatchIncomingNotification, getOrCreatePeerConnection, sendWs]);

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

    const nextVoice: ActiveVoiceInfo = {
      serverId: server.id,
      serverName: server.name,
      channelId: channel.id,
      channelName: channel.name,
      muted: !canSpeak,
      deafened: false,
      speaking: false,
      pttActive: false,
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

    // Optimistic local participant entry (ensures voice UI works even in local fallback mode)
    setVoiceParticipantsByServer((prev) => {
      const cleaned: Record<string, VoiceParticipant[]> = {};
      for (const [sid, list] of Object.entries(prev)) {
        cleaned[sid] = list.filter((p) => p.userId !== user.id);
      }
      const existing = cleaned[server.id] || [];
      cleaned[server.id] = [
        ...existing,
        {
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatarUrl,
          serverId: server.id,
          channelId: channel.id,
          muted: nextVoice.muted,
          deafened: false,
          speaking: false,
        },
      ];
      return cleaned;
    });

    sendWs({
      type: 'voice:join',
      serverId: server.id,
      channelId: channel.id,
      muted: nextVoice.muted,
      deafened: false,
    });
    showToast(`Joined voice channel: ${channel.name}`);
  };

  const handleLeaveVoice = useCallback(() => {
    const me = userRef.current;
    sendWs({ type: 'voice:leave' });
    cleanupVoiceMedia();
    setActiveVoice(null);
    if (me) {
      setVoiceParticipantsByServer((prev) => {
        const next: Record<string, VoiceParticipant[]> = {};
        for (const [sid, list] of Object.entries(prev)) {
          next[sid] = list.filter((p) => p.userId !== me.id);
        }
        return next;
      });
    }
    showToast('Disconnected from voice channel.');
  }, [cleanupVoiceMedia, sendWs, showToast]);

  const handleToggleVoiceMute = () => {
    if (!activeVoice || !user) return;
    const srv = servers.find((s) => s.id === activeVoice.serverId);
    if (activeVoice.muted && srv && !hasServerPermission(srv, user.id, 'speakVoice')) {
      showToast('Your role does not allow speaking in voice channels.');
      return;
    }
    const nextMuted = !activeVoice.muted;
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
    const next: ActiveVoiceInfo = {
      ...activeVoice,
      deafened: nextDeafened,
      muted: nextDeafened ? true : activeVoice.muted,
      speaking: nextDeafened ? false : activeVoice.speaking,
    };
    setActiveVoice(next);
    syncMicTransmission(next);
  };

  const handleAuthSuccess = (authenticatedUser: User, newSignup = false) => {
    setUser(authenticatedUser);
    setIsNewSignup(newSignup);
    setActiveView('startup');
  };

  const handleSignOut = () => {
    handleLeaveVoice();
    api.logout();
    setUser(null);
    setPosts([]);
    setServers([]);
    setSelectedServerId(null);
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

  const getHeaderTitle = () => {
    if (activeView === 'startup') return 'Welcome & Features';
    if (activeView === 'feed') return 'Community Feed';
    if (activeView === 'friends') return 'Friends & Direct Messages';
    if (activeView === 'settings') return 'Appearance, Voice & Account';
    if (activeView === 'safety') return 'Safety & Reports';
    if (activeView === 'profile') return viewedProfile?.user.name || 'Profile Dashboard';
    if (activeView === 'server') return activeServer?.name || 'Server Chat';
    return 'Pilgrim';
  };

  const filteredFeedPosts = posts.filter((p) => {
    if (feedFilter === 'all') return true;
    return p.mediaType === feedFilter;
  });

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 flex transition-colors">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-5 right-5 z-50 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 px-4 py-2.5 rounded-xl shadow-lg border border-zinc-800 dark:border-zinc-200 text-xs font-medium flex items-center gap-2 max-w-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-zinc-300 dark:text-zinc-700 shrink-0" />
            <span className="truncate">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black Sidebar */}
      <Sidebar
        user={user}
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'settings') setSettingsFocusSection('appearance');
          setActiveView(view);
        }}
        servers={servers}
        serverSearch={serverSearch}
        setServerSearch={setServerSearch}
        selectedServerId={selectedServerId}
        onSelectServer={(sid) => {
          setSelectedServerId(sid);
          setActiveView('server');
        }}
        onJoinServer={handleJoinServer}
        onOpenNewServerModal={() => setIsNewServerOpen(true)}
        onOpenMyProfile={() => openProfileById(user.id)}
        onChangeStatus={handleChangeStatus}
        pendingFriendCount={friendsData.incomingRequests.length}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        activeVoice={activeVoice}
        voiceSettings={preferences.voice}
        onToggleVoiceMute={handleToggleVoiceMute}
        onToggleVoiceDeafen={handleToggleVoiceDeafen}
        onPttHoldStart={handlePttHoldStart}
        onPttHoldEnd={handlePttHoldEnd}
        onLeaveVoice={handleLeaveVoice}
        onOpenVoiceSettings={() => {
          setSettingsFocusSection('voice');
          setActiveView('settings');
        }}
      />

      {/* Main White / Light Gray (or Dark) Workspace */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[308px]">
        <TopBar
          title={getHeaderTitle()}
          activeView={activeView}
          onOpenComposer={() => setIsComposerOpen(true)}
          onOpenNewServer={() => setIsNewServerOpen(true)}
          onOpenAddFriend={() => setActiveView('friends')}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {activeView === 'startup' && (
            <StartupPage
              user={user}
              isNewSignup={isNewSignup}
              onNavigate={(view) => setActiveView(view)}
              onOpenMyProfile={() => openProfileById(user.id)}
              onOpenNewServer={() => setIsNewServerOpen(true)}
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
                    className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                      Share with the Pilgrim Community
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
              onlineUserIds={onlineUserIds}
              incomingWsMessage={incomingWsMessage}
              incomingWsUpdatedMessage={incomingWsUpdatedMessage}
              incomingWsDeletedMessageId={incomingWsDeletedMessageId}
              voiceParticipants={voiceParticipantsByServer[activeServer.id] || []}
              activeVoice={activeVoice}
              voiceSettings={preferences.voice}
              onJoinVoiceChannel={handleJoinVoiceChannel}
              onLeaveVoice={handleLeaveVoice}
              onToggleVoiceMute={handleToggleVoiceMute}
              onToggleVoiceDeafen={handleToggleVoiceDeafen}
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
              onServerUpdated={(updatedSrv) => {
                setServers((prev) =>
                  prev.map((s) => (s.id === updatedSrv.id ? { ...s, ...updatedSrv } : s))
                );
              }}
              onOpenProfile={openProfileById}
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
              activeDmFriendId={activeDmFriendId}
              setActiveDmFriendId={setActiveDmFriendId}
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
              onUpdatePreferences={setPreferences}
              onResetDefaults={() => {
                setPreferences(DEFAULT_PREFERENCES);
                showToast('Settings reset to defaults.');
              }}
              onSignOut={handleSignOut}
              focusSection={settingsFocusSection}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <PostComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onPostCreated={handlePostCreated}
      />

      <NewServerModal
        isOpen={isNewServerOpen}
        onClose={() => setIsNewServerOpen(false)}
        onServerCreated={(newSrv) => {
          setServers((prev) => [newSrv, ...prev]);
          setSelectedServerId(newSrv.id);
          setActiveView('server');
          showToast(`Server "${newSrv.name}" created!`);
        }}
      />

      <ReportModal
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={(blocked) => {
          showToast(
            blocked
              ? 'Report submitted and user blocked.'
              : 'Report submitted to Pilgrim Safety Team.'
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
    </div>
  );
}
