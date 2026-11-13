import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Type,
  Maximize2,
  RotateCcw,
  Check,
  Mic,
  Volume2,
  Bell,
  LogOut,
  Keyboard,
  Shield,
} from 'lucide-react';
import { UserPreferences, VoiceSettings } from '../types';
import { formatKeybindLabel } from '../utils/permissions';

interface SettingsViewProps {
  preferences: UserPreferences;
  onUpdatePreferences: (next: UserPreferences) => void;
  onResetDefaults: () => void;
  onSignOut: () => void;
  focusSection?: 'appearance' | 'voice';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  onResetDefaults,
  onSignOut,
  focusSection = 'appearance',
}) => {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [capturingPttKey, setCapturingPttKey] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      })
      .catch(() => {
        // Ignore device enumeration permission blocks
      });
  }, []);

  useEffect(() => {
    if (!capturingPttKey) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturingPttKey(false);
        return;
      }
      onUpdatePreferences({
        ...preferences,
        voice: { ...preferences.voice, pttKey: e.code },
      });
      setCapturingPttKey(false);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [capturingPttKey, preferences, onUpdatePreferences]);

  useEffect(() => {
    if (focusSection === 'voice') {
      document.getElementById('voice-settings-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [focusSection]);

  const updateVoice = (patch: Partial<VoiceSettings>) => {
    onUpdatePreferences({
      ...preferences,
      voice: { ...preferences.voice, ...patch },
    });
  };

  const fontSizes: Array<{ id: UserPreferences['fontSize']; label: string; sample: string }> = [
    { id: 'compact', label: 'Small (14px)', sample: '14px' },
    { id: 'standard', label: 'Default (16px)', sample: '16px' },
    { id: 'large', label: 'Large (18px)', sample: '18px' },
    { id: 'xlarge', label: 'Extra Large (20px)', sample: '20px' },
  ];

  const letterSpacings: Array<{ id: UserPreferences['letterSpacing']; label: string; desc: string }> = [
    { id: 'tight', label: 'Tight', desc: '-0.015em' },
    { id: 'normal', label: 'Normal', desc: '0em' },
    { id: 'relaxed', label: 'Relaxed', desc: '+0.02em' },
    { id: 'wide', label: 'Wide', desc: '+0.05em' },
  ];

  const contentSpacings: Array<{ id: UserPreferences['contentSpacing']; label: string; desc: string }> = [
    { id: 'compact', label: 'Compact', desc: 'Tighter cards & gaps' },
    { id: 'comfortable', label: 'Comfortable', desc: 'Balanced layout' },
    { id: 'spacious', label: 'Spacious', desc: 'Extra breathing room' },
  ];

  return (
    <div className="max-w-3xl mx-auto pilgrim-stack">
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-950 dark:text-zinc-50">
            Settings
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Customize appearance, voice & audio devices, notifications, and your account session.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="py-2 px-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </section>

      {/* Theme Mode (Light / Dark Mode) */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            {preferences.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
              Theme
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Choose between Light Mode or Dark Mode.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onUpdatePreferences({ ...preferences, theme: 'light' })}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              preferences.theme === 'light'
                ? 'border-zinc-950 bg-zinc-50 dark:bg-zinc-800 dark:border-white'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-950">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-950 dark:text-zinc-100">Light Mode</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">White & light gray canvas</p>
              </div>
            </div>
            {preferences.theme === 'light' && <Check className="w-4 h-4 text-zinc-950 dark:text-white" />}
          </button>

          <button
            type="button"
            onClick={() => onUpdatePreferences({ ...preferences, theme: 'dark' })}
            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              preferences.theme === 'dark'
                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <p
                  className={`text-xs font-bold ${
                    preferences.theme === 'dark' ? 'text-white' : 'text-zinc-950 dark:text-zinc-100'
                  }`}
                >
                  Dark Mode
                </p>
                <p
                  className={`text-[11px] ${
                    preferences.theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Obsidian black & slate
                </p>
              </div>
            </div>
            {preferences.theme === 'dark' && <Check className="w-4 h-4 text-white" />}
          </button>
        </div>
      </section>

      {/* Voice & Audio Settings */}
      <section
        id="voice-settings-section"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad space-y-5"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
              Voice & Audio
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configure input/output devices, Push-to-Talk keybind, mic sensitivity, and noise filters.
            </p>
          </div>
        </div>

        {/* Input / Output Devices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Input Device (Microphone)
            </label>
            <select
              value={preferences.voice.inputDeviceId || ''}
              onChange={(e) => updateVoice({ inputDeviceId: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Default System Microphone</option>
              {audioInputs.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Output Device (Speakers / Headset)
            </label>
            <select
              value={preferences.voice.outputDeviceId || ''}
              onChange={(e) => updateVoice({ outputDeviceId: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Default System Output</option>
              {audioOutputs.map((d, idx) => (
                <option key={d.deviceId || idx} value={d.deviceId}>
                  {d.label || `Speaker ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Mode: Voice Activity vs Push to Talk */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Input Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateVoice({ inputMode: 'vad' })}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                preferences.voice.inputMode === 'vad'
                  ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                  : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <p className="text-xs font-bold">Voice Activity</p>
              <p className="text-[11px] opacity-75 mt-0.5">
                Automatically transmits when you speak above threshold.
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateVoice({ inputMode: 'ptt' })}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                preferences.voice.inputMode === 'ptt'
                  ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                  : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <p className="text-xs font-bold">Push to Talk</p>
              <p className="text-[11px] opacity-75 mt-0.5">
                Hold your keybind on desktop or Hold to Talk button on mobile.
              </p>
            </button>
          </div>

          {preferences.voice.inputMode === 'ptt' && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-zinc-500" />
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Desktop Push-to-Talk Shortcut
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Hold this key while connected to a voice channel (or press the touch button on mobile).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCapturingPttKey(true)}
                className={`py-2 px-3.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  capturingPttKey
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 animate-pulse'
                    : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {capturingPttKey
                  ? 'Press any key...'
                  : formatKeybindLabel(preferences.voice.pttKey)}
              </button>
            </div>
          )}
        </div>

        {/* Volume & Sensitivity Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Input Volume</span>
              <span className="font-mono tabular-nums text-zinc-500">
                {preferences.voice.inputVolume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={preferences.voice.inputVolume}
              onChange={(e) => updateVoice({ inputVolume: Number(e.target.value) })}
              className="w-full accent-zinc-950 dark:accent-white cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Output Volume</span>
              <span className="font-mono tabular-nums text-zinc-500">
                {preferences.voice.outputVolume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={preferences.voice.outputVolume}
              onChange={(e) => updateVoice({ outputVolume: Number(e.target.value) })}
              className="w-full accent-zinc-950 dark:accent-white cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Mic Sensitivity</span>
              <span className="font-mono tabular-nums text-zinc-500">
                {preferences.voice.sensitivity}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={95}
              value={preferences.voice.sensitivity}
              onChange={(e) => updateVoice({ sensitivity: Number(e.target.value) })}
              className="w-full accent-zinc-950 dark:accent-white cursor-pointer"
            />
          </div>
        </div>

        {/* Audio Processing Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => updateVoice({ noiseSuppression: !preferences.voice.noiseSuppression })}
            className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Noise Suppression</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Reduce background fan & keyboard noise</p>
            </div>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                preferences.voice.noiseSuppression ? 'bg-zinc-950 dark:bg-white justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white dark:bg-zinc-950 block" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => updateVoice({ echoCancellation: !preferences.voice.echoCancellation })}
            className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Echo Cancellation</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Prevent speaker audio from looping</p>
            </div>
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                preferences.voice.echoCancellation ? 'bg-zinc-950 dark:bg-white justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white dark:bg-zinc-950 block" />
            </span>
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
                Status & Desktop Notifications
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Do Not Disturb automatically mutes notification popups and sounds.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdatePreferences({
                ...preferences,
                notificationSound: !preferences.notificationSound,
              })
            }
            className="flex items-center gap-2 cursor-pointer"
            aria-label="Toggle notification sound"
          >
            <Volume2 className="w-4 h-4 text-zinc-500" />
            <span
              className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                preferences.notificationSound
                  ? 'bg-zinc-950 dark:bg-white justify-end'
                  : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white dark:bg-zinc-950 block" />
            </span>
          </button>
        </div>
      </section>

      {/* Letter Sizing */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            <Type className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
              Letter Sizing
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Scale text size across posts, chat channels, and menus.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {fontSizes.map((opt) => {
            const active = preferences.fontSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdatePreferences({ ...preferences, fontSize: opt.id })}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                }`}
              >
                <span className="font-mono text-xs font-bold block">{opt.sample}</span>
                <span className="text-[11px] opacity-80 block mt-0.5">{opt.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Spaces (Letter Tracking & Layout Density) */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
              Spaces & Layout Density
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Adjust both spacing between letters and padding between cards.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Letter Spacing
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {letterSpacings.map((opt) => {
              const active = preferences.letterSpacing === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ ...preferences, letterSpacing: opt.id })}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[11px] font-mono opacity-75 block mt-0.5">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Interface Spacing
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {contentSpacings.map((opt) => {
              const active = preferences.contentSpacing === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ ...preferences, contentSpacing: opt.id })}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className="text-[11px] opacity-75 block mt-0.5">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Account Session & Sign Out */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-zinc-50">
              Account Session
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sign out of your Pilgrim account on this device.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="py-2.5 px-5 bg-zinc-950 hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-600 dark:hover:text-white text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </section>
    </div>
  );
};
