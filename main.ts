// news-image-20261125: one image summing up Wednesday 25 November 2026.
// Drawn entirely in code: a 1024x1024 RGBA raster, a hand-written 5x7 pixel
// font, and a hand-rolled PNG encoder (zlib via node:zlib). No network, no
// assets, no timestamps anywhere: the same input always yields the same bytes.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

// Palette: deep-navy newsprint, gold masthead, white type.
const INK = [13, 27, 46];
const PANEL = [21, 42, 68];
const PANEL2 = [27, 54, 86];
const EDGE = [46, 78, 115];
const GOLD = [242, 193, 78];
const PAPER = [245, 247, 250];
const MUTED = [159, 179, 200];
const RED = [229, 72, 77];
const GREEN = [70, 167, 88];
const BLUE = [62, 155, 255];
const ORANGE = [247, 107, 21];
const SKY = [126, 196, 255];
const DARKBLUE = [24, 64, 120];

// 5x7 pixel font. Each glyph is 7 rows; each row is 5 bits, bit 4 = leftmost.
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '%': [25, 26, 2, 4, 8, 11, 19],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '&': [12, 18, 20, 8, 21, 18, 13],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '=': [0, 0, 31, 0, 31, 0, 0],
  $: [4, 15, 20, 14, 5, 30, 4],
  '\u2022': [0, 0, 12, 12, 12, 0, 0],
};

// ---- raster canvas ---------------------------------------------------------
const buf = new Uint8Array(W * H * 4);
let clipX0 = 0;
let clipY0 = 0;
let clipX1 = W;
let clipY1 = H;

function setClip(x0: number, y0: number, x1: number, y1: number): void {
  clipX0 = x0; clipY0 = y0; clipX1 = x1; clipY1 = y1;
}
function clearClip(): void {
  clipX0 = 0; clipY0 = 0; clipX1 = W; clipY1 = H;
}
function setPx(x: number, y: number, c: number[]): void {
  if (x < clipX0 || y < clipY0 || x >= clipX1 || y >= clipY1) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}
function circle(cx: number, cy: number, r: number, c: number[]): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let xx = -dx; xx <= dx; xx++) setPx(cx + xx, cy + dy, c);
  }
}
function ring(cx: number, cy: number, r: number, c: number[]): void {
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r - 0.9 && d <= r + 0.9) setPx(cx + dx, cy + dy, c);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
      const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
      const g = 1 - a - b;
      if (a >= 0 && b >= 0 && g >= 0) setPx(x, y, c);
    }
  }
}

// ---- PNG encoder (no timestamps, fully deterministic) ----------------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let cc = n;
  for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
  CRC_TABLE[n] = cc >>> 0;
}
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  const crcData = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  out.writeUInt32BE(crc32(crcData), 8 + data.length);
  return out;
}
function encodePng(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]);
}

