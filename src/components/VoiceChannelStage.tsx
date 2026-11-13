import React from 'react';
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
} from 'lucide-react';
import { Channel, Server, VoiceParticipant, VoiceSettings } from '../types';
import { ActiveVoiceInfo } from './Sidebar';
import { formatKeybindLabel } from '../utils/permissions';
import { makeInitialsAvatar } from '../utils/avatars';

interface VoiceChannelStageProps {
  channel: Channel;
  server: Server;
  participants: VoiceParticipant[];
  activeVoice: ActiveVoiceInfo | null;
  voiceSettings: VoiceSettings;
  canConnect: boolean;
  canSpeak: boolean;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onPttHoldStart: () => void;
  onPttHoldEnd: () => void;
  onSwitchInputMode: (mode: 'vad' | 'ptt') => void;
  onOpenVoiceSettings: () => void;
  onSwitchToTextChannel: () => void;
  onOpenProfile: (userId: string) => void;
}

export const VoiceChannelStage: React.FC<VoiceChannelStageProps> = ({
  channel,
  server,
  participants,
  activeVoice,
  voiceSettings,
  canConnect,
  canSpeak,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onPttHoldStart,
  onPttHoldEnd,
  onSwitchInputMode,
  onOpenVoiceSettings,
  onSwitchToTextChannel,
  onOpenProfile,
}) => {
  const isConnectedHere =
    activeVoice?.serverId === server.id && activeVoice?.channelId === channel.id;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="h-14 px-5 border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Volume2 className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="font-display text-sm font-bold text-white truncate">
            {channel.name}
          </span>
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
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-6">
        {participants.length === 0 ? (
          <div className="text-center max-w-md space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-300">
              <Volume2 className="w-7 h-7" />
            </div>
            <h3 className="font-display text-lg font-bold text-white">
              {channel.name}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No one is currently in this voice channel. Join now to talk with server members using Voice Activity or Push to Talk.
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
                return (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => onOpenProfile(p.userId)}
                    className={`p-5 rounded-2xl bg-zinc-900 border transition-all flex flex-col items-center gap-3 text-center cursor-pointer ${
                      isSpeaking
                        ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={p.userAvatar}
                        alt={p.userName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = makeInitialsAvatar(p.userName);
                        }}
                        className={`w-16 h-16 rounded-full object-cover border-2 transition-colors ${
                          isSpeaking ? 'border-emerald-400' : 'border-zinc-700'
                        }`}
                      />
                      {(p.muted || p.deafened) && (
                        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center text-red-400">
                          {p.muted ? <MicOff className="w-3 h-3" /> : <Volume2 className="w-3 h-3 opacity-60" />}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 w-full">
                      <p className="text-xs font-bold text-white truncate">{p.userName}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {p.deafened
                          ? 'Deafened'
                          : p.muted
                          ? 'Muted'
                          : isSpeaking
                          ? 'Speaking'
                          : 'Listening'}
                      </p>
                    </div>
                  </button>
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
          <div className="w-full max-w-xl flex flex-col items-center gap-3">
            {/* Prominent Push-to-Talk Touch & Desktop Button */}
            {voiceSettings.inputMode === 'ptt' && canSpeak && (
              <button
                type="button"
                onPointerDown={onPttHoldStart}
                onPointerUp={onPttHoldEnd}
                onPointerLeave={onPttHoldEnd}
                onPointerCancel={onPttHoldEnd}
                className={`w-full sm:w-80 min-h-[48px] px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2.5 transition-colors select-none touch-none cursor-pointer border ${
                  activeVoice.pttActive
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>
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
