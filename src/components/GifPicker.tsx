import React, { useEffect, useRef, useState } from 'react';
import { Search, Upload, X, Loader2 } from 'lucide-react';
import { GifItem } from '../types';
import { api } from '../services/api';
import { gifItemToFile, getBuiltInGifCatalog } from '../utils/gifLibrary';

interface GifPickerProps {
  onSelectGif: (file: File, title: string) => void;
  onClose: () => void;
  className?: string;
}

const GIF_CATEGORIES = ['All', 'Trending', 'Gaming', 'Reactions', 'Celebrate', 'Memes'];

export const GifPicker: React.FC<GifPickerProps> = ({
  onSelectGif,
  onClose,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [gifs, setGifs] = useState<GifItem[]>(() => getBuiltInGifCatalog(false));
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.searchGifs(query, category);
        if (active) setGifs(res.gifs);
      } catch {
        // Keep current list on transient error
      } finally {
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, category]);

  const handleChooseGif = async (item: GifItem) => {
    setPickingId(item.id);
    try {
      let file: File;
      if (!item.id.startsWith('tenor_')) {
        file = gifItemToFile(item);
      } else {
        const res = await fetch(item.url);
        const blob = await res.blob();
        file = new File([blob], `${item.id}.gif`, { type: 'image/gif' });
      }
      onSelectGif(file, item.title);
      onClose();
    } catch {
      // Fallback: if external fetch blocked by CORS, ignore cleanly
    } finally {
      setPickingId(null);
    }
  };

  const handleUploadDeviceGif = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectGif(file, file.name);
      onClose();
    }
    e.target.value = '';
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-[320px] sm:w-[372px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Header + Search */}
      <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            GIFs
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GIF picker"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search animated GIFs..."
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {GIF_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
                category === cat
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable GIF Grid */}
      <div className="h-64 overflow-y-auto p-2.5">
        {loading && gifs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading GIFs...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              No matching GIFs found
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Try another keyword or upload a GIF directly from your device.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleChooseGif(gif)}
                disabled={pickingId === gif.id}
                className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:ring-2 hover:ring-zinc-950 dark:hover:ring-white cursor-pointer text-left"
              >
                <img
                  src={gif.url}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] font-semibold text-white truncate">{gif.title}</p>
                </div>
                {pickingId === gif.id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Upload GIF from Device Footer */}
      <div className="px-2.5 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">Pick a GIF or upload your own</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
        >
          <Upload className="w-3 h-3" />
          <span>Upload GIF</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/gif,.gif"
          onChange={handleUploadDeviceGif}
          className="hidden"
        />
      </div>
    </div>
  );
};
