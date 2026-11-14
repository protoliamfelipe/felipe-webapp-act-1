import { GifItem } from '../types';

/**
 * Pure TypeScript multi-frame GIF89a generator.
 * Produces real looping animated .gif byte streams with zero external dependencies,
 * guaranteeing that GIF search/scroll and sending work 100% reliably even offline.
 */

interface GifSceneSpec {
  id: string;
  title: string;
  category: 'Trending' | 'Gaming' | 'Reactions' | 'Celebrate' | 'Memes';
  tags: string[];
  palette: [number, number, number][]; // Up to 16 colors (index 0 = bg)
  drawFrame: (
    ctx: { setPixel: (x: number, y: number, c: number) => void; rect: (x: number, y: number, w: number, h: number, c: number) => void; circle: (cx: number, cy: number, r: number, c: number) => void },
    frame: number,
    totalFrames: number,
    w: number,
    h: number
  ) => void;
}

function encodeGif89a(
  width: number,
  height: number,
  palette: [number, number, number][],
  frames: Uint8Array[],
  delayCs = 8
): Uint8Array {
  const bytes: number[] = [];
  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  };
  const pushU16 = (n: number) => {
    bytes.push(n & 0xff, (n >> 8) & 0xff);
  };

  // Pad palette to 16 colors (4 bits/pixel, LZW minCodeSize = 4)
  const pal: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    pal.push(palette[i] || [0, 0, 0]);
  }

  // Header
  pushStr('GIF89a');
  // Logical Screen Descriptor
  pushU16(width);
  pushU16(height);
  bytes.push(0b10110011); // Global Color Table flag=1, color res=3, sort=0, size=3 (2^(3+1)=16 colors)
  bytes.push(0); // bg color idx
  bytes.push(0); // aspect ratio

  // Global Color Table (16 * 3 = 48 bytes)
  for (const [r, g, b] of pal) {
    bytes.push(r & 0xff, g & 0xff, b & 0xff);
  }

  // Netscape 2.0 Application Extension for infinite looping
  bytes.push(0x21, 0xff, 0x0b);
  pushStr('NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  // Uncompressed LZW framing for 4-bit palette (code width = 5 bits)
  // Clear code = 16, EOI code = 17. Reset every 12 codes so 5 bits always suffices!
  const packFrameData = (pixels: Uint8Array): number[] => {
    const out: number[] = [];
    let bitBuf = 0;
    let bitCount = 0;
    const writeBits = (val: number, len: number) => {
      bitBuf |= val << bitCount;
      bitCount += len;
      while (bitCount >= 8) {
        out.push(bitBuf & 0xff);
        bitBuf >>= 8;
        bitCount -= 8;
      }
    };

    writeBits(16, 5); // Clear code
    let countSinceClear = 0;
    for (let i = 0; i < pixels.length; i++) {
      writeBits(pixels[i] & 0x0f, 5);
      countSinceClear++;
      if (countSinceClear >= 12) {
        writeBits(16, 5);
        countSinceClear = 0;
      }
    }
    writeBits(17, 5); // EOI
    if (bitCount > 0) out.push(bitBuf & 0xff);
    return out;
  };

  for (const frame of frames) {
    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04, 0x04);
    pushU16(delayCs);
    bytes.push(0x00, 0x00);

    // Image Descriptor
    bytes.push(0x2c);
    pushU16(0);
    pushU16(0);
    pushU16(width);
    pushU16(height);
    bytes.push(0x00);

    // Image Data (LZW min code size = 4)
    bytes.push(4);
    const lzwBytes = packFrameData(frame);
    for (let i = 0; i < lzwBytes.length; i += 255) {
      const chunk = lzwBytes.slice(i, i + 255);
      bytes.push(chunk.length);
      for (const b of chunk) bytes.push(b);
    }
    bytes.push(0x00); // Block terminator
  }

  // Trailer
  bytes.push(0x3b);
  return new Uint8Array(bytes);
}

const W = 72;
const H = 54;

