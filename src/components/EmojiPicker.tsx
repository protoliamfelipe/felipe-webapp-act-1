import React, { useMemo, useState } from 'react';
import { Search, Sparkles, Clock, Plus } from 'lucide-react';
import { CustomEmoji } from '../types';
import {
  ALL_EMOJIS,
  EMOJI_CATEGORIES,
  encodeCustomEmojiReaction,
  getRecentEmojis,
  pushRecentEmoji,
} from '../utils/emojiMedia';

interface EmojiPickerProps {
  onSelectEmoji: (emojiToken: string) => void;
  onSelectCustomEmoji?: (emoji: CustomEmoji) => void;
  customEmojis?: CustomEmoji[];
  onManageCustomEmojis?: () => void;
  onClose?: () => void;
  className?: string;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectEmoji,
  onSelectCustomEmoji,
  customEmojis = [],
  onManageCustomEmojis,
  onClose,
  className = '',
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(
    customEmojis.length > 0 ? 'custom' : 'all'
  );
  const [recents, setRecents] = useState<string[]>(() => getRecentEmojis());

  const query = search.trim().toLowerCase().replace(/^:/, '').replace(/:$/, '');

  const filteredCustom = useMemo(() => {
    if (!query) return customEmojis;
    return customEmojis.filter((e) => e.name.toLowerCase().includes(query));
  }, [customEmojis, query]);

  const searchResults = useMemo(() => {
    if (!query) return [];
    return ALL_EMOJIS.filter(
      (e) => e.name.toLowerCase().includes(query) || e.char.includes(query)
    );
  }, [query]);

  const handlePickUnicode = (char: string) => {
    const next = pushRecentEmoji(char);
    setRecents(next);
    onSelectEmoji(char);
    onClose?.();
  };

  const handlePickCustom = (emoji: CustomEmoji) => {
    if (onSelectCustomEmoji) {
      onSelectCustomEmoji(emoji);
    } else {
      onSelectEmoji(encodeCustomEmojiReaction(emoji));
    }
    onClose?.();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`w-[320px] sm:w-[344px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Search Bar */}
      <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all emojis or :custom:..."
            autoFocus
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white"
          />
        </div>
      </div>

      {/* Category Strip */}
      {!query && (
        <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-1 overflow-x-auto bg-zinc-50/70 dark:bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            title="All Emojis"
            className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer transition-colors ${
              activeCategory === 'all'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('recent')}
            title="Recently Used"
            className={`p-1.5 rounded-md shrink-0 cursor-pointer transition-colors ${
              activeCategory === 'recent'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          {(customEmojis.length > 0 || onManageCustomEmojis) && (
            <button
              type="button"
              onClick={() => setActiveCategory('custom')}
              title="Server Custom Emojis"
              className={`p-1.5 rounded-md shrink-0 cursor-pointer transition-colors ${
                activeCategory === 'custom'
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              title={cat.label}
              className={`px-1.5 py-1 rounded-md text-sm leading-none shrink-0 cursor-pointer transition-colors ${
                activeCategory === cat.id
                  ? 'bg-zinc-950 dark:bg-white'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Emoji Body */}
      <div className="h-72 overflow-y-auto p-2.5 space-y-3">
        {query ? (
          <>
            {filteredCustom.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1.5">
                  Custom Emojis
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {filteredCustom.map((ce) => (
                    <button
                      key={ce.id}
                      type="button"
                      onClick={() => handlePickCustom(ce)}
                      title={`:${ce.name}:`}
                      className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center p-1 cursor-pointer"
                    >
                      <img
                        src={ce.url}
                        alt={`:${ce.name}:`}
                        className="w-7 h-7 object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1.5">
                Matching Emojis ({searchResults.length})
              </p>
              {searchResults.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-8">
                  No emojis matched "{search}".
                </p>
              ) : (
                <div className="grid grid-cols-8 gap-1">
                  {searchResults.map((entry, idx) => (
                    <button
                      key={`${entry.char}_${idx}`}
                      type="button"
                      onClick={() => handlePickUnicode(entry.char)}
                      title={entry.name}
                      className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xl leading-none cursor-pointer"
                    >
                      {entry.char}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Custom Server Emojis */}
            {(activeCategory === 'all' || activeCategory === 'custom') &&
              (customEmojis.length > 0 || onManageCustomEmojis) && (
                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Server Custom Emojis ({customEmojis.length})
                    </p>
                    {onManageCustomEmojis && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose?.();
                          onManageCustomEmojis();
                        }}
                        className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Upload
                      </button>
                    )}
                  </div>
                  {customEmojis.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 px-1 py-2">
                      No custom emojis yet. Upload PNG or animated GIF emojis in Server Settings!
                    </p>
                  ) : (
                    <div className="grid grid-cols-8 gap-1">
                      {customEmojis.map((ce) => (
                        <button
                          key={ce.id}
                          type="button"
                          onClick={() => handlePickCustom(ce)}
                          title={`:${ce.name}:${ce.animated ? ' (GIF)' : ''}`}
                          className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center p-1 cursor-pointer relative"
                        >
                          <img
                            src={ce.url}
                            alt={`:${ce.name}:`}
                            className="w-7 h-7 object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Recently Used */}
            {(activeCategory === 'all' || activeCategory === 'recent') && recents.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1.5">
                  Frequently Used
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {recents.map((char) => (
                    <button
                      key={`recent_${char}`}
                      type="button"
                      onClick={() => handlePickUnicode(char)}
                      className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xl leading-none cursor-pointer"
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Unicode Emojis */}
            {EMOJI_CATEGORIES.filter(
              (cat) => activeCategory === 'all' || activeCategory === cat.id
            ).map((cat) => (
              <div key={cat.id}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1.5">
                  {cat.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((entry, idx) => (
                    <button
                      key={`${cat.id}_${idx}`}
                      type="button"
                      onClick={() => handlePickUnicode(entry.char)}
                      title={entry.name}
                      className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-xl leading-none cursor-pointer"
                    >
                      {entry.char}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