// ---- text ------------------------------------------------------------------
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: number[]): void {
  let cx = x;
  for (const ch of s) {
    // The 5x7 font holds capitals only; lowercase renders as its capital,
    // keeping the whole image in one consistent all-caps pixel face.
    const g = FONT[ch] ?? FONT[ch.toUpperCase()] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              setPx(cx + col * scale + dx, y + r * scale + dy, c);
            }
          }
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// ---- pictograms (each fits a 64x64 box at ox, oy) --------------------------
function drawRocket(ox: number, oy: number): void {
  // flame
  tri(ox + 32, oy + 58, ox + 24, oy + 40, ox + 40, oy + 40, ORANGE);
  tri(ox + 32, oy + 52, ox + 27, oy + 40, ox + 37, oy + 40, GOLD);
  // fins
  tri(ox + 22, oy + 38, ox + 14, oy + 48, ox + 22, oy + 48, RED);
  tri(ox + 42, oy + 38, ox + 50, oy + 48, ox + 42, oy + 48, RED);
  // body
  rect(ox + 22, oy + 12, 20, 30, PAPER);
  // nose
  tri(ox + 22, oy + 12, ox + 42, oy + 12, ox + 32, oy + 0, RED);
  // window
  circle(ox + 32, oy + 24, 5, BLUE);
  circle(ox + 32, oy + 24, 2, SKY);
}
function drawStation(ox: number, oy: number): void {
  rect(ox + 0, oy + 24, 16, 5, BLUE);
  rect(ox + 26, oy + 12, 12, 28, PAPER);
  rect(ox + 38, oy + 24, 16, 5, BLUE);
  rect(ox + 2, oy + 26, 12, 1, GOLD);
  rect(ox + 40, oy + 26, 12, 1, GOLD);
}
function drawCyber(ox: number, oy: number): void {
  // monitor
  rect(ox + 6, oy + 8, 52, 36, PAPER);
  rect(ox + 9, oy + 11, 46, 30, DARKBLUE);
  rect(ox + 26, oy + 44, 12, 6, PAPER);
  rect(ox + 18, oy + 50, 28, 3, PAPER);
  // padlock on the screen
  ring(ox + 32, oy + 22, 7, GOLD);
  rect(ox + 24, oy + 22, 16, 13, GOLD);
  rect(ox + 30, oy + 26, 4, 5, DARKBLUE);
}
function drawChart(ox: number, oy: number): void {
  line(ox + 8, oy + 52, ox + 56, oy + 52, PAPER);
  line(ox + 8, oy + 52, ox + 8, oy + 8, PAPER);
  line(ox + 12, oy + 16, ox + 24, oy + 26, RED);
  line(ox + 24, oy + 26, ox + 36, oy + 22, RED);
  line(ox + 36, oy + 22, ox + 50, oy + 44, RED);
  tri(ox + 50, oy + 44, ox + 42, oy + 40, ox + 48, oy + 34, RED);
}
function drawChip(ox: number, oy: number): void {
  for (let i = 0; i < 4; i++) {
    const x = ox + 16 + i * 10;
    line(x, oy + 8, x, oy + 14, GOLD);
    line(x, oy + 50, x, oy + 56, GOLD);
    line(ox + 8, oy + 16 + i * 10, ox + 14, oy + 16 + i * 10, GOLD);
    line(ox + 50, oy + 16 + i * 10, ox + 56, oy + 16 + i * 10, GOLD);
  }
  rect(ox + 14, oy + 14, 36, 36, BLUE);
  rect(ox + 24, oy + 24, 16, 16, SKY);
  rect(ox + 28, oy + 28, 8, 8, DARKBLUE);
}
function drawBarrel(ox: number, oy: number): void {
  tri(ox + 32, oy + 4, ox + 24, oy + 20, ox + 40, oy + 20, RED);
  tri(ox + 32, oy + 10, ox + 28, oy + 20, ox + 36, oy + 20, GOLD);
  rect(ox + 16, oy + 22, 32, 34, ORANGE);
  rect(ox + 16, oy + 28, 32, 3, RED);
  rect(ox + 16, oy + 44, 32, 3, RED);
}
function drawMedCross(ox: number, oy: number): void {
  circle(ox + 32, oy + 32, 26, RED);
  rect(ox + 26, oy + 16, 12, 32, PAPER);
  rect(ox + 16, oy + 26, 32, 12, PAPER);
}
function drawPin(ox: number, oy: number): void {
  circle(ox + 32, oy + 24, 16, RED);
  tri(ox + 32, oy + 58, ox + 20, oy + 34, ox + 44, oy + 34, RED);
  circle(ox + 32, oy + 24, 6, PAPER);
}

// ---- layout ----------------------------------------------------------------
// Stories verified against live sources on 25 Nov 2026 (Reuters, CNN, Xinhua,
// IANS/UN News, The Independent). Caveat: stories 2-7 were decided or first
// reported on Tue 24 Nov and lead the 25 Nov news cycle; story 1 (launch)
// and story 3 (Wednesday Asia sell-off) happened on 25 Nov itself.
type Story = {
  tag: string;
  head: string[];
  sub: string[];
  pic: (ox: number, oy: number) => void;
};
const STORIES: Story[] = [
  {
    tag: 'CYBER',
    head: ['CIA & ODNI', 'HACKED'],
    sub: ['Unclassified spy network', 'breached; no classified', 'data hit, US says'],
    pic: drawCyber,
  },
  {
    tag: 'MARKETS',
    head: ['ASIA MARKETS', 'SLIDE'],
    sub: ['Tariff fears: Seoul -5.3%,', 'Taiwan -5.1%, Nikkei', '-2.9%; Nasdaq -1.5% Tue'],
    pic: drawChart,
  },
  {
    tag: 'TECH',
    head: ['HUAWEI', 'GUILTY'],
    sub: ['US jury convicts on 10 of', '12 counts; racketeering', 'charge cleared'],
    pic: drawChip,
  },
  {
    tag: 'WAR',
    head: ['PUTIN VOWS', 'REVENGE'],
    sub: ["After Ukraine's refinery", 'strikes; Moscow calls ship', "attacks 'terrorism'"],
    pic: drawBarrel,
  },
  {
    tag: 'HEALTH',
    head: ['EBOLA STAFF', 'RESCUED'],
    sub: ['WHO team out after 3 days', 'sheltering in Congo', 'hospital amid fighting'],
    pic: drawMedCross,
  },
  {
    tag: 'YEMEN',
    head: ['HOUTHIS NEAR', 'ADEN'],
    sub: ["60 km from Yemen's", 'capital; army says the', 'city will hold'],
    pic: drawPin,
  },
];