function buildGifBytes(spec: GifSceneSpec): Uint8Array {
  const totalFrames = 10;
  const frames: Uint8Array[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const px = new Uint8Array(W * H);
    const setPixel = (x: number, y: number, c: number) => {
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (rx >= 0 && rx < W && ry >= 0 && ry < H) {
        px[ry * W + rx] = c & 0x0f;
      }
    };
    const rect = (x: number, y: number, rw: number, rh: number, c: number) => {
      for (let yy = Math.floor(y); yy < Math.ceil(y + rh); yy++) {
        for (let xx = Math.floor(x); xx < Math.ceil(x + rw); xx++) {
          setPixel(xx, yy, c);
        }
      }
    };
    const circle = (cx: number, cy: number, r: number, c: number) => {
      const r2 = r * r;
      for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
        for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
          if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r2) {
            setPixel(xx, yy, c);
          }
        }
      }
    };

    spec.drawFrame({ setPixel, rect, circle }, f, totalFrames, W, H);
    frames.push(px);
  }

  return encodeGif89a(W, H, spec.palette, frames, 9);
}

// 5x7 crisp pixel font helper for animated GIF captions ("GG", "LOL", "HYPE", "WIN", "NO", "YES", "OMG", "BRB")
const PIXEL_FONT: Record<string, string[]> = {
  G: ['01110', '10000', '10000', '10111', '10001', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
};

function drawWord(
  rect: (x: number, y: number, w: number, h: number, c: number) => void,
  word: string,
  cx: number,
  cy: number,
  scale: number,
  color: number
) {
  const chars = word.toUpperCase().split('');
  const totalW = chars.length * 6 * scale - scale;
  const startX = Math.round(cx - totalW / 2);
  const startY = Math.round(cy - (7 * scale) / 2);
  chars.forEach((ch, idx) => {
    const glyph = PIXEL_FONT[ch];
    if (!glyph) return;
    glyph.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === '1') {
          rect(startX + (idx * 6 + rx) * scale, startY + ry * scale, scale, scale, color);
        }
      }
    });
  });
}

