import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Send,
  Smile,
  Mic,
  Square,
  X,
  Reply,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { ChatMessage, CustomEmoji } from '../types';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';

interface ChatComposerProps {
  placeholder: string;
  replyTarget: ChatMessage | null;
  onCancelReply: () => void;
  disabled?: boolean;
  disabledReason?: string;
  canAttachFiles?: boolean;
  customEmojis?: CustomEmoji[];
  onOpenManageCustomEmojis?: () => void;
  onSend: (payload: {
    content: string;
    attachmentFile?: File | null;
    replyToMessageId?: string;
    audioDurationSec?: number;
  }) => Promise<void>;
  onError: (msg: string) => void;
}

function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(file.name)
  );
}

function isAudioFile(file: File): boolean {
  return (
    file.type.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)
  );
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  placeholder,
  replyTarget,
  onCancelReply,
  disabled = false,
  disabledReason,
  canAttachFiles = true,
  customEmojis = [],
  onOpenManageCustomEmojis,
  onSend,
  onError,
}) => {
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Voice message recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
        setGifOpen(false);
      }
    };
    if (emojiOpen || gifOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [emojiOpen, gifOpen]);

  const setSelectedAttachment = (file: File) => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    setSelectedAttachment(f);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!canAttachFiles) return;
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const f = files[0];
      setSelectedAttachment(f);
      e.preventDefault();
      return;
    }

    // Also inspect clipboardData.items (handles copied browser images & OS screenshots reliably)
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blobFile = item.getAsFile();
          if (blobFile) {
            const ext = blobFile.type.split('/')[1] || 'png';
            const normalized =
              blobFile.name && blobFile.name !== 'image.png'
                ? blobFile
                : new File([blobFile], `pasted_${Date.now()}.${ext}`, {
                    type: blobFile.type || 'image/png',
                  });
            setSelectedAttachment(normalized);
            e.preventDefault();
            return;
          }
        }
      }
    }
  };

  // :shortcode: autocomplete matching while typing
  const shortcodeSuggestions = useMemo(() => {
    if (customEmojis.length === 0) return [];
    const match = /(?:^|\s):([a-zA-Z0-9_]{1,})$/.exec(draft);
    if (!match) return [];
    const term = match[1].toLowerCase();
    return customEmojis.filter((ce) => ce.name.toLowerCase().includes(term)).slice(0, 8);
  }, [draft, customEmojis]);

  const insertCustomEmojiShortcode = (name: string) => {
    setDraft((prev) => {
      if (/(?:^|\s):([a-zA-Z0-9_]{1,})$/.test(prev)) {
        return prev.replace(/(^|\s):[a-zA-Z0-9_]{1,}$/, `$1:${name}: `);
      }
      return `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}:${name}: `;
    });
    inputRef.current?.focus();
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || sending) return;
    if (!draft.trim() && !pendingFile) return;

    setSending(true);
    try {
      await onSend({
        content: draft.trim(),
        attachmentFile: pendingFile,
        replyToMessageId: replyTarget?.id,
      });
      setDraft('');
      clearPendingFile();
      onCancelReply();
      setEmojiOpen(false);
      setGifOpen(false);
    } catch (err: any) {
      onError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const startVoiceRecording = async () => {
    if (disabled || !canAttachFiles) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordChunksRef.current.push(ev.data);
        }
      };

      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      mediaRecorderRef.current = recorder;
      recorder.start();

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
    } catch {
      onError('Microphone permission is required to record a voice message.');
    }
  };

  const stopRecordingCleanup = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordStreamRef.current) {
      recordStreamRef.current.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelVoiceRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    recordChunksRef.current = [];
    stopRecordingCleanup();
  };

  const finishAndSendVoiceRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));

    rec.onstop = async () => {
      const blob = new Blob(recordChunksRef.current, { type: rec.mimeType || 'audio/webm' });
      stopRecordingCleanup();
      if (blob.size === 0) return;

      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const voiceFile = new File([blob], `voice_message_${Date.now()}.${ext}`, {
        type: blob.type || 'audio/webm',
      });
      setSending(true);
      try {
        await onSend({
          content: draft.trim(),
          attachmentFile: voiceFile,
          replyToMessageId: replyTarget?.id,
          audioDurationSec: duration,
        });
        setDraft('');
        onCancelReply();
      } catch (err: any) {
        onError(err?.message || 'Failed to send voice message.');
      } finally {
        setSending(false);
      }
    };

    if (rec.state !== 'inactive') {
      rec.stop();
    }
  };

  const formatTimer = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  if (disabled) {
    return (
      <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60">
        <div className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
          {disabledReason || 'You do not have permission to send messages here.'}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={composerRef}
      className="p-2.5 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-2 relative"
    >
      {/* Reply Target Banner */}
      {replyTarget && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="text-zinc-500 dark:text-zinc-400">Replying to</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {replyTarget.authorName}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Image / Video / GIF / Audio Preview */}
      {pendingPreview && pendingFile && (
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-fit max-w-full">
          {isVideoFile(pendingFile) ? (
            <video
              src={pendingPreview}
              controls
              muted
              playsInline
              className="w-28 h-20 rounded-lg object-cover bg-black border border-zinc-200 dark:border-zinc-700"
            />
          ) : isAudioFile(pendingFile) ? (
            <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
              <Mic className="w-5 h-5" />
            </div>
          ) : (
            <img
              src={pendingPreview}
              alt="Upload preview"
              className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
            />
          )}
          <div className="min-w-0 max-w-[200px]">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {pendingFile.name}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              {isVideoFile(pendingFile) && <Film className="w-3 h-3" />}
              <span>Ready to send</span>
            </p>
          </div>
          <button
            type="button"
            onClick={clearPendingFile}
            className="p-1.5 text-zinc-400 hover:text-red-500 cursor-pointer"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* :shortcode: Autocomplete Bar */}
      {shortcodeSuggestions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1.5 z-30 flex items-center gap-1 overflow-x-auto">
          {shortcodeSuggestions.map((ce) => (
            <button
              key={ce.id}
              type="button"
              onClick={() => insertCustomEmojiShortcode(ce.name)}
              className="px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <img src={ce.url} alt={ce.name} className="w-5 h-5 object-contain" />
              <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200">
                :{ce.name}:
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Searchable Full Emoji Picker Popover */}
      {emojiOpen && (
        <div className="absolute bottom-full right-3 mb-2 z-40">
          <EmojiPicker
            customEmojis={customEmojis}
            onSelectEmoji={(char) => setDraft((prev) => prev + char)}
            onSelectCustomEmoji={(ce) => insertCustomEmojiShortcode(ce.name)}
            onManageCustomEmojis={onOpenManageCustomEmojis}
            onClose={() => setEmojiOpen(false)}
          />
        </div>
      )}

      {/* Searchable GIF Picker Popover */}
      {gifOpen && (
        <div className="absolute bottom-full right-3 mb-2 z-40">
          <GifPicker
            onSelectGif={(file) => setSelectedAttachment(file)}
            onClose={() => setGifOpen(false)}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,image/gif"
        onChange={handleFilePick}
        className="hidden"
      />

      {isRecording ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-950 text-white border border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold">Recording voice message</span>
            <span className="text-xs font-mono tabular-nums text-zinc-300">
              {formatTimer(recordSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelVoiceRecording}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={finishAndSendVoiceRecording}
              className="px-3.5 py-1.5 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSendSubmit}
          className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus-within:border-zinc-900 dark:focus-within:border-zinc-500 transition-colors"
        >
          {canAttachFiles && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image, video, or GIF"
              className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder}
            className="flex-1 min-w-0 px-2 py-1.5 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
          />

          {canAttachFiles && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Image or Video"
                className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white items-center justify-center shrink-0 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGifOpen((v) => !v);
                  setEmojiOpen(false);
                }}
                title="Browse GIFs"
                className={`px-2 h-8 rounded-md text-[10px] font-extrabold tracking-tight shrink-0 cursor-pointer transition-colors ${
                  gifOpen
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                GIF
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setEmojiOpen((v) => !v);
              setGifOpen(false);
            }}
            title="Emoji & Custom Server Emojis"
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              emojiOpen
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          {canAttachFiles && (
            <button
              type="button"
              onClick={startVoiceRecording}
              title="Record Voice Message"
              className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={sending || (!draft.trim() && !pendingFile)}
            className="min-h-[36px] py-1.5 px-3 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-35 text-white dark:text-zinc-950 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      )}
    </div>
  );
};