function drawScene(): void {
  rect(0, 0, W, H, INK);

  // Masthead
  drawTextCentered('WORLD NEWS', 512, 16, 8, GOLD);
  drawTextCentered('WEDNESDAY 25 NOVEMBER 2026', 512, 80, 3, PAPER);
  rect(24, 110, 976, 3, GOLD);

  // Lead panel: Shenzhou-24
  const lx = 24, ly = 128, lw = 976, lh = 300;
  rect(lx, ly, lw, lh, PANEL);
  rect(lx, ly, lw, 2, EDGE);
  rect(lx, ly + lh - 2, lw, 2, EDGE);
  rect(lx, ly, 2, lh, EDGE);
  rect(lx + lw - 2, ly, 2, lh, EDGE);
  setClip(lx + 2, ly + 2, lx + lw - 2, ly + lh - 2);
  // Earth arc, lower left
  circle(150, 560, 210, BLUE);
  circle(110, 420, 34, GREEN);
  circle(205, 445, 22, GREEN);
  circle(160, 470, 14, GREEN);
  // stars
  const stars: [number, number][] = [
    [60, 160], [90, 210], [300, 150], [330, 220], [70, 300],
    [350, 300], [120, 380], [310, 370], [45, 250], [270, 410],
  ];
  for (const [sx, sy] of stars) rect(sx, sy, 3, 3, PAPER);
  drawStation(296, 148);
  drawRocket(216, 176);
  clearClip();
  drawText('SPACE - LEAD STORY', 400, 152, 2, GOLD);
  drawText('FIRST PAKISTANI', 400, 186, 4, PAPER);
  drawText('IN ORBIT', 400, 232, 4, PAPER);
  drawText('Shenzhou-24 lifts off for Tiangong station', 400, 292, 2, MUTED);
  drawText('Zeeshan Ali, 40 - first foreign astronaut', 400, 314, 2, MUTED);
  drawText("aboard China's space station", 400, 336, 2, MUTED);
  drawText('Launched 00:18 UTC from Jiuquan', 400, 358, 2, MUTED);
  drawText('ALI TO RUN 4 PAKISTANI EXPERIMENTS', 400, 380, 2, MUTED);

  // Grid of six stories
  const colX = [24, 353, 682];
  const rowY = [444, 660];
  const pw = 318, ph = 206;
  for (let i = 0; i < 6; i++) {
    const x = colX[i % 3];
    const y = rowY[Math.floor(i / 3)];
    const s = STORIES[i];
    rect(x, y, pw, ph, PANEL);
    rect(x, y, pw, 2, EDGE);
    rect(x, y + ph - 2, pw, 2, EDGE);
    rect(x, y, 2, ph, EDGE);
    rect(x + pw - 2, y, 2, ph, EDGE);
    s.pic(x + 14, y + 12);
    drawText(s.tag, x + 92, y + 18, 2, GOLD);
    drawText(s.head[0], x + 14, y + 92, 3, PAPER);
    drawText(s.head[1], x + 14, y + 116, 3, PAPER);
    drawText(s.sub[0], x + 14, y + 148, 2, MUTED);
    drawText(s.sub[1], x + 14, y + 166, 2, MUTED);
    drawText(s.sub[2], x + 14, y + 184, 2, MUTED);
  }

  // Market ticker
  rect(24, 882, 976, 56, PANEL2);
  rect(24, 882, 976, 2, EDGE);
  rect(24, 936, 976, 2, EDGE);
  drawTextCentered('NASDAQ -1.5%   S&P 500 -0.5%   DOW +0.9%   SEOUL -5.3%   NIKKEI -2.9%', 512, 892, 2, PAPER);
  drawTextCentered('BRENT $91   BITCOIN $59,258   GOLD $3,560   US PCE + GDP DUE TODAY', 512, 914, 2, GOLD);

  // Footer
  drawTextCentered('25 NOVEMBER 2026 - THE DAY IN ONE IMAGE', 512, 962, 2, MUTED);
}

function main(): void {
  drawScene();
  const png = encodePng();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