export const GIF_SCENES: GifSceneSpec[] = [
  {
    id: 'gg_bounce',
    title: 'GG Well Played',
    category: 'Gaming',
    tags: ['gg', 'gaming', 'win', 'good game', 'victory'],
    palette: [
      [14, 16, 26],
      [255, 255, 255],
      [52, 211, 153],
      [16, 185, 129],
      [250, 204, 21],
    ],
    drawFrame: (ctx, f, total) => {
      const t = (f / total) * Math.PI * 2;
      const dy = Math.round(Math.sin(t) * 4);
      ctx.rect(4, 4, W - 8, H - 8, 3);
      ctx.rect(6, 6, W - 12, H - 12, 0);
      drawWord(ctx.rect, 'GG!', W / 2, H / 2 + dy, 3, 2);
      ctx.circle(14, 14 + Math.cos(t) * 3, 2, 4);
      ctx.circle(W - 14, H - 14 - Math.cos(t) * 3, 2, 4);
    },
  },
  {
    id: 'hype_fire',
    title: 'Hype Fire',
    category: 'Trending',
    tags: ['fire', 'hype', 'lit', 'hot', 'flame'],
    palette: [
      [18, 10, 10],
      [255, 255, 255],
      [239, 68, 68],
      [249, 115, 22],
      [250, 204, 21],
    ],
    drawFrame: (ctx, f, total) => {
      const t = (f / total) * Math.PI * 2;
      for (let i = 0; i < 6; i++) {
        const fx = 12 + i * 10 + Math.sin(t + i) * 2;
        const fy = 36 - ((f * 4 + i * 7) % 24);
        ctx.circle(fx, fy, 4, (i % 3) + 2);
      }
      ctx.circle(W / 2, 34, 13, 2);
      ctx.circle(W / 2 + Math.sin(t) * 2, 30, 9, 3);
      ctx.circle(W / 2 - Math.cos(t) * 2, 33, 5, 4);
      drawWord(ctx.rect, 'HYPE', W / 2, 16, 2, 1);
    },
  },
  {
    id: 'party_confetti',
    title: 'Party Confetti',
    category: 'Celebrate',
    tags: ['party', 'celebrate', 'confetti', 'happy', 'birthday', 'yay'],
    palette: [
      [15, 15, 28],
      [255, 255, 255],
      [244, 63, 94],
      [56, 189, 248],
      [250, 204, 21],
      [168, 85, 247],
      [52, 211, 153],
    ],
    drawFrame: (ctx, f, total) => {
      for (let i = 0; i < 18; i++) {
        const x = (i * 17 + f * 3) % W;
        const y = (i * 11 + f * 5) % H;
        ctx.rect(x, y, 3, 3, (i % 5) + 2);
      }
      const bob = f % 2 === 0 ? -1 : 1;
      drawWord(ctx.rect, 'WIN!', W / 2, H / 2 + bob, 3, 1);
    },
  },
  {
    id: 'heart_pulse',
    title: 'Love Pulse',
    category: 'Reactions',
    tags: ['love', 'heart', 'cute', 'like', 'adorable'],
    palette: [
      [24, 10, 18],
      [255, 255, 255],
      [244, 63, 94],
      [251, 113, 133],
      [253, 164, 175],
    ],
    drawFrame: (ctx, f, total) => {
      const pulse = Math.sin((f / total) * Math.PI * 2) > 0 ? 1.2 : 1.0;
      const r = Math.round(9 * pulse);
      const cx = W / 2;
      const cy = H / 2 - 2;
      ctx.circle(cx - r * 0.6, cy - 3, r * 0.75, 2);
      ctx.circle(cx + r * 0.6, cy - 3, r * 0.75, 2);
      for (let y = 0; y < r * 1.4; y++) {
        const w = Math.max(1, (r * 1.35 - y) * 1.05);
        ctx.rect(cx - w, cy + y - 2, w * 2, 2, 2);
      }
      ctx.circle(cx - 5, cy - 5, 2, 4);
      ctx.circle(12 + ((f * 6) % 48), 10, 1.5, 3);
      ctx.circle(W - 12 - ((f * 6) % 48), H - 10, 1.5, 3);
    },
  },
  {
    id: 'lol_laugh',
    title: 'LOL Laughing',
    category: 'Reactions',
    tags: ['lol', 'laugh', 'funny', 'lmao', 'haha'],
    palette: [
      [16, 16, 20],
      [255, 255, 255],
      [250, 204, 21],
      [245, 158, 11],
      [56, 189, 248],
    ],
    drawFrame: (ctx, f, total) => {
      const tilt = Math.round(Math.sin((f / total) * Math.PI * 4) * 3);
      ctx.circle(W / 2, H / 2 + tilt, 16, 2);
      ctx.rect(W / 2 - 7, H / 2 - 6 + tilt, 4, 2, 0);
      ctx.rect(W / 2 + 3, H / 2 - 6 + tilt, 4, 2, 0);
      ctx.rect(W / 2 - 7, H / 2 + 2 + tilt, 14, 7, 0);
      ctx.rect(W / 2 - 5, H / 2 + 3 + tilt, 10, 2, 1);
      // Tears
      ctx.circle(W / 2 - 12, H / 2 + (f % 4) * 2, 2, 4);
      ctx.circle(W / 2 + 12, H / 2 + (f % 4) * 2, 2, 4);
      drawWord(ctx.rect, 'LOL', 15, 10, 1, 1);
    },
  },
  {
    id: 'mind_blown',
    title: 'OMG Mind Blown',
    category: 'Memes',
    tags: ['omg', 'wow', 'shock', 'whoa', 'meme'],
    palette: [
      [18, 14, 28],
      [255, 255, 255],
      [168, 85, 247],
      [236, 72, 153],
      [250, 204, 21],
    ],
    drawFrame: (ctx, f, total) => {
      const r = 6 + ((f * 3) % 24);
      ctx.circle(W / 2, H / 2, r, 2);
      ctx.circle(W / 2, H / 2, Math.max(2, r - 6), 3);
      ctx.circle(W / 2, H / 2, Math.max(1, r - 12), 0);
      const jitter = f % 2 === 0 ? -1 : 1;
      drawWord(ctx.rect, 'OMG!', W / 2 + jitter, H / 2, 2, 4);
    },
  },
  {
    id: 'rocket_launch',
    title: 'To The Moon',
    category: 'Trending',
    tags: ['rocket', 'moon', 'launch', 'space', 'fast', 'go'],
    palette: [
      [9, 12, 24],
      [255, 255, 255],
      [239, 68, 68],
      [250, 204, 21],
      [56, 189, 248],
      [148, 163, 184],
    ],
    drawFrame: (ctx, f, total) => {
      // Stars scrolling down
      for (let i = 0; i < 12; i++) {
        ctx.setPixel((i * 19 + 5) % W, (i * 13 + f * 5) % H, 1);
      }
      const dy = Math.round(Math.sin((f / total) * Math.PI * 2) * 3);
      // Rocket body
      ctx.rect(W / 2 - 5, 16 + dy, 10, 20, 1);
      ctx.rect(W / 2 - 3, 11 + dy, 6, 5, 2);
      ctx.circle(W / 2, 22 + dy, 3, 4);
      ctx.rect(W / 2 - 9, 28 + dy, 4, 8, 2);
      ctx.rect(W / 2 + 5, 28 + dy, 4, 8, 2);
      // Exhaust
      ctx.circle(W / 2, 40 + dy + (f % 3), 4, 3);
      ctx.circle(W / 2, 44 + dy + (f % 3), 2, 2);
    },
  },
  {
    id: 'rainbow_wave',
    title: 'Vibe Wave',
    category: 'Trending',
    tags: ['vibe', 'rainbow', 'wave', 'chill', 'dance', 'happy'],
    palette: [
      [12, 12, 16],
      [255, 255, 255],
      [239, 68, 68],
      [249, 115, 22],
      [250, 204, 21],
      [52, 211, 153],
      [56, 189, 248],
      [168, 85, 247],
    ],
    drawFrame: (ctx, f, total) => {
      const phase = (f / total) * Math.PI * 2;
      for (let x = 0; x < W; x += 2) {
        const yBase = H / 2 + Math.sin(x * 0.14 + phase) * 10;
        for (let band = 0; band < 6; band++) {
          ctx.rect(x, yBase + band * 3 - 9, 2, 3, band + 2);
        }
      }
    },
  },
  {
    id: 'arcade_invader',
    title: 'Arcade Mode',
    category: 'Gaming',
    tags: ['gaming', 'arcade', 'retro', 'pixel', 'play'],
    palette: [
      [10, 14, 18],
      [255, 255, 255],
      [52, 211, 153],
      [168, 85, 247],
    ],
    drawFrame: (ctx, f) => {
      const open = f % 2 === 0;
      const sx = 22 + Math.round(Math.sin(f * 0.6) * 8);
      const sy = 14;
      const sprite = open
        ? [
            '00100000100',
            '00010001000',
            '00111111100',
            '01101110110',
            '11111111111',
            '10111111101',
            '10100000101',
            '00011011000',
          ]
        : [
            '00100000100',
            '10010001001',
            '10111111101',
            '11101110111',
            '11111111111',
            '01111111110',
            '00100000100',
            '01000000010',
          ];
      sprite.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] === '1') ctx.rect(sx + rx * 2, sy + ry * 2, 2, 2, 2);
        }
      });
      drawWord(ctx.rect, 'PLAY', W / 2, 42, 1, 1);
    },
  },
  {
    id: 'yes_check',
    title: 'YES Approved',
    category: 'Reactions',
    tags: ['yes', 'agree', 'approved', 'ok', 'check', 'nice'],
    palette: [
      [10, 20, 16],
      [255, 255, 255],
      [16, 185, 129],
      [52, 211, 153],
    ],
    drawFrame: (ctx, f, total) => {
      const pulse = 1 + Math.sin((f / total) * Math.PI * 2) * 0.12;
      ctx.circle(W / 2, H / 2, Math.round(19 * pulse), 2);
      ctx.circle(W / 2, H / 2, Math.round(16 * pulse), 0);
      drawWord(ctx.rect, 'YES!', W / 2, H / 2, 2, 3);
    },
  },
  {
    id: 'brb_coffee',
    title: 'BRB Coffee',
    category: 'Memes',
    tags: ['brb', 'coffee', 'afk', 'break', 'chill'],
    palette: [
      [20, 16, 14],
      [255, 255, 255],
      [217, 119, 6],
      [161, 161, 170],
    ],
    drawFrame: (ctx, f) => {
      // Cup
      ctx.rect(24, 24, 20, 18, 1);
      ctx.rect(44, 28, 5, 10, 1);
      ctx.rect(44, 30, 3, 6, 0);
      ctx.rect(26, 26, 16, 4, 2);
      // Rising steam
      for (let i = 0; i < 3; i++) {
        const sy = 18 - ((f + i * 3) % 10);
        const sx = 28 + i * 6 + (f % 2 === 0 ? 1 : -1);
        ctx.rect(sx, sy, 2, 4, 3);
      }
      drawWord(ctx.rect, 'BRB', W / 2, 48, 1, 2);
    },
  },
  {
    id: 'af_trophy',
    title: 'Champion Trophy',
    category: 'Celebrate',
    tags: ['trophy', 'winner', 'champ', 'mvp', 'best', 'clutch'],
    palette: [
      [16, 14, 24],
      [255, 255, 255],
      [250, 204, 21],
      [234, 179, 8],
    ],
    drawFrame: (ctx, f, total) => {
      const shimmer = f % 4;
      ctx.rect(26, 12, 20, 16, 2);
      ctx.rect(22, 14, 4, 9, 3);
      ctx.rect(46, 14, 4, 9, 3);
      ctx.rect(33, 28, 6, 9, 3);
      ctx.rect(27, 37, 18, 5, 2);
      // Sparkles
      ctx.circle(16 + shimmer * 2, 16, 2, 1);
      ctx.circle(56 - shimmer * 2, 22, 2, 1);
      drawWord(ctx.rect, 'MVP!', W / 2, 48, 1, 1);
    },
  },
];

