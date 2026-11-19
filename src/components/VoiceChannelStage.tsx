import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Settings,
  Radio,
  Hash,
  Users,
  Lock,
  MonitorUp,
  MonitorOff,
  Maximize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Channel, Server, VoiceParticipant, VoiceSettings } from '../types';
import { ActiveVoiceInfo } from './Sidebar';
import { formatKeybindLabel } from '../utils/permissions';
import { makeInitialsAvatar } from '../utils/avatars';

interface VoiceChannelStageProps {
  channel: Channel;
  server: Server;
  currentUserId: string;
  participants: VoiceParticipant[];
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  canConnect: boolean;
  canSpeak: boolean;
  localVideoStream: MediaStream | null;
  remoteVideoStreams: Record<string, MediaStream>;
  streamingUserIds?: Set<string>;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onStartVoiceStream: () => void;
  onStopVoiceStream: () => void;
  onPttHoldStart: () => void;
  onPttHoldEnd: () => void;
  onSwitchInputMode: (mode: 'vad' | 'ptt') => void;
  onOpenVoiceSettings: () => void;
  onSwitchToTextChannel: () => void;
  onOpenProfile: (userId: string) => void;
}

const StreamVideoPlayer: React.FC<{ stream: MediaStream; muted?: boolean }> = ({
  stream,
  muted = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-contain bg-black"
    />
  );
};

