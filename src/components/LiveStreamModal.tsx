import React, { useState, useEffect, useRef } from 'react';
import { Radio, Camera, MonitorUp, X, VideoOff, Globe, Users, Lock } from 'lucide-react';
import { Visibility } from '../types';

interface LiveStreamModalProps {
  isOpen: boolean;
  defaultSource?: 'camera' | 'screen';
  contextLabel?: string;
  allowFeedAnnouncement?: boolean;
  isCurrentlyStreaming: boolean;
  activeStreamTitle?: string;
  localVideoStream: MediaStream | null;
  onClose: () => void;
  onStartStream: (options: {
    source: 'camera' | 'screen';
    title: string;
    announceToFeed?: boolean;
    announceVisibility?: Visibility;
  }) => Promise<void>;
  onStopStream: () => Promise<void>;
}

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({
  isOpen,
  defaultSource = 'camera',
  contextLabel = 'Profile Live Stream',
  allowFeedAnnouncement = true,
  isCurrentlyStreaming,
  activeStreamTitle,
  localVideoStream,
  onClose,
  onStartStream,
  onStopStream,
}) => {
  const [source, setSource] = useState<'camera' | 'screen'>(defaultSource);
  const [title, setTitle] = useState(activeStreamTitle || '');
  const [announceToFeed, setAnnounceToFeed] = useState(true);
  const [announceVisibility, setAnnounceVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSource(defaultSource);
      setTitle(activeStreamTitle || '');
      setErrorMsg(null);
    }
  }, [isOpen, defaultSource, activeStreamTitle]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localVideoStream || null;
    }
  }, [localVideoStream, isOpen]);

  if (!isOpen) return null;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onStartStream({
        source,
        title: title.trim() || 'Live Stream',
        announceToFeed: allowFeedAnnouncement ? announceToFeed : false,
        announceVisibility,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to start stream. Please allow camera or screen capture access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async () => {
    setSubmitting(true);
    try {
      await onStopStream();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                {isCurrentlyStreaming ? 'Live Broadcast Active' : 'Go Live'}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{contextLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {isCurrentlyStreaming && localVideoStream ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black border border-red-500/50 aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                    {activeStreamTitle || 'Live Stream'}
                  </p>
                  <p className="text-[11px] text-red-500 font-medium">
                    A red live ring is active around your profile photo.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleStop}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Ending...' : 'End Live Stream'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleStart} className="space-y-4">
              {/* Source Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Broadcast Source
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSource('camera')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                      source === 'camera'
                        ? 'bg-red-500/10 border-red-500 text-zinc-950 dark:text-white'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    <Camera className={`w-4 h-4 shrink-0 ${source === 'camera' ? 'text-red-500' : ''}`} />
                    <div>
                      <p className="text-xs font-bold">Camera</p>
                      <p className="text-[10px] opacity-75">Webcam & mic</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSource('screen')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                      source === 'screen'
                        ? 'bg-red-500/10 border-red-500 text-zinc-950 dark:text-white'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    <MonitorUp className={`w-4 h-4 shrink-0 ${source === 'screen' ? 'text-red-500' : ''}`} />
                    <div>
                      <p className="text-xs font-bold">Screen Share</p>
                      <p className="text-[10px] opacity-75">Game, app, or tab</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Stream Title
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you streaming right now?"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              {allowFeedAnnouncement && (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                        Share live notice to your Feed
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Let friends see when your broadcast starts.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={announceToFeed}
                      onChange={(e) => setAnnounceToFeed(e.target.checked)}
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                    />
                  </label>

                  {announceToFeed && (
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 w-fit">
                      {[
                        { id: 'public' as Visibility, label: 'Public', icon: Globe },
                        { id: 'friends' as Visibility, label: 'Friends', icon: Users },
                        { id: 'private' as Visibility, label: 'Only Me', icon: Lock },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAnnounceVisibility(opt.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                              announceVisibility === opt.id
                                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Starting...' : 'Go Live Now'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