let cachedItems: GifItem[] | null = null;
const cachedBytes = new Map<string, Uint8Array>();

function toDataUri(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return `data:image/gif;base64,${btoa(binary)}`;
  }
  return `data:image/gif;base64,${Buffer.from(bytes).toString('base64')}`;
}

export function getGifBytesById(id: string): Uint8Array | null {
  if (cachedBytes.has(id)) return cachedBytes.get(id)!;
  const spec = GIF_SCENES.find((s) => s.id === id);
  if (!spec) return null;
  const bytes = buildGifBytes(spec);
  cachedBytes.set(id, bytes);
  return bytes;
}

export function getBuiltInGifCatalog(useServerUrls = false): GifItem[] {
  if (!useServerUrls && cachedItems) return cachedItems;
  const items = GIF_SCENES.map((spec) => ({
    id: spec.id,
    title: spec.title,
    category: spec.category,
    tags: spec.tags,
    url: useServerUrls ? `/api/gifs/asset/${spec.id}.gif` : toDataUri(getGifBytesById(spec.id)!),
  }));
  if (!useServerUrls) cachedItems = items;
  return items;
}

export function searchBuiltInGifs(query = '', category = 'All', useServerUrls = false): GifItem[] {
  const catalog = getBuiltInGifCatalog(useServerUrls);
  const q = query.trim().toLowerCase();
  return catalog.filter((item) => {
    const matchesCat = category === 'All' || category === 'Trending' || item.category === category;
    if (!matchesCat && !q) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function gifItemToFile(item: GifItem): File {
  const bytes = getGifBytesById(item.id);
  if (bytes) {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new File([buffer], `${item.id}.gif`, { type: 'image/gif' });
  }
  // Fallback empty shouldn't happen for built-ins
  return new File([], `${item.id}.gif`, { type: 'image/gif' });
}