export const VoiceChannelStage: React.FC<VoiceChannelStageProps> = ({
  channel,
  server,
  currentUserId,
  participants,
  activeVoice,
  voiceSettings,
  canConnect,
  canSpeak,
  localVideoStream,
  remoteVideoStreams,
  streamingUserIds,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onStartVoiceStream,
  onStopVoiceStream,
  onPttHoldStart,
  onPttHoldEnd,
  onSwitchInputMode,
  onOpenVoiceSettings,
  onSwitchToTextChannel,
  onOpenProfile,
}) => {
  const isConnectedHere =
    activeVoice?.serverId === server.id && activeVoice?.channelId === channel.id;
  const [watchingUserId, setWatchingUserId] = useState<string | null>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  // Identify participants actively streaming in this voice room
  const streamingParticipants = participants.filter(
    (p) =>
      p.isStreaming ||
      streamingUserIds?.has(p.userId) ||
      (p.userId === currentUserId && Boolean(localVideoStream)) ||
      Boolean(remoteVideoStreams[p.userId])
  );

  // Auto-select the first available video stream if user hasn't explicitly hidden it
  useEffect(() => {
    if (watchingUserId && !streamingParticipants.some((p) => p.userId === watchingUserId)) {
      setWatchingUserId(null);
    } else if (!watchingUserId && streamingParticipants.length > 0) {
      const withVideo =
        streamingParticipants.find((p) =>
          p.userId === currentUserId ? Boolean(localVideoStream) : Boolean(remoteVideoStreams[p.userId])
        ) || streamingParticipants[0];
      if (withVideo) setWatchingUserId(withVideo.userId);
    }
  }, [streamingParticipants.length, localVideoStream, remoteVideoStreams, currentUserId, watchingUserId]);

  const activeStreamer = watchingUserId
    ? streamingParticipants.find((p) => p.userId === watchingUserId) || null
    : null;
  const activeStreamObj = activeStreamer
    ? activeStreamer.userId === currentUserId
      ? localVideoStream
      : remoteVideoStreams[activeStreamer.userId] || null
    : null;

  const isLocalStreamingInRoom =
    isConnectedHere && (Boolean(activeVoice?.isStreaming) || Boolean(localVideoStream));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="h-14 px-5 border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Volume2 className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="font-display text-sm font-bold text-white truncate">
            {channel.name}
          </span>
          {streamingParticipants.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {channel.topic && (
            <>
              <span aria-hidden="true" className="text-zinc-700 hidden sm:inline">
                |
              </span>
              <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                {channel.topic}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwitchToTextChannel}
            className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Hash className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Text Channels</span>
          </button>
          <button
            type="button"
            onClick={onOpenVoiceSettings}
            className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice Settings</span>
          </button>
        </div>
      </div>

      {/* Stage Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center gap-6">
        {/* Live Stream Spotlight Viewer (Discord Go Live Style) */}
        {activeStreamer && (
          <div
            ref={stageContainerRef}
            className="w-full max-w-4xl rounded-2xl overflow-hidden bg-black border-2 border-red-500/80 shadow-2xl shadow-red-950/20"
          >
            <div className="px-4 py-2.5 bg-zinc-900/95 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
                <p className="text-xs font-bold text-white truncate">
                  {activeStreamer.userName}
                  {activeStreamer.streamTitle ? ` — ${activeStreamer.streamTitle}` : ' is streaming'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeStreamObj && (
                  <button
                    type="button"
                    onClick={() => stageContainerRef.current?.requestFullscreen?.().catch(() => {})}
                    title="Fullscreen Stream"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setWatchingUserId(null)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Hide</span>
                </button>
              </div>
            </div>

            <div className="aspect-video w-full bg-black flex items-center justify-center relative">
              {activeStreamObj ? (
                <StreamVideoPlayer
                  stream={activeStreamObj}
                  muted={activeStreamer.userId === currentUserId}
                />
              ) : (
                <div className="text-center p-6 space-y-2 max-w-sm">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500 text-red-400 flex items-center justify-center mx-auto">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <p className="text-xs font-bold text-white">
                    {activeStreamer.userName} is live
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {isConnectedHere
                      ? 'Connecting peer video stream over WebRTC...'
                      : 'Join the voice channel below to watch the live video feed.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {participants.length === 0 ? (
          <div className="text-center max-w-md space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-300">
              <Volume2 className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-bold text-white">
              {channel.name}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No one is currently in this voice channel. Join now to talk or share your screen live with server members.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-3xl">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {participants.length} in voice
                </span>
              </span>
              {isConnectedHere && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {participants.map((p) => {
                const isSpeaking = p.speaking && !p.muted;
                const isStreamingPeer = Boolean(
                  p.isStreaming ||
                    streamingUserIds?.has(p.userId) ||
                    (p.userId === currentUserId && localVideoStream) ||
                    remoteVideoStreams[p.userId]
                );

                return (
                  <div
                    key={p.userId}
                    className={`p-5 rounded-2xl bg-zinc-900 border transition-all flex flex-col items-center gap-3 text-center ${
                      isStreamingPeer
                        ? 'border-red-500 ring-2 ring-red-500/40'
                        : isSpeaking
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProfile(p.userId)}
                      className="relative cursor-pointer focus:outline-none"
                    >
                      <img
                        src={p.userAvatar}
                        alt={p.userName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = makeInitialsAvatar(p.userName);
                        }}
                        className={`w-16 h-16 rounded-full object-cover transition-all ${
                          isStreamingPeer
                            ? 'ring-3 ring-red-500 border-2 border-zinc-950'
                            : isSpeaking
                            ? 'border-2 border-emerald-400 ring-2 ring-emerald-500'
                            : 'border-2 border-zinc-700'
                        }`}
                      />
                      {isStreamingPeer && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-extrabold uppercase tracking-wider border border-zinc-950">
                          LIVE
                        </span>
                      )}
                      {(p.muted || p.deafened) && (
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center text-red-400">
                          {p.muted ? <MicOff className="w-3 h-3" /> : <Volume2 className="w-3 h-3 opacity-60" />}
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 w-full">
                      <p className="text-xs font-bold text-white truncate">{p.userName}</p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isStreamingPeer
                            ? 'text-red-400 font-semibold'
                            : isSpeaking
                            ? 'text-emerald-400 font-semibold'
                            : 'text-zinc-400'
                        }`}
                      >
                        {isStreamingPeer
                          ? p.streamTitle || 'Streaming Live'
                          : p.deafened
                          ? 'Deafened'
                          : p.muted
                          ? 'Muted'
                          : isSpeaking
                          ? 'Speaking'
                          : 'Listening'}
                      </p>
                    </div>

                    {isStreamingPeer && watchingUserId !== p.userId && (
                      <button
                        type="button"
                        onClick={() => setWatchingUserId(p.userId)}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Watch Stream</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Mode Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => onSwitchInputMode('vad')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              voiceSettings.inputMode === 'vad'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Voice Activity
          </button>
          <button
            type="button"
            onClick={() => onSwitchInputMode('ptt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              voiceSettings.inputMode === 'ptt'
                ? 'bg-white text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Push to Talk ({formatKeybindLabel(voiceSettings.pttKey)})
          </button>
        </div>
      </div>

      {/* Bottom Voice Control Dock */}
      <div className="p-4 sm:p-5 border-t border-zinc-800 bg-black flex flex-col items-center gap-3 shrink-0">
        {!isConnectedHere ? (
          canConnect ? (
            <button
              type="button"
              onClick={onJoinVoice}
              className="py-2.5 px-6 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
              <span>Join Voice Channel</span>
            </button>
          ) : (
            <div className="py-2.5 px-5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Your server role does not allow joining voice channels.</span>
            </div>
          )
        ) : (
          <div className="w-full max-w-2xl flex flex-col items-center gap-3">
            {/* Prominent Push-to-Talk Touch & Desktop Button */}
            {voiceSettings.inputMode === 'ptt' && canSpeak && (
              <button
                type="button"
                draggable={false}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // ignore pointer capture fallback
                  }
                  onPttHoldStart();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  try {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                  } catch {
                    // ignore
                  }
                  onPttHoldEnd();
                }}
                onPointerLeave={onPttHoldEnd}
                onPointerCancel={onPttHoldEnd}
                onLostPointerCapture={onPttHoldEnd}
                className={`w-full sm:w-80 min-h-[48px] px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2.5 transition-colors select-none touch-none [-webkit-touch-callout:none] [-webkit-user-select:none] cursor-pointer border ${
                  activeVoice.pttActive
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <Mic className="w-4 h-4 pointer-events-none" />
                <span className="pointer-events-none">
                  {activeVoice.pttActive
                    ? 'Transmitting Audio...'
                    : `Hold to Talk (${formatKeybindLabel(voiceSettings.pttKey)} or Touch)`}
                </span>
              </button>
            )}

            {/* Action Controls */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!canSpeak}
                onClick={onToggleMute}
                title={
                  !canSpeak
                    ? 'Your role cannot speak in voice'
                    : activeVoice.muted
                    ? 'Unmute microphone'
                    : 'Mute microphone'
                }
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                  activeVoice.muted
                    ? 'bg-red-950/70 text-red-300 border-red-900'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border-zinc-800'
                }`}
              >
                {activeVoice.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{activeVoice.muted ? 'Muted' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleDeafen}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer whitespace-nowrap ${
                  activeVoice.deafened
                    ? 'bg-red-950/70 text-red-300 border-red-900'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border-zinc-800'
                }`}
              >
                <Headphones className="w-4 h-4" />
                <span>{activeVoice.deafened ? 'Deafened' : 'Deafen'}</span>
              </button>

              <button
                type="button"
                onClick={isLocalStreamingInRoom ? onStopVoiceStream : onStartVoiceStream}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer whitespace-nowrap ${
                  isLocalStreamingInRoom
                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border-zinc-800'
                }`}
              >
                {isLocalStreamingInRoom ? (
                  <>
                    <MonitorOff className="w-4 h-4" />
                    <span>Stop Stream</span>
                  </>
                ) : (
                  <>
                    <MonitorUp className="w-4 h-4" />
                    <span>Share Screen / Go Live</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenVoiceSettings}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={onLeaveVoice}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
