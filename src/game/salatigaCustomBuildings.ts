import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gpsToWorld } from './salatigaTrack';

export interface SalatigaCustomBuilding {
  id: string;
  name: string;               // 3D signboard label (CanvasTexture)
  lon: number;                // Real-world Longitude
  lat: number;                // Real-world Latitude
  rotationDeg: number;        // Compass orientation (0-360 deg)
  widthMeters: number;        // Facade width parallel to road
  depthMeters: number;        // Building depth
  floors: number;             // 1 - 5 floors
  floorHeight?: number;       // Default 3.6m
  style:
    | 'clock-roundabout'      // Bundaran Tamansari clock monument
    | 'market-complex'        // Multi-story market & canopies (Pasar Raya II)
    | 'colonial-civic'        // White colonial pillars & red clay roof (Rumah Dinas Wali Kota)
    | 'campus-gate'           // University gate & academic block (UKSW / Diponegoro)
    | 'shophouse-row'         // Indonesian ruko row (Jl. Jend. Sudirman)
    | 'highland-cafe'         // Modern highland building/cafe (JLS - Wates)
    | 'finish-gate'           // Wates finish arch & buildings
    | 'grand-hotel';          // Grand Wahid Hotel (Jl. Jend. Sudirman)
  wallColor?: string;
  roofColor?: string;
  exclusionRadius?: number;   // Radius (default 22m) to skip generic GeoJSON polygons
  facadeTextureUrl?: string;  // Optional photo-facade texture URL (atlas slots 12-15)
}

export interface SalatigaBuildingsBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

export interface AtlasRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Sub-rect atlas entries used by Grand Wahid Hotel (solid cells sample center UV). */
export interface GrandHotelAtlas {
  plaster: AtlasRect;    // cream #f3e5c8
  peach: AtlasRect;      // peach #e8cfa6 (crown, cornice, horizontal bands)
  accent: AtlasRect;     // terracotta #9e3b33 (pilasters, hip roof)
  glass: AtlasRect;      // dark reflective glass #334155 with muntin lines
  gold: AtlasRect;       // gold #d4af37
  white: AtlasRect;      // white statues / lamp globes
  foliage: AtlasRect;    // green hedges / palm foliage #2d5a27
  signCurved: AtlasRect; // curved frieze "Grand Wahid Hotel"
  signGold: AtlasRect;   // canopy gold lettering "Grand Wahid"
}

export interface GrandHotelParams {
  widthMeters: number;
  depthMeters: number;
  floors: number;
  floorHeight?: number;
  rightWingFloors?: number;
}

/**
 * Curated Stage 2 real-world Salatiga landmarks positioned along the 5km street circuit.
 * Verified against trackCurve so zero structures encroach on drivable asphalt or Armco barriers.
 */
export const SALATIGA_CUSTOM_BUILDINGS: SalatigaCustomBuilding[] = [
  {
    id: 'bundaran-tamansari-clock',
    name: 'BUNDARAN TAMANSARI',
    lon: 110.504765,
    lat: -7.324847,
    rotationDeg: 90,
    widthMeters: 6.4,
    depthMeters: 6.4,
    floors: 3,
    floorHeight: 3.8,
    style: 'clock-roundabout',
    wallColor: '#f3ede0',
    roofColor: '#9c3626',
    exclusionRadius: 20,
  },
  {
    id: 'rumah-dinas-walikota',
    name: 'RUMAH DINAS WALI KOTA',
    lon: 110.50439,
    lat: -7.325194,
    rotationDeg: 75,
    widthMeters: 26,
    depthMeters: 18,
    floors: 1,
    floorHeight: 4.5,
    style: 'colonial-civic',
    wallColor: '#f7f3ea',
    roofColor: '#a63b29',
    exclusionRadius: 30,
  },
  {
    id: 'grand-wahid-hotel',
    name: 'GRAND WAHID HOTEL',
    lon: 110.50418,
    lat: -7.32665,
    rotationDeg: 98,
    widthMeters: 44,
    depthMeters: 24,
    floors: 4,
    floorHeight: 3.7,
    style: 'grand-hotel',
    wallColor: '#f3e5c8',
    roofColor: '#9e3b33',
    exclusionRadius: 34,
  },
  {
    id: 'ruko-jend-sudirman',
    name: 'RUKO JL. JEND. SUDIRMAN',
    lon: 110.50486,
    lat: -7.32735,
    rotationDeg: 277,
    widthMeters: 34,
    depthMeters: 11,
    floors: 3,
    floorHeight: 3.5,
    style: 'shophouse-row',
    wallColor: '#ede0cf',
    roofColor: '#8d402d',
    exclusionRadius: 28,
  },
  {
    id: 'pasar-raya-ii',
    name: 'PASAR RAYA II SALATIGA',
    lon: 110.504855,
    lat: -7.328444,
    rotationDeg: 275,
    widthMeters: 28,
    depthMeters: 22,
    floors: 4,
    floorHeight: 3.6,
    style: 'market-complex',
    wallColor: '#e5dccb',
    roofColor: '#3d5873',
    exclusionRadius: 42,
    facadeTextureUrl: '/textures/pasar-raya-2.jpg',
  },
  {
    id: 'jls-wates-highland-cafe',
    name: 'WATES HIGHLAND PAVILION',
    lon: 110.50045,
    lat: -7.33548,
    rotationDeg: 35,
    widthMeters: 20,
    depthMeters: 12,
    floors: 2,
    floorHeight: 3.6,
    style: 'highland-cafe',
    wallColor: '#2d343e',
    roofColor: '#485260',
    exclusionRadius: 26,
  },
  {
    id: 'uksw-diponegoro-gate',
    name: 'KAMPUS UKSW · DIPONEGORO',
    lon: 110.49894,
    lat: -7.32024,
    rotationDeg: 221,
    widthMeters: 28,
    depthMeters: 14,
    floors: 3,
    floorHeight: 3.8,
    style: 'campus-gate',
    wallColor: '#f1ede2',
    roofColor: '#822e24',
    exclusionRadius: 34,
  },
  {
    id: 'wates-finish-gate',
    name: 'SALATIGA CIRCUIT FINISH',
    lon: 110.504775,
    lat: -7.32449,
    rotationDeg: 194,
    widthMeters: 22,
    depthMeters: 10,
    floors: 2,
    floorHeight: 3.6,
    style: 'finish-gate',
    wallColor: '#1f2937',
    roofColor: '#b91c1c',
    exclusionRadius: 24,
  },
];

const ATLAS_SIZE = 2048;
const ATLAS_GRID = 4;
const CELL_SIZE = ATLAS_SIZE / ATLAS_GRID; // 512px
const GUTTER_PX = 6;
const INNER_SIZE = CELL_SIZE - GUTTER_PX * 2; // 500px
const CHUNK_LENGTH_METERS = 150;

interface AtlasUvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

function getAtlasUvRect(
  slotIndex: number,
  subU0 = 0,
  subV0 = 0,
  subU1 = 1,
  subV1 = 1,
): AtlasUvRect {
  const safeSlot = ((slotIndex % 16) + 16) % 16;
  const col = safeSlot % ATLAS_GRID;
  const row = Math.floor(safeSlot / ATLAS_GRID);
  const innerX0 = col * CELL_SIZE + GUTTER_PX;
  const innerY0 = row * CELL_SIZE + GUTTER_PX;

  const px0 = innerX0 + subU0 * INNER_SIZE;
  const px1 = innerX0 + subU1 * INNER_SIZE;
  const pyTop = innerY0 + (1 - subV1) * INNER_SIZE;
  const pyBot = innerY0 + (1 - subV0) * INNER_SIZE;

  return {
    u0: px0 / ATLAS_SIZE,
    u1: px1 / ATLAS_SIZE,
    v0: 1 - pyBot / ATLAS_SIZE,
    v1: 1 - pyTop / ATLAS_SIZE,
  };
}

function drawSlotWithGutter(
  ctx: CanvasRenderingContext2D,
  slotIndex: number,
  drawInner: (x: number, y: number, w: number, h: number) => void,
) {
  const col = slotIndex % ATLAS_GRID;
  const row = Math.floor(slotIndex / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const innerY = cellY + GUTTER_PX;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
  ctx.clip();

  // Draw slightly oversized across full 512x512 cell so 6px gutter inherits boundary pixels (prevents mipmap bleed)
  drawInner(cellX, cellY, CELL_SIZE, CELL_SIZE);
  // Crisp inner draw for exact sub-rect alignment
  drawInner(innerX, innerY, INNER_SIZE, INNER_SIZE);
  ctx.restore();
}

function drawColonialSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Upper 66%: White colonial colonnade & louvered windows
  const wallH = h * 0.66;
  ctx.fillStyle = '#f5f1e6';
  ctx.fillRect(x, y, w, wallH);

  // Subtle horizontal stucco courses
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let i = 1; i <= 5; i++) {
    ctx.fillRect(x, y + (wallH * i) / 6, w, 2);
  }

  // Pilaster columns + arched colonial shuttered windows
  const cols = 4;
  const bayW = w / cols;
  for (let c = 0; c < cols; c++) {
    const bx = x + c * bayW;
    // White fluted pilaster
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, y, bayW * 0.14, wallH);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(bx + bayW * 0.14, y, 4, wallH);

    // Tall louvered teak/green window
    const wx = bx + bayW * 0.28;
    const ww = bayW * 0.52;
    const wy = y + wallH * 0.16;
    const wh = wallH * 0.68;
    ctx.fillStyle = '#2d4739';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#476b56';
    for (let s = 0; s < 10; s++) {
      ctx.fillRect(wx + 4, wy + 8 + s * ((wh - 16) / 10), ww - 8, 4);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(wx, wy, ww, wh);
  }

  // Lower 34%: Terracotta red clay roof tiles
  const roofY = y + wallH;
  const roofH = h - wallH;
  ctx.fillStyle = '#9c3a28';
  ctx.fillRect(x, roofY, w, roofH);

  const rows = 5;
  const tileCols = 10;
  const rowH = roofH / rows;
  const colW = w / tileCols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < tileCols; c++) {
      const tx = x + c * colW;
      const ty = roofY + r * rowH;
      ctx.fillStyle = (r + c) % 2 === 0 ? '#aa4430' : '#8b3222';
      ctx.fillRect(tx + 1, ty + 1, colW - 2, rowH - 3);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(tx, ty + rowH - 3, colW, 3);
    }
  }
}

function drawMarketSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#dfd5c3';
  ctx.fillRect(x, y, w, h);

  // Upper 68%: Multi-story concrete facade + sun-breaker louvers & market windows
  const upperH = h * 0.68;
  const floorRows = 2;
  const rowH = upperH / floorRows;
  for (let r = 0; r < floorRows; r++) {
    const fy = y + r * rowH;
    // Sun-breaker horizontal concrete ledge
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(x, fy, w, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, fy + 14, w, 6);

    const bays = 5;
    const bw = w / bays;
    for (let b = 0; b < bays; b++) {
      const wx = x + b * bw + 8;
      const ww = bw - 16;
      const wy = fy + 26;
      const wh = rowH - 38;
      ctx.fillStyle = '#334155';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#475569';
      ctx.fillRect(wx + 4, wy + 4, ww - 8, wh * 0.42);
    }
  }

  // Lower 32%: Vibrant Pasar Raya II stalls & striped awning pattern
  const stallY = y + upperH;
  const stallH = h - upperH;
  ctx.fillStyle = '#292524';
  ctx.fillRect(x, stallY, w, stallH);

  const awningH = stallH * 0.36;
  const stripes = 12;
  const sw = w / stripes;
  const stripeColors = ['#c2410c', '#f5f5f4', '#0f766e', '#f5f5f4'];
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = stripeColors[i % stripeColors.length];
    ctx.fillRect(x + i * sw, stallY, sw + 1, awningH);
  }

  // Stall merchandise / corrugated doors below awning
  const stalls = 4;
  const stw = w / stalls;
  for (let s = 0; s < stalls; s++) {
    const sx = x + s * stw + 10;
    const sw2 = stw - 20;
    const sy = stallY + awningH + 8;
    const sh2 = stallH - awningH - 14;
    ctx.fillStyle = s % 2 === 0 ? '#78716c' : '#57534e';
    ctx.fillRect(sx, sy, sw2, sh2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let g = 0; g < 6; g++) {
      ctx.fillRect(sx + 2, sy + g * (sh2 / 6), sw2 - 4, 2);
    }
  }
}

function drawRukoSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#eadcc8';
  ctx.fillRect(x, y, w, h);

  // Upper 58%: Shophouse window bays + balcony railings
  const upperH = h * 0.58;
  const bays = 4;
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const bx = x + i * bw;
    // Vertical bay divider
    ctx.fillStyle = '#d6c4ac';
    ctx.fillRect(bx, y, 6, h);

    // Window
    const wx = bx + bw * 0.18;
    const ww = bw * 0.64;
    const wy = y + upperH * 0.18;
    const wh = upperH * 0.55;
    ctx.fillStyle = '#334155';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx + 4, wy + 4, ww * 0.45, wh - 8);

    // Balcony bar
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(bx + 8, y + upperH - 16, bw - 16, 4);
  }

  // Lower 42%: Roll-up steel ruko shutters
  const shutY = y + upperH;
  const shutH = h - upperH;
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x, shutY, w, shutH);

  for (let i = 0; i < bays; i++) {
    const sx = x + i * bw + 10;
    const sw = bw - 20;
    const sy = shutY + 12;
    const sh = shutH - 18;
    ctx.fillStyle = i % 2 === 0 ? '#4b5563' : '#374151';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let r = 0; r < 10; r++) {
      ctx.fillRect(sx + 2, sy + r * (sh / 10), sw - 4, 3);
    }
  }
}

function drawHighlandSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Architectural concrete & dark steel backdrop
  ctx.fillStyle = '#2d3540';
  ctx.fillRect(x, y, w, h);

  // Subtle concrete panel lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);

  // Large warm-lit glass curtain bays + vertical Javanese timber slats
  const bays = 4;
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const bx = x + i * bw;
    if (i === 3) {
      // Timber slat panel
      ctx.fillStyle = '#6e4024';
      ctx.fillRect(bx + 6, y + 12, bw - 12, h - 24);
      ctx.fillStyle = '#472814';
      for (let s = 0; s < 8; s++) {
        ctx.fillRect(bx + 10 + s * ((bw - 20) / 8), y + 12, 4, h - 24);
      }
    } else {
      const gx = bx + 10;
      const gw = bw - 20;
      const gy = y + 20;
      const gh = h - 40;
      const grad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
      grad.addColorStop(0, '#334155');
      grad.addColorStop(0.55, '#475569');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(gx, gy, gw, gh);
    }
  }
}

function drawSignboardInSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  bgColor: string,
  accentColor: string,
) {
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // Top & bottom motorsport/civic accent bars
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y, w, h * 0.14);
  ctx.fillRect(x, y + h * 0.88, w, h * 0.12);

  // Inner metallic border
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = 6;
  ctx.strokeRect(x + 14, y + h * 0.17, w - 28, h * 0.67);

  // Auto-fit crisp display title across up to 2 lines if long
  ctx.fillStyle = '#f9fafb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 54;
  const maxWidth = w - 54;
  while (fontSize > 26) {
    ctx.font = `700 ${fontSize}px Oxanium, "Plus Jakarta Sans", sans-serif`;
    if (ctx.measureText(label).width <= maxWidth) break;
    fontSize -= 2;
  }

  if (ctx.measureText(label).width > maxWidth && label.includes(' ')) {
    const words = label.split(' ');
    const mid = Math.ceil(words.length / 2);
    const l1 = words.slice(0, mid).join(' ');
    const l2 = words.slice(mid).join(' ');
    ctx.font = `700 40px Oxanium, "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(l1, x + w * 0.5, y + h * 0.42);
    ctx.fillText(l2, x + w * 0.5, y + h * 0.62);
  } else {
    ctx.fillText(label, x + w * 0.5, y + h * 0.52);
  }
}

function drawUtilityPaletteSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const hw = w * 0.5;
  const hh = h * 0.5;

  // Top-left (subU 0..0.5, subV 0.5..1): Bundaran Tamansari Clock Dial
  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(x, y, hw, hh);
  const cx = x + hw * 0.5;
  const cy = y + hh * 0.5;
  const rad = Math.min(hw, hh) * 0.41;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.87, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? rad * 0.66 : rad * 0.74;
    const r1 = rad * 0.84;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
    ctx.stroke();
  }
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - rad * 0.38, cy - rad * 0.24);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + rad * 0.52, cy - rad * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();

  // Top-right (subU 0.5..1, subV 0.5..1): Pure Neutral White Swatch (for vertex-colored trims/roofs/columns)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + hw, y, hw, hh);

  // Bottom-left (subU 0..0.5, subV 0..0.5): Checkered Finish Banner Trim
  const chkY = y + hh;
  const cols = 8;
  const rows = 4;
  const cw = hw / cols;
  const ch = hh / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#111827' : '#f8fafc';
      ctx.fillRect(x + c * cw, chkY + r * ch, cw + 0.5, ch + 0.5);
    }
  }

  // Bottom-right (subU 0.5..1, subV 0..0.5): Speckled Granite / Stone Plinth
  const stX = x + hw;
  const stY = y + hh;
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(stX, stY, hw, hh);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let r = 0; r < 6; r++) {
    ctx.fillRect(stX, stY + r * (hh / 6), hw, 3);
  }
  for (let c = 0; c < 4; c++) {
    ctx.fillRect(stX + c * (hw / 4), stY, 3, hh);
  }
}

interface SignboardAtlasRect {
  slot: number;
  subU0: number;
  subV0: number;
  subU1: number;
  subV1: number;
}

interface AtlasBuildResult {
  texture: THREE.CanvasTexture | null;
  signboardRectMap: Map<string, SignboardAtlasRect>;
  grandHotelBaseAtlas: Omit<GrandHotelAtlas, 'signCurved'>;
  photoSlotMap: Map<string, number>;
  cancelPendingLoads: () => void;
}

function getSignboardColors(style: SalatigaCustomBuilding['style']): [string, string, string] {
  switch (style) {
    case 'clock-roundabout':
      return ['#14213d', '#f59e0b', '#f9fafb'];
    case 'colonial-civic':
      return ['#1e293b', '#b91c1c', '#f9fafb'];
    case 'market-complex':
      return ['#0f172a', '#f59e0b', '#f9fafb'];
    case 'campus-gate':
      return ['#1e3a8a', '#f59e0b', '#f9fafb'];
    case 'highland-cafe':
      return ['#1c1917', '#f59e0b', '#f9fafb'];
    case 'finish-gate':
      return ['#111827', '#ef4444', '#f9fafb'];
    case 'grand-hotel':
      return ['#e8cfa6', '#9e3b33', '#291d14'];
    default:
      return ['#1e293b', '#dc2626', '#f9fafb'];
  }
}

function drawHalfBandSignboard(
  ctx: CanvasRenderingContext2D,
  slotIndex: number,
  isTopHalf: boolean,
  label: string,
  bgColor: string,
  accentColor: string,
  textColor: string,
  isGoldSign = false,
) {
  const col = slotIndex % ATLAS_GRID;
  const row = Math.floor(slotIndex / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const halfH = Math.floor((INNER_SIZE - 16) / 2); // 242px per band with 16px middle gutter
  const bandY = cellY + GUTTER_PX + (isTopHalf ? 0 : halfH + 16);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, isTopHalf ? cellY : cellY + CELL_SIZE * 0.5, CELL_SIZE, CELL_SIZE * 0.5);
  ctx.clip();

  // Fill slightly into outer horizontal & vertical gutters to prevent mipmap edge bleed
  ctx.fillStyle = bgColor;
  ctx.fillRect(cellX, bandY - 6, CELL_SIZE, halfH + 12);

  if (isGoldSign) {
    // Rich dark bronze fascia with crisp raised gold "Grand Wahid" serif lettering
    ctx.fillStyle = '#2b1d12';
    ctx.fillRect(innerX, bandY, INNER_SIZE, halfH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.strokeRect(innerX + 8, bandY + 8, INNER_SIZE - 16, halfH - 16);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 72px Georgia, "Times New Roman", serif';
    ctx.fillStyle = '#785616';
    ctx.fillText(label, innerX + INNER_SIZE * 0.5 + 3, bandY + halfH * 0.5 + 4);
    ctx.fillStyle = '#f5d061';
    ctx.fillText(label, innerX + INNER_SIZE * 0.5, bandY + halfH * 0.5);
  } else {
    drawSignboardInSlot(ctx, innerX, bandY, INNER_SIZE, halfH, label, bgColor, accentColor);
    if (textColor !== '#f9fafb') {
      // Redraw clean dark architectural text over peach-cream fascia (sized to fit curved arc)
      ctx.fillStyle = bgColor;
      ctx.fillRect(innerX, bandY, INNER_SIZE, halfH);
      ctx.fillStyle = accentColor;
      ctx.fillRect(innerX, bandY, INNER_SIZE, 10);
      ctx.fillRect(innerX, bandY + halfH - 10, INNER_SIZE, 10);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fs = 44;
      while (fs > 24) {
        ctx.font = `700 ${fs}px Georgia, Oxanium, serif`;
        if (ctx.measureText(label).width <= INNER_SIZE - 48) break;
        fs -= 2;
      }
      ctx.fillText(label, innerX + INNER_SIZE * 0.5, bandY + halfH * 0.52);
    }
  }
  ctx.restore();
}

function drawGrandHotelSwatchesInSlot9Bottom(ctx: CanvasRenderingContext2D) {
  const slot = 9;
  const col = slot % ATLAS_GRID;
  const row = Math.floor(slot / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const halfH = Math.floor((INNER_SIZE - 16) / 2); // 242px
  const botY = cellY + GUTTER_PX + halfH + 16;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY + CELL_SIZE * 0.5, CELL_SIZE, CELL_SIZE * 0.5);
  ctx.clip();

  // Fill outer border neutral warm cream to prevent gutter bleed
  ctx.fillStyle = '#f3e5c8';
  ctx.fillRect(cellX, botY - 6, CELL_SIZE, halfH + 12);

  // 4x2 solid/muntin swatch grid inside bottom half of Slot 9 (subV 0.0..0.48)
  const swW = INNER_SIZE / 4; // 125px
  const swH = halfH / 2;      // 121px
  const swatches: { c: number; r: number; hex: string; isGlass?: boolean }[] = [
    { c: 0, r: 0, hex: '#f3e5c8' }, // plaster (top row inside bottom half)
    { c: 1, r: 0, hex: '#e8cfa6' }, // peach
    { c: 2, r: 0, hex: '#9e3b33' }, // accent (terracotta)
    { c: 3, r: 0, hex: '#334155', isGlass: true }, // glass with muntin bars
    { c: 0, r: 1, hex: '#d4af37' }, // gold (bottom row)
    { c: 1, r: 1, hex: '#ffffff' }, // white
    { c: 2, r: 1, hex: '#2d5a27' }, // foliage
    { c: 3, r: 1, hex: '#6e5a49' }, // warm timber/stone spare
  ];

  for (let i = 0; i < swatches.length; i++) {
    const s = swatches[i];
    const sx = innerX + s.c * swW;
    const sy = botY + s.r * swH;

    if (s.isGlass) {
      // Reflective dark slate glass gradient + subtle cream window muntins
      const grad = ctx.createLinearGradient(sx, sy, sx + swW, sy + swH);
      grad.addColorStop(0, '#273446');
      grad.addColorStop(0.55, '#3b4b61');
      grad.addColorStop(1, '#263344');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, swW, swH);

      ctx.strokeStyle = '#d9cbb3';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 4, sy + 4, swW - 8, swH - 8);
      ctx.fillStyle = 'rgba(243,229,200,0.42)';
      ctx.fillRect(sx + swW * 0.5 - 1.5, sy + 4, 3, swH - 8);
      ctx.fillRect(sx + 4, sy + swH * 0.34, swW - 8, 2.5);
      ctx.fillRect(sx + 4, sy + swH * 0.68, swW - 8, 2.5);
    } else {
      ctx.fillStyle = s.hex;
      ctx.fillRect(sx, sy, swW, swH);
    }
  }
  ctx.restore();
}

function getSignRectFromHalfIndex(halfIdx: number): SignboardAtlasRect {
  const slot = 4 + Math.floor(halfIdx / 2);
  const isTopHalf = halfIdx % 2 === 0;
  return {
    slot,
    subU0: 0,
    subU1: 1,
    subV0: isTopHalf ? 0.52 : 0.0,
    subV1: isTopHalf ? 1.0 : 0.48,
  };
}

function toAtlasRect(rect: SignboardAtlasRect): AtlasRect {
  return getAtlasUvRect(rect.slot, rect.subU0, rect.subV0, rect.subU1, rect.subV1);
}

function getGrandHotelBaseAtlas(): Omit<GrandHotelAtlas, 'signCurved'> {
  // Slot 9 bottom half holds 4x2 swatches (each cell inset away from seams so mipmaps never bleed)
  // Note: Slot 9 bottom half spans subV 0.0 .. (242/500 = 0.484)
  // Upper swatch row (r=0 in canvas): subV 0.242 .. 0.484
  // Lower swatch row (r=1 in canvas): subV 0.000 .. 0.242
  const swatchRect = (c: number, r: number): AtlasRect => {
    const u0 = c * 0.25 + 0.03;
    const u1 = (c + 1) * 0.25 - 0.03;
    const vMin = r === 0 ? 0.242 : 0.0;
    const vMax = r === 0 ? 0.484 : 0.242;
    return getAtlasUvRect(9, u0, vMin + 0.028, u1, vMax - 0.028);
  };

  return {
    plaster: swatchRect(0, 0),
    peach: swatchRect(1, 0),
    accent: swatchRect(2, 0),
    glass: swatchRect(3, 0),
    gold: swatchRect(0, 1),
    white: swatchRect(1, 1),
    foliage: swatchRect(2, 1),
    signGold: getAtlasUvRect(9, 0.01, 0.53, 0.99, 0.99),
  };
}

function buildRuntimeTextureAtlas(buildings: SalatigaCustomBuilding[]): AtlasBuildResult {
  const signboardRectMap = new Map<string, SignboardAtlasRect>();
  const photoSlotMap = new Map<string, number>();

  for (let i = 0; i < buildings.length; i++) {
    // Slots 4..8 hold up to 10 half-height signboard bands (indices 0..9)
    const halfIdx = i % 10;
    signboardRectMap.set(buildings[i].id, getSignRectFromHalfIndex(halfIdx));
  }
  const grandHotelBaseAtlas = getGrandHotelBaseAtlas();

  let nextPhotoSlot = 12;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (b.facadeTextureUrl && nextPhotoSlot <= 15) {
      photoSlotMap.set(b.id, nextPhotoSlot);
      nextPhotoSlot++;
    }
  }

  if (typeof document === 'undefined') {
    return {
      texture: null,
      signboardRectMap,
      grandHotelBaseAtlas,
      photoSlotMap,
      cancelPendingLoads: () => {},
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      texture: null,
      signboardRectMap,
      grandHotelBaseAtlas,
      photoSlotMap,
      cancelPendingLoads: () => {},
    };
  }

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Slots 0-3: Tileable procedural architectural textures
  drawSlotWithGutter(ctx, 0, (x, y, w, h) => drawColonialSlot(ctx, x, y, w, h));
  drawSlotWithGutter(ctx, 1, (x, y, w, h) => drawMarketSlot(ctx, x, y, w, h));
  drawSlotWithGutter(ctx, 2, (x, y, w, h) => drawRukoSlot(ctx, x, y, w, h));
  drawSlotWithGutter(ctx, 3, (x, y, w, h) => drawHighlandSlot(ctx, x, y, w, h));

  // Slots 4-8: Up to 10 high-contrast 3D building signboard bands
  for (let i = 0; i < Math.min(buildings.length, 10); i++) {
    const b = buildings[i];
    const [bg, accent, textCol] = getSignboardColors(b.style);
    const slot = 4 + Math.floor(i / 2);
    const isTopHalf = i % 2 === 0;
    const displayLabel =
      b.style === 'grand-hotel' && b.name === 'GRAND WAHID HOTEL'
        ? 'Grand Wahid Hotel'
        : b.name;
    drawHalfBandSignboard(ctx, slot, isTopHalf, displayLabel, bg, accent, textCol, false);
  }

  // Slot 9 Top: Grand Wahid bold gold porte-cochere signboard
  drawHalfBandSignboard(ctx, 9, true, 'Grand Wahid', '#2b1d12', '#d4af37', '#f5d061', true);
  // Slot 9 Bottom: Grand Hotel solid color & glass muntin swatches
  drawGrandHotelSwatchesInSlot9Bottom(ctx);

  // Slot 11: Architectural utility sub-rects (Clock Dial, Neutral White, Checkered Trim, Stone)
  drawSlotWithGutter(ctx, 11, (x, y, w, h) => drawUtilityPaletteSlot(ctx, x, y, w, h));

  // Slots 12-15: Pre-fill procedural fallback textures before attempting async facade photo loads
  for (let s = 12; s <= 15; s++) {
    drawSlotWithGutter(ctx, s, (x, y, w, h) => {
      if (s === 12) drawMarketSlot(ctx, x, y, w, h);
      else if (s === 13) drawRukoSlot(ctx, x, y, w, h);
      else if (s === 14) drawHighlandSlot(ctx, x, y, w, h);
      else drawColonialSlot(ctx, x, y, w, h);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  let cancelled = false;
  if (typeof Image !== 'undefined') {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const slot = photoSlotMap.get(b.id);
      if (slot === undefined || !b.facadeTextureUrl) continue;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        drawSlotWithGutter(ctx, slot, (x, y, w, h) => {
          ctx.drawImage(img, x, y, w, h);
        });
        texture.needsUpdate = true;
      };
      img.onerror = () => {
        // Gracefully retain pre-drawn procedural fallback in slot
      };
      img.src = b.facadeTextureUrl;
    }
  }

  return {
    texture,
    signboardRectMap,
    grandHotelBaseAtlas,
    photoSlotMap,
    cancelPendingLoads: () => {
      cancelled = true;
    },
  };
}

function createOsmFacadeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Neutral white plaster base so vertex colors tint each building naturally
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, 256, 256);

  // Clean top/bottom plaster edge strips (used at v=0.97 by roofs so walls+roofs merge into 1 draw call)
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillRect(0, 232, 256, 24);

  // Subtle floor slab line
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 24, 256, 8);

  // 4 window bays per 1.0 UV repeat
  const cols = 4;
  const padX = 12;
  const cellW = 256 / cols;
  for (let c = 0; c < cols; c++) {
    const wx = c * cellW + padX;
    const ww = cellW - padX * 2;
    const wy = 56;
    const wh = 126;
    ctx.fillStyle = '#475569';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx + 3, wy + 4, ww - 6, wh * 0.42);
    ctx.fillStyle = '#d6d3cd';
    ctx.fillRect(wx - 2, wy + wh, ww + 4, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

interface TrackSpatialSample {
  x: number;
  y: number;
  z: number;
  s: number;
}

interface TrackSpatialQuery {
  trackLengthMeters: number;
  queryNearest: (x: number, z: number) => { dist: number; roadY: number; s: number };
}

function createTrackSpatialQuery(trackCurve: THREE.CatmullRomCurve3): TrackSpatialQuery {
  const trackLengthMeters = Math.max(500, trackCurve.getLength());
  const sampleCount = Math.min(4000, Math.max(1200, Math.ceil(trackLengthMeters / 2)));
  const pts = trackCurve.getSpacedPoints(sampleCount);
  const samples: TrackSpatialSample[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    samples[i] = {
      x: pts[i].x,
      y: pts[i].y,
      z: pts[i].z,
      s: (i / sampleCount) * trackLengthMeters,
    };
  }

  const cellSize = 32;
  const grid = new Map<string, number[]>();
  const numSegs = samples.length - 1;

  for (let i = 0; i < numSegs; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const minCx = Math.floor(Math.min(a.x, b.x) / cellSize);
    const maxCx = Math.floor(Math.max(a.x, b.x) / cellSize);
    const minCz = Math.floor(Math.min(a.z, b.z) / cellSize);
    const maxCz = Math.floor(Math.max(a.z, b.z) / cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx},${cz}`;
        let list = grid.get(key);
        if (!list) {
          list = [];
          grid.set(key, list);
        }
        list.push(i);
      }
    }
  }

  const stamp = new Int32Array(numSegs);
  let stampId = 1;

  const queryNearest = (vx: number, vz: number): { dist: number; roadY: number; s: number } => {
    const cx = Math.floor(vx / cellSize);
    const cz = Math.floor(vz / cellSize);
    let bestDistSq = Infinity;
    let bestY = 0;
    let bestS = 0;
    stampId++;

    const scanCellRange = (rad: number) => {
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          const list = grid.get(`${cx + dx},${cz + dz}`);
          if (!list) continue;
          for (let k = 0; k < list.length; k++) {
            const idx = list[k];
            if (stamp[idx] === stampId) continue;
            stamp[idx] = stampId;

            const a = samples[idx];
            const b = samples[idx + 1];
            const abx = b.x - a.x;
            const abz = b.z - a.z;
            const lenSq = abx * abx + abz * abz;
            let t = 0;
            if (lenSq > 1e-8) {
              t = ((vx - a.x) * abx + (vz - a.z) * abz) / lenSq;
              if (t < 0) t = 0;
              else if (t > 1) t = 1;
            }
            const px = a.x + abx * t;
            const pz = a.z + abz * t;
            const dSq = (vx - px) * (vx - px) + (vz - pz) * (vz - pz);
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestY = a.y + (b.y - a.y) * t;
              bestS = a.s + (b.s - a.s) * t;
            }
          }
        }
      }
    };

    scanCellRange(1);
    if (bestDistSq === Infinity) {
      scanCellRange(4);
    }
    if (bestDistSq === Infinity) {
      for (let idx = 0; idx < numSegs; idx++) {
        const a = samples[idx];
        const b = samples[idx + 1];
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const lenSq = abx * abx + abz * abz;
        let t = 0;
        if (lenSq > 1e-8) {
          t = ((vx - a.x) * abx + (vz - a.z) * abz) / lenSq;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
        }
        const px = a.x + abx * t;
        const pz = a.z + abz * t;
        const dSq = (vx - px) * (vx - px) + (vz - pz) * (vz - pz);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestY = a.y + (b.y - a.y) * t;
          bestS = a.s + (b.s - a.s) * t;
        }
      }
    }

    return {
      dist: bestDistSq < Infinity ? Math.sqrt(bestDistSq) : Infinity,
      roadY: bestY,
      s: bestS,
    };
  };

  return { trackLengthMeters, queryNearest };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function estimateGroundY(vx: number, vz: number, dist: number, roadY: number): number {
  const hillWave =
    Math.sin(vx * 0.011 + 0.4) * Math.cos(vz * 0.013 - 0.2) * 3.8 +
    Math.sin((vx + vz) * 0.023) * 1.4;

  if (dist <= 11.0) {
    return roadY - 0.35;
  }
  if (dist <= 15.0) {
    const blend = smoothstep(11.0, 15.0, dist);
    const targetSlope = roadY + Math.max(-1.2, hillWave * 0.15) - 0.25;
    return Math.min(roadY - 0.2, THREE.MathUtils.lerp(roadY - 0.35, targetSlope, blend));
  }
  if (dist <= 95.0) {
    const upRamp = smoothstep(15.0, 48.0, dist);
    const outFade = 1.0 - smoothstep(72.0, 95.0, dist);
    const slopeRelief = (2.6 + hillWave) * upRamp * outFade;
    const baseValley = THREE.MathUtils.lerp(roadY - 0.25, -2.8, smoothstep(55.0, 95.0, dist));
    return baseValley + slopeRelief;
  }
  return -2.8 + hillWave * 0.25;
}

const _partPos = new THREE.Vector3();
const _partNorm = new THREE.Vector3();
const _partTint = new THREE.Color();
const _partMat4 = new THREE.Matrix4();
const _partQuat = new THREE.Quaternion();
const _partEuler = new THREE.Euler();
const _partScale = new THREE.Vector3(1, 1, 1);

interface AtlasPartSpec {
  geo: THREE.BufferGeometry;
  px?: number;
  py?: number;
  pz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  slot: number;
  subU0?: number;
  subV0?: number;
  subU1?: number;
  subV1?: number;
  tintHex?: string;
  aoHint?: number; // Multiplier for recessed/under-canopy parts (e.g., 0.72..1.0)
}

function buildNormalizedAtlasPart(
  spec: AtlasPartSpec,
  worldMatrix: THREE.Matrix4,
): THREE.BufferGeometry {
  // Ensure consistent indexed geometry with strictly { position, normal, uv, color }
  let g = spec.geo;
  if (!g.index) {
    // Convert non-indexed geometry to simple sequential index so mergeGeometries succeeds uniformly
    const vCount = g.attributes.position.count;
    const indices = new Array<number>(vCount);
    for (let i = 0; i < vCount; i++) indices[i] = i;
    g.setIndex(indices);
  }

  _partEuler.set(spec.rx ?? 0, spec.ry ?? 0, spec.rz ?? 0, 'XYZ');
  _partQuat.setFromEuler(_partEuler);
  _partPos.set(spec.px ?? 0, spec.py ?? 0, spec.pz ?? 0);
  _partScale.set(spec.sx ?? 1, spec.sy ?? 1, spec.sz ?? 1);
  _partMat4.compose(_partPos, _partQuat, _partScale);
  g.applyMatrix4(_partMat4);

  const posAttr = g.attributes.position as THREE.BufferAttribute;
  const normAttr = g.attributes.normal as THREE.BufferAttribute;
  const uvAttr = g.attributes.uv as THREE.BufferAttribute;
  const count = posAttr.count;

  // Remap UVs directly into assigned padded atlas sub-rect
  const rect = getAtlasUvRect(
    spec.slot,
    spec.subU0 ?? 0,
    spec.subV0 ?? 0,
    spec.subU1 ?? 1,
    spec.subV1 ?? 1,
  );
  const uSpan = rect.u1 - rect.u0;
  const vSpan = rect.v1 - rect.v0;
  for (let i = 0; i < count; i++) {
    const u = Math.max(0, Math.min(1, uvAttr.getX(i)));
    const v = Math.max(0, Math.min(1, uvAttr.getY(i)));
    uvAttr.setXY(i, rect.u0 + u * uSpan, rect.v0 + v * vSpan);
  }
  uvAttr.needsUpdate = true;

  // Compute baked Vertex Color Ambient Occlusion in landmark-local space
  _partTint.set(spec.tintHex ?? '#ffffff');
  const partAo = spec.aoHint ?? 1.0;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const vy = posAttr.getY(i);
    const ny = normAttr ? normAttr.getY(i) : 0;

    // Darken vertices near ground level (0.68 at y<=0 -> 1.0 above 2.8m)
    const groundAo = THREE.MathUtils.lerp(0.68, 1.0, smoothstep(0.0, 2.8, Math.max(0, vy)));
    // Darken undersides of overhangs/canopies/eaves
    const soffitAo = ny < -0.25 ? 0.68 : ny < 0.05 ? 0.94 : 1.0;
    const ao = Math.max(0.62, Math.min(1.0, groundAo * soffitAo * partAo));

    colors[i * 3] = _partTint.r * ao;
    colors[i * 3 + 1] = _partTint.g * ao;
    colors[i * 3 + 2] = _partTint.b * ao;
  }

  // Strip any extra attributes so every merged chunk part shares identical attribute layout
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Transform to final world placement
  g.applyMatrix4(worldMatrix);
  return g;
}

// Helper UV sub-rect constants inside Slot 11 architectural utility palette
const UTIL_SLOT = 11;
const CLOCK_SUB = { subU0: 0.04, subV0: 0.54, subU1: 0.46, subV1: 0.96 };
const WHITE_SUB = { subU0: 0.56, subV0: 0.56, subU1: 0.94, subV1: 0.94 };
const CHECK_SUB = { subU0: 0.04, subV0: 0.04, subU1: 0.46, subV1: 0.46 };
const STONE_SUB = { subU0: 0.54, subV0: 0.04, subU1: 0.96, subV1: 0.46 };
const COLONIAL_ROOF_SUB = { subU0: 0.02, subV0: 0.02, subU1: 0.98, subV1: 0.31 };
const COLONIAL_WALL_SUB = { subU0: 0.02, subV0: 0.36, subU1: 0.98, subV1: 0.98 };

function paintAtlasRect(
  g: THREE.BufferGeometry,
  r: AtlasRect,
  mode: 'solid' | 'fit' = 'solid',
) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  if (!uv) return;
  if (mode === 'solid') {
    const cu = (r.u0 + r.u1) * 0.5;
    const cv = (r.v0 + r.v1) * 0.5;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, cu, cv);
    }
  } else {
    const padU = Math.min(0.002, (r.u1 - r.u0) * 0.06);
    const padV = Math.min(0.002, (r.v1 - r.v0) * 0.06);
    const u0 = r.u0 + padU;
    const u1 = r.u1 - padU;
    const v0 = r.v0 + padV;
    const v1 = r.v1 - padV;
    const du = u1 - u0;
    const dv = v1 - v0;
    for (let i = 0; i < uv.count; i++) {
      const u = Math.max(0, Math.min(1, uv.getX(i)));
      const v = Math.max(0, Math.min(1, uv.getY(i)));
      uv.setXY(i, u0 + u * du, v0 + v * dv);
    }
  }
  uv.needsUpdate = true;
}

function bakeGrayscaleAO(g: THREE.BufferGeometry, flat = 1.0) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const norm = g.attributes.normal as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const vy = pos.getY(i);
    const ny = norm ? norm.getY(i) : 0;
    const groundAo = THREE.MathUtils.lerp(0.68, 1.0, smoothstep(0.0, 2.8, Math.max(0, vy)));
    const soffitAo = ny < -0.25 ? 0.68 : ny < 0.05 ? 0.94 : 1.0;
    const ao = Math.max(0.58, Math.min(1.0, groundAo * soffitAo * flat));
    colors[i * 3] = ao;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao;
  }
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.index) {
      const cnt = p.attributes.position.count;
      const seq = new Array<number>(cnt);
      for (let k = 0; k < cnt; k++) seq[k] = k;
      p.setIndex(seq);
    }
    totalVerts += p.attributes.position.count;
    totalIdx += p.index!.count;
  }

  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const col = new Float32Array(totalVerts * 3);
  const idx = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let vo = 0;
  let io = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const pPos = p.attributes.position.array as Float32Array;
    const pNorm = p.attributes.normal.array as Float32Array;
    const pUv = p.attributes.uv.array as Float32Array;
    const pCol = p.attributes.color.array as Float32Array;
    const ix = p.index!.array as ArrayLike<number>;

    pos.set(pPos, vo * 3);
    norm.set(pNorm, vo * 3);
    uv.set(pUv, vo * 2);
    col.set(pCol, vo * 3);
    for (let k = 0; k < ix.length; k++) {
      idx[io + k] = ix[k] + vo;
    }

    vo += p.attributes.position.count;
    io += ix.length;
    p.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * Low-poly procedural builder for Grand Wahid Hotel (Salatiga).
 * Origin = center of building at ground level, +Z = front facing road, +X = right when viewed from road.
 * Returns a single merged BufferGeometry with {position, normal, uv, color} and 0 extra draw calls.
 */
export function buildGrandHotelGeometry(
  p: GrandHotelParams,
  A: GrandHotelAtlas,
): THREE.BufferGeometry {
  const w = Math.max(20, p.widthMeters);
  const d = Math.max(12, p.depthMeters);
  const fl = Math.max(2, Math.round(p.floors));
  const fh = p.floorHeight ?? 3.7;
  const rFl = Math.max(fl, Math.round(p.rightWingFloors ?? fl + 1));

  const sx = w / 44;
  const sz = d / 24;
  const hL = fl * fh;
  const hR = rFl * fh;

  const parts: THREE.BufferGeometry[] = [];
  const pushPart = (
    geo: THREE.BufferGeometry,
    rect: AtlasRect,
    mode: 'solid' | 'fit' = 'solid',
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    ao = 1.0,
  ) => {
    if (rx !== 0 || ry !== 0 || rz !== 0 || px !== 0 || py !== 0 || pz !== 0) {
      _partEuler.set(rx, ry, rz, 'XYZ');
      _partQuat.setFromEuler(_partEuler);
      _partPos.set(px, py, pz);
      _partScale.set(1, 1, 1);
      _partMat4.compose(_partPos, _partQuat, _partScale);
      geo.applyMatrix4(_partMat4);
    }
    paintAtlasRect(geo, rect, mode);
    bakeGrayscaleAO(geo, ao);
    parts.push(geo);
  };

  // Layout along X: Left curved main tower (~42%), recessed center atrium (~18%), right wing (~40%)
  const leftW = w * 0.42;
  const cxL = -w * 0.5 + leftW * 0.5;
  const leftD = 14.0 * sz;
  const czL = -1.5 * sz;

  const midW = w * 0.18;
  const cxM = -w * 0.5 + leftW + midW * 0.5;

  const rightW = w * 0.4;
  const cxR = w * 0.5 - rightW * 0.5;
  const rightD = 12.5 * sz;
  const rightFrontZ = 2.0 * sz; // Set back behind curved tower
  const czR = rightFrontZ - rightD * 0.5;

  // 0. Continuous foundation skirt (-2.2m below y=0) so sloped terrain never exposes gaps
  pushPart(
    new THREE.BoxGeometry(w + 2.6, 2.3, d + 7.4 * sz),
    A.peach,
    'solid',
    0,
    -1.1,
    1.8 * sz,
    0,
    0,
    0,
    0.72,
  );

  // 1. LEFT CURVED MAIN TOWER
  const bayR = Math.min(5.65 * sx, 6.2);
  const bayZ = czL + leftD * 0.5 - 0.8 * sz;

  pushPart(new THREE.BoxGeometry(leftW, hL, leftD), A.plaster, 'solid', cxL, hL * 0.5, czL);
  // Roof parapet cornice
  pushPart(
    new THREE.BoxGeometry(leftW + 0.6, 0.72, leftD + 0.6),
    A.peach,
    'solid',
    cxL,
    hL + 0.34,
    czL,
  );
  // Terracotta vertical side cheek pilasters
  pushPart(
    new THREE.BoxGeometry(0.95 * sx, hL, 0.75),
    A.accent,
    'solid',
    cxL - leftW * 0.5 + 0.5,
    hL * 0.5,
    czL + leftD * 0.5 - 0.1,
  );
  pushPart(
    new THREE.BoxGeometry(0.95 * sx, hL, 0.75),
    A.accent,
    'solid',
    cxL + leftW * 0.5 - 0.5,
    hL * 0.5,
    czL + leftD * 0.5 - 0.1,
  );

  // Semicircular glass curtain bay
  pushPart(
    new THREE.CylinderGeometry(bayR, bayR, hL - 0.3, 20, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
    A.glass,
    'fit',
    cxL,
    (hL - 0.3) * 0.5,
    bayZ,
    0,
    0,
    0,
    0.92,
  );
  // Curved peach crown drum + curved "Grand Wahid Hotel" signboard band
  pushPart(
    new THREE.CylinderGeometry(bayR + 0.55, bayR + 0.55, 1.85, 20, 1, false, -Math.PI * 0.48, Math.PI * 0.96),
    A.peach,
    'solid',
    cxL,
    hL + 0.72,
    bayZ,
  );
  pushPart(
    new THREE.CylinderGeometry(bayR + 0.61, bayR + 0.61, 1.45, 20, 1, true, -Math.PI * 0.38, Math.PI * 0.76),
    A.signCurved,
    'fit',
    cxL,
    hL + 0.72,
    bayZ,
  );

  // 4 tall vertical cream pilasters + horizontal spandrel rings on curved bay
  const pilAngles = [-0.62, -0.21, 0.21, 0.62];
  for (let i = 0; i < pilAngles.length; i++) {
    const ang = pilAngles[i];
    pushPart(
      new THREE.BoxGeometry(0.55, hL - 0.1, 0.75),
      A.plaster,
      'solid',
      cxL + Math.sin(ang) * (bayR + 0.12),
      (hL - 0.1) * 0.5,
      bayZ + Math.cos(ang) * (bayR + 0.12),
      0,
      ang,
      0,
    );
  }
  for (let f = 1; f < fl; f++) {
    pushPart(
      new THREE.CylinderGeometry(bayR + 0.12, bayR + 0.12, 0.22, 18, 1, true, -Math.PI * 0.44, Math.PI * 0.88),
      A.plaster,
      'solid',
      cxL,
      f * fh,
      bayZ,
    );
  }
  // Flanking cheek windows & decorative medallions
  for (const side of [-1, 1]) {
    const wx = cxL + side * (leftW * 0.37);
    for (let f = 0; f < fl; f++) {
      pushPart(
        new THREE.BoxGeometry(2.1 * sx, fh * 0.54, 0.2),
        A.glass,
        'fit',
        wx,
        f * fh + fh * 0.52,
        czL + leftD * 0.5 + 0.04,
      );
      if (f > 0) {
        pushPart(
          new THREE.BoxGeometry(0.45, 0.45, 0.12),
          A.peach,
          'solid',
          wx,
          f * fh + 0.02,
          czL + leftD * 0.5 + 0.06,
        );
      }
    }
  }

  // 2. PROJECTING PORTE-COCHERE DROP-OFF CANOPY
  const pcW = Math.min(11.8 * sx, leftW * 0.68);
  const pcProj = 6.5 * sz;
  const pcBackZ = bayZ + bayR - 0.8;
  const cFront = pcBackZ + pcProj;
  const pcMidZ = (pcBackZ + cFront) * 0.5;
  const cBase = 4.4;
  const cT = 0.7;

  pushPart(new THREE.BoxGeometry(pcW, cT, pcProj), A.plaster, 'solid', cxL, cBase, pcMidZ, 0, 0, 0, 0.74);
  pushPart(
    new THREE.BoxGeometry(pcW + 0.6, 0.34, pcProj + 0.5),
    A.peach,
    'solid',
    cxL,
    cBase + cT * 0.5 + 0.12,
    pcMidZ + 0.1,
  );
  // Raised gold fascia housing + "Grand Wahid" gold sign on canopy front
  pushPart(
    new THREE.BoxGeometry(pcW * 0.86, 1.32, 0.28),
    A.gold,
    'solid',
    cxL,
    cBase + cT + 0.45,
    cFront + 0.14,
  );
  pushPart(
    new THREE.PlaneGeometry(pcW * 0.82, 1.16),
    A.signGold,
    'fit',
    cxL,
    cBase + cT + 0.45,
    cFront + 0.3,
  );

  // 4 thick square pillars supporting canopy
  const pcPillars: [number, number][] = [
    [cxL - pcW * 0.42, cFront - 0.65],
    [cxL + pcW * 0.42, cFront - 0.65],
    [cxL - pcW * 0.42, pcBackZ + 1.4],
    [cxL + pcW * 0.42, pcBackZ + 1.4],
  ];
  for (let i = 0; i < pcPillars.length; i++) {
    const [px, pz] = pcPillars[i];
    pushPart(new THREE.BoxGeometry(1.05, 0.45, 1.05), A.peach, 'solid', px, 0.22, pz, 0, 0, 0, 0.72);
    pushPart(new THREE.BoxGeometry(0.84, cBase - 0.2, 0.84), A.plaster, 'solid', px, cBase * 0.5, pz, 0, 0, 0, 0.78);
  }
  // Stepped under-eave corbel brackets along front & sides
  for (let i = 0; i < 5; i++) {
    const bx = THREE.MathUtils.lerp(cxL - pcW * 0.42, cxL + pcW * 0.42, i / 4);
    pushPart(new THREE.BoxGeometry(0.32, 0.48, 0.46), A.peach, 'solid', bx, cBase - 0.38, cFront + 0.04, 0, 0, 0, 0.7);
  }
  for (let i = 0; i < 3; i++) {
    const bz = THREE.MathUtils.lerp(pcBackZ + 1.2, cFront - 0.9, i / 2);
    for (const side of [-1, 1]) {
      pushPart(
        new THREE.BoxGeometry(0.42, 0.46, 0.32),
        A.peach,
        'solid',
        cxL + side * (pcW * 0.5 + 0.04),
        cBase - 0.38,
        bz,
        0,
        0,
        0,
        0.7,
      );
    }
  }

  // 3. CENTER RECESSED ATRIUM & REAR RED-ROOF TOWER
  const atriumZ = czL + leftD * 0.5 - 5.2 * sz;
  pushPart(
    new THREE.BoxGeometry(midW + 0.8, fh * 1.15, 7.0 * sz),
    A.plaster,
    'solid',
    cxM,
    fh * 0.58,
    atriumZ - 3.2 * sz,
    0,
    0,
    0,
    0.7,
  );
  pushPart(
    new THREE.BoxGeometry(midW + 1.0, 0.4, 7.3 * sz),
    A.peach,
    'solid',
    cxM,
    fh * 1.18,
    atriumZ - 3.2 * sz,
    0,
    0,
    0,
    0.76,
  );
  pushPart(
    new THREE.BoxGeometry(midW * 0.28, fh * 0.72, 0.18),
    A.glass,
    'fit',
    cxM - midW * 0.22,
    fh * 0.52,
    atriumZ + 0.32 * sz,
    0,
    0,
    0,
    0.7,
  );
  pushPart(
    new THREE.BoxGeometry(midW * 0.28, fh * 0.72, 0.18),
    A.glass,
    'fit',
    cxM + midW * 0.22,
    fh * 0.52,
    atriumZ + 0.32 * sz,
    0,
    0,
    0,
    0.7,
  );
  // Rear elevator/stair core + pitched red pyramidal hip roof + white finial
  const coreH = Math.max(hL, hR) + 1.8;
  pushPart(
    new THREE.BoxGeometry(midW * 0.94, coreH, 7.4 * sz),
    A.plaster,
    'solid',
    cxM,
    coreH * 0.5,
    atriumZ - 6.8 * sz,
    0,
    0,
    0,
    0.8,
  );
  pushPart(
    new THREE.BoxGeometry(midW * 0.42, coreH * 0.74, 0.22),
    A.accent,
    'solid',
    cxM,
    coreH * 0.54,
    atriumZ - 3.05 * sz,
    0,
    0,
    0,
    0.82,
  );
  pushPart(
    new THREE.BoxGeometry(midW * 0.24, coreH * 0.68, 0.26),
    A.glass,
    'fit',
    cxM,
    coreH * 0.54,
    atriumZ - 3.0 * sz,
    0,
    0,
    0,
    0.78,
  );
  pushPart(
    new THREE.ConeGeometry(Math.max(midW, 7.4 * sz) * 0.78, 3.8, 4),
    A.accent,
    'solid',
    cxM,
    coreH + 1.9,
    atriumZ - 6.8 * sz,
    0,
    Math.PI / 4,
    0,
  );
  pushPart(
    new THREE.CylinderGeometry(0.18, 0.38, 1.1, 6),
    A.white,
    'solid',
    cxM,
    coreH + 4.05,
    atriumZ - 6.8 * sz,
  );

  // 4. RIGHT WING BLOCK (set back, rFl floors, 3 red pilasters, banded corner bay, side canopy)
  pushPart(new THREE.BoxGeometry(rightW, hR, rightD), A.plaster, 'solid', cxR, hR * 0.5, czR);
  pushPart(
    new THREE.BoxGeometry(rightW + 0.5, 0.75, rightD + 0.5),
    A.peach,
    'solid',
    cxR,
    hR + 0.35,
    czR,
  );
  const rightPilXs = [cxR - rightW * 0.45, cxR - rightW * 0.06, cxR + rightW * 0.47];
  for (let i = 0; i < rightPilXs.length; i++) {
    pushPart(
      new THREE.BoxGeometry(1.0 * sx, hR, 0.65),
      A.accent,
      'solid',
      rightPilXs[i],
      hR * 0.5,
      rightFrontZ + 0.14,
    );
  }
  const rwCols = [cxR - rightW * 0.25, cxR + rightW * 0.22];
  for (let c = 0; c < rwCols.length; c++) {
    for (let f = 0; f < rFl; f++) {
      const wy = f * fh + fh * 0.54;
      pushPart(
        new THREE.BoxGeometry(3.4 * sx, fh * 0.56, 0.2),
        A.glass,
        'fit',
        rwCols[c],
        wy,
        rightFrontZ + 0.04,
      );
    }
  }
  // Horizontal-banded cream/peach corner bay pilasters
  const bandPilXs = [cxR + rightW * 0.1, cxR + rightW * 0.36];
  for (let i = 0; i < bandPilXs.length; i++) {
    const bpx = bandPilXs[i];
    const bands = rFl * 2;
    const bh = hR / bands;
    for (let b = 0; b < bands; b++) {
      pushPart(
        new THREE.BoxGeometry(1.15 * sx, bh - 0.05, 0.52),
        b % 2 === 0 ? A.plaster : A.peach,
        'solid',
        bpx,
        b * bh + bh * 0.5,
        rightFrontZ + 0.12,
      );
    }
  }
  pushPart(
    new THREE.BoxGeometry(4.2 * sx, 1.35, 0.65),
    A.peach,
    'solid',
    cxR + rightW * 0.23,
    hR - 0.4,
    rightFrontZ + 0.2,
  );
  // Side entrance canopy on right wing
  const sideCanopyX = cxR + rightW * 0.23;
  const sideCanopyZ = rightFrontZ + 1.85 * sz;
  pushPart(
    new THREE.BoxGeometry(6.2 * sx, 0.48, 3.6 * sz),
    A.peach,
    'solid',
    sideCanopyX,
    3.7,
    sideCanopyZ,
    0,
    0,
    0,
    0.74,
  );
  pushPart(
    new THREE.BoxGeometry(0.65, 3.6, 0.65),
    A.plaster,
    'solid',
    sideCanopyX - 2.3 * sx,
    1.8,
    sideCanopyZ + 1.2 * sz,
    0,
    0,
    0,
    0.76,
  );
  pushPart(
    new THREE.BoxGeometry(0.65, 3.6, 0.65),
    A.plaster,
    'solid',
    sideCanopyX + 2.3 * sx,
    1.8,
    sideCanopyZ + 1.2 * sz,
    0,
    0,
    0,
    0.76,
  );

  // 5. FOREGROUND LANDSCAPING (hedges, 4 classical statue/lamp posts, fan-palm tree)
  const frontEdgeZ = cFront + 1.35 * sz;
  pushPart(
    new THREE.BoxGeometry(5.5 * sx, 1.05, 1.25),
    A.foliage,
    'solid',
    cxL - leftW * 0.39,
    0.52,
    frontEdgeZ,
    0,
    0,
    0,
    0.85,
  );
  pushPart(
    new THREE.BoxGeometry(19.5 * sx, 1.05, 1.25),
    A.foliage,
    'solid',
    cxM + 1.8 * sx,
    0.52,
    frontEdgeZ,
    0,
    0,
    0,
    0.85,
  );
  pushPart(
    new THREE.BoxGeometry(4.2 * sx, 1.05, 1.25),
    A.foliage,
    'solid',
    cxR + rightW * 0.39,
    0.52,
    frontEdgeZ,
    0,
    0,
    0,
    0.85,
  );

  const lampXs = [cxL - pcW * 0.52, cxL + pcW * 0.52, cxM + midW * 0.35, cxR + rightW * 0.04];
  for (let i = 0; i < lampXs.length; i++) {
    const lx = lampXs[i];
    pushPart(new THREE.BoxGeometry(0.62, 0.85, 0.62), A.peach, 'solid', lx, 0.42, frontEdgeZ - 0.55);
    pushPart(
      new THREE.CylinderGeometry(0.14, 0.24, 1.65, 8),
      A.white,
      'solid',
      lx,
      1.68,
      frontEdgeZ - 0.55,
    );
    pushPart(
      new THREE.CylinderGeometry(0.24, 0.24, 0.42, 8),
      A.white,
      'solid',
      lx,
      2.72,
      frontEdgeZ - 0.55,
    );
  }

  // Stylized tall fan-palm tree on front-left corner
  const palmX = -w * 0.5 + 1.5;
  const palmZ = cFront - 0.4;
  pushPart(new THREE.CylinderGeometry(0.26, 0.46, 10.6, 7), A.peach, 'solid', palmX, 5.3, palmZ, 0, 0, 0, 0.8);
  for (let f = 0; f < 8; f++) {
    const ang = (f / 8) * Math.PI * 2;
    pushPart(
      new THREE.ConeGeometry(1.1, 3.6, 5),
      A.foliage,
      'solid',
      palmX + Math.sin(ang) * 1.65,
      10.6,
      palmZ + Math.cos(ang) * 1.65,
      1.15,
      ang,
      0,
      f % 2 === 0 ? 0.92 : 1.0,
    );
  }

  return mergeParts(parts);
}

/**
 * Places a local Grand Wahid Hotel BufferGeometry into world coordinates matching gpsToWorld & rotationDeg.
 */
export function placeGrandHotel(
  geo: THREE.BufferGeometry,
  b: { lon: number; lat: number; rotationDeg: number },
  groundY: number,
): THREE.BufferGeometry {
  const pos = gpsToWorld(b.lon, b.lat);
  const yawRad = THREE.MathUtils.degToRad(180 - b.rotationDeg);
  const worldMat = new THREE.Matrix4().compose(
    new THREE.Vector3(pos.x, groundY, pos.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad),
    new THREE.Vector3(1, 1, 1),
  );
  geo.applyMatrix4(worldMat);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function buildLandmarkGeometries(
  b: SalatigaCustomBuilding,
  groundY: number,
  signRect: SignboardAtlasRect,
  grandHotelBaseAtlas: Omit<GrandHotelAtlas, 'signCurved'>,
  photoSlot: number | undefined,
): THREE.BufferGeometry[] {
  if (b.style === 'grand-hotel') {
    const hotelAtlas: GrandHotelAtlas = {
      ...grandHotelBaseAtlas,
      signCurved: toAtlasRect(signRect),
    };
    const hotelGeo = buildGrandHotelGeometry(
      {
        widthMeters: b.widthMeters,
        depthMeters: b.depthMeters,
        floors: b.floors,
        floorHeight: b.floorHeight,
      },
      hotelAtlas,
    );
    return [placeGrandHotel(hotelGeo, b, groundY)];
  }

  const pos = gpsToWorld(b.lon, b.lat);
  const yawRad = THREE.MathUtils.degToRad(180 - b.rotationDeg);
  const worldMat = new THREE.Matrix4().compose(
    new THREE.Vector3(pos.x, groundY, pos.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad),
    new THREE.Vector3(1, 1, 1),
  );

  const floorH = b.floorHeight ?? 3.6;
  const totalH = Math.max(2.6, b.floors * floorH);
  const w = Math.max(4, b.widthMeters);
  const d = Math.max(4, b.depthMeters);
  const wallTint = b.wallColor ?? '#f3ede0';
  const roofTint = b.roofColor ?? '#9c3626';

  const specs: AtlasPartSpec[] = [];

  if (b.style === 'clock-roundabout') {
    // Landscaped stepped octagonal stone plinth + planter topiary + clock obelisk + 4 clock dials + finial
    specs.push(
      { geo: new THREE.CylinderGeometry(4.7, 5.2, 2.7, 8), py: -0.65, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.88 },
      { geo: new THREE.CylinderGeometry(4.3, 4.5, 0.32, 8), py: 0.8, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#3f6e34' },
      { geo: new THREE.CylinderGeometry(2.2, 2.6, 1.8, 8), py: 1.75, slot: UTIL_SLOT, ...STONE_SUB, tintHex: wallTint },
      { geo: new THREE.BoxGeometry(2.2, 7.2, 2.2), py: 6.2, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: wallTint },
      // Projecting cornice collar (casts overhang AO below)
      { geo: new THREE.BoxGeometry(2.85, 0.44, 2.85), py: 9.95, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#ffffff' },
      { geo: new THREE.BoxGeometry(2.35, 2.2, 2.35), py: 11.2, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: wallTint },
      // Pyramid clay roof crown & gold spire
      { geo: new THREE.ConeGeometry(2.1, 2.5, 4), py: 13.45, ry: Math.PI / 4, slot: 0, ...COLONIAL_ROOF_SUB, tintHex: '#ffffff' },
      { geo: new THREE.CylinderGeometry(0.05, 0.15, 1.6, 8), py: 15.3, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#d97706' },
      // 3D signboard frame + plaque
      { geo: new THREE.BoxGeometry(4.0, 0.94, 0.24), py: 2.85, pz: 1.24, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b', aoHint: 0.85 },
      { geo: new THREE.BoxGeometry(3.8, 0.8, 0.08), py: 2.85, pz: 1.36, ...signRect },
    );
    // 4-sided clock dials
    const dialOffsets: [number, number, number, number][] = [
      [0, 11.2, 1.2, 0],
      [0, 11.2, -1.2, Math.PI],
      [1.2, 11.2, 0, Math.PI / 2],
      [-1.2, 11.2, 0, -Math.PI / 2],
    ];
    for (const [dx, dy, dz, ry] of dialOffsets) {
      specs.push({
        geo: new THREE.PlaneGeometry(1.75, 1.75),
        px: dx,
        py: dy,
        pz: dz,
        ry,
        slot: UTIL_SLOT,
        ...CLOCK_SUB,
      });
    }
  } else if (b.style === 'colonial-civic') {
    const facadeSlot = photoSlot ?? 0;
    const facadeSub = photoSlot !== undefined ? {} : COLONIAL_WALL_SUB;

    // Stepped stone plinth + foundation skirt
    specs.push(
      { geo: new THREE.BoxGeometry(w + 2.6, 2.7, d + 3.4), py: -0.75, pz: 0.6, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.84 },
      // Recessed main colonial block
      { geo: new THREE.BoxGeometry(w, totalH, d), py: 0.6 + totalH * 0.5, pz: -0.4, slot: facadeSlot, ...facadeSub, aoHint: 0.94 },
      // Recessed central portico entry bay
      { geo: new THREE.BoxGeometry(w * 0.28, totalH * 0.84, 0.7), py: 0.6 + totalH * 0.42, pz: d * 0.5 - 0.55, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#3f2a1d', aoHint: 0.72 },
      // Overhanging front portico roof slab
      { geo: new THREE.BoxGeometry(w * 0.7, 0.48, 4.5), py: 0.6 + totalH + 0.12, pz: d * 0.5 + 1.25, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#ffffff' },
      // Tiered Javanese-Dutch Limasan hipped terracotta roof with deep eaves overhang
      {
        geo: new THREE.ConeGeometry(Math.max(w, d) * 0.76, 3.6, 4),
        py: 0.6 + totalH + 1.85,
        pz: -0.4,
        ry: Math.PI / 4,
        sx: (w + 1.4) / Math.max(w, d),
        sz: (d + 1.4) / Math.max(w, d),
        slot: 0,
        ...COLONIAL_ROOF_SUB,
      },
      { geo: new THREE.ConeGeometry(w * 0.28, 2.1, 4), py: 0.6 + totalH + 3.65, pz: -0.4, ry: Math.PI / 4, slot: 0, ...COLONIAL_ROOF_SUB },
      // 3D Signboard frame + plaque
      { geo: new THREE.BoxGeometry(Math.min(11.4, w * 0.47), 1.5, 0.26), py: 0.6 + totalH + 0.8, pz: d * 0.5 + 3.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1f2937', aoHint: 0.9 },
      { geo: new THREE.BoxGeometry(Math.min(11.0, w * 0.45), 1.32, 0.08), py: 0.6 + totalH + 0.8, pz: d * 0.5 + 3.24, ...signRect },
    );

    // 6 Tuscan columns with bases & capitals (occluded slightly by portico roof overhang)
    for (let i = 0; i < 6; i++) {
      const cx = THREE.MathUtils.lerp(-w * 0.29, w * 0.29, i / 5);
      specs.push(
        { geo: new THREE.BoxGeometry(0.75, 0.35, 0.75), px: cx, py: 0.78, pz: d * 0.5 + 2.85, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.76 },
        { geo: new THREE.CylinderGeometry(0.24, 0.29, totalH - 0.3, 8), px: cx, py: 0.6 + totalH * 0.5, pz: d * 0.5 + 2.85, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#faf8f2', aoHint: 0.82 },
        { geo: new THREE.BoxGeometry(0.72, 0.28, 0.72), px: cx, py: 0.6 + totalH - 0.14, pz: d * 0.5 + 2.85, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#ffffff', aoHint: 0.74 },
      );
    }
  } else if (b.style === 'market-complex') {
    const facadeSlot = photoSlot ?? 1;

    specs.push(
      // Foundation plinth
      { geo: new THREE.BoxGeometry(w + 1.4, 2.4, d + 1.4), py: -1.1, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.82 },
      // Ground arcade recessed market core (darkened for arcade shadow depth)
      { geo: new THREE.BoxGeometry(w - 1.6, floorH, d - 1.4), py: floorH * 0.5, slot: 1, subU0: 0, subV0: 0, subU1: 1, subV1: 0.34, aoHint: 0.72 },
      // Upper multi-story market body
      { geo: new THREE.BoxGeometry(w, Math.max(2.6, totalH - floorH), d), py: floorH + (totalH - floorH) * 0.5, slot: facadeSlot, aoHint: 0.96 },
      // Rooftop parapet + mechanical penthouse
      { geo: new THREE.BoxGeometry(w + 0.6, 1.15, d + 0.6), py: totalH + 0.55, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: roofTint },
      { geo: new THREE.BoxGeometry(w * 0.36, 1.8, d * 0.36), py: totalH + 1.9, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
      // 3D signboard frame + plaque
      { geo: new THREE.BoxGeometry(Math.min(14.4, w * 0.54), 1.98, 0.28), py: totalH + 0.9, pz: d * 0.5 + 0.34, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#0f172a' },
      { geo: new THREE.BoxGeometry(Math.min(14.0, w * 0.52), 1.8, 0.08), py: totalH + 0.9, pz: d * 0.5 + 0.49, ...signRect },
    );

    // Arcade pillars along front facade
    const numPillars = 6;
    for (let p = 0; p < numPillars; p++) {
      const px = THREE.MathUtils.lerp(-w * 0.46, w * 0.46, p / (numPillars - 1));
      specs.push({
        geo: new THREE.BoxGeometry(0.62, floorH, 0.62),
        px,
        py: floorH * 0.5,
        pz: d * 0.5 - 0.35,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: wallTint,
        aoHint: 0.78,
      });
    }

    // Horizontal sun-breaker ledges per floor
    for (let fl = 1; fl < b.floors; fl++) {
      specs.push({
        geo: new THREE.BoxGeometry(w + 0.9, 0.26, d + 0.9),
        py: fl * floorH + 0.25,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: '#f1f5f9',
      });
    }

    // 5 stepped colorful market stall canopies along road-facing front
    const canopyColors = ['#c2410c', '#0f766e', '#b45309', '#0f766e', '#c2410c'];
    const segW = w / canopyColors.length;
    for (let i = 0; i < canopyColors.length; i++) {
      specs.push({
        geo: new THREE.BoxGeometry(segW - 0.32, 0.22, 3.3),
        px: -w * 0.5 + segW * (i + 0.5),
        py: 3.35,
        pz: d * 0.5 + 1.45,
        rx: 0.22,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: canopyColors[i],
      });
    }
  } else if (b.style === 'shophouse-row') {
    const facadeSlot = photoSlot ?? 2;
    const numBays = 5;
    const bayW = w / numBays;
    const bayPalettes = ['#efe4d2', '#e5d3b8', '#dce5dd', '#ebd8c8', '#e6dfcf'];
    const awningColors = ['#b91c1c', '#1d4ed8', '#047857', '#b45309', '#991b1b'];

    specs.push(
      { geo: new THREE.BoxGeometry(w + 0.9, 2.4, d + 2.0), py: -1.1, pz: 0.5, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.84 },
      { geo: new THREE.BoxGeometry(Math.min(13.4, w * 0.44), 1.6, 0.26), py: 4.15, pz: d * 0.5 + 0.35, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b' },
      { geo: new THREE.BoxGeometry(Math.min(13.0, w * 0.42), 1.42, 0.08), py: 4.15, pz: d * 0.5 + 0.5, ...signRect },
    );

    for (let i = 0; i < numBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      // Recessed ground walkway + shutter bay
      specs.push(
        {
          geo: new THREE.BoxGeometry(bayW - 0.32, floorH, d - 1.1),
          px: bx,
          py: floorH * 0.5,
          pz: -0.55,
          slot: 2,
          subU0: 0,
          subV0: 0,
          subU1: 1,
          subV1: 0.42,
          tintHex: bayPalettes[i % bayPalettes.length],
          aoHint: 0.74,
        },
        // Upper shophouse facade
        {
          geo: new THREE.BoxGeometry(bayW - 0.24, Math.max(2.4, totalH - floorH), d),
          px: bx,
          py: floorH + (totalH - floorH) * 0.5,
          slot: facadeSlot,
          tintHex: bayPalettes[i % bayPalettes.length],
          aoHint: 0.96,
        },
        // Side bay pillar down to ground
        {
          geo: new THREE.BoxGeometry(0.42, floorH, 0.42),
          px: bx - bayW * 0.46,
          py: floorH * 0.5,
          pz: d * 0.5 - 0.25,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: bayPalettes[i % bayPalettes.length],
          aoHint: 0.8,
        },
        // Stepped awning overhang
        {
          geo: new THREE.BoxGeometry(bayW - 0.28, 0.22, 2.45),
          px: bx,
          py: 3.25,
          pz: d * 0.5 + 1.05,
          rx: 0.18,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: awningColors[i % awningColors.length],
        },
        // Overhanging terracotta roof slab
        {
          geo: new THREE.BoxGeometry(bayW + 0.22, 0.36, d + 1.5),
          px: bx,
          py: totalH + 0.36,
          pz: 0.3,
          rx: 0.16,
          slot: 0,
          ...COLONIAL_ROOF_SUB,
          tintHex: '#ffffff',
        },
      );
    }
  } else if (b.style === 'campus-gate') {
    const facadeSlot = photoSlot ?? 0;
    const facadeSub = photoSlot !== undefined ? {} : COLONIAL_WALL_SUB;

    specs.push(
      { geo: new THREE.BoxGeometry(w + 1.8, 2.4, d + 4.6), py: -1.1, pz: 1.4, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.84 },
      // Main academic block
      { geo: new THREE.BoxGeometry(w, totalH, d * 0.68), py: totalH * 0.5, pz: -d * 0.16, slot: facadeSlot, ...facadeSub },
      // Recessed central entrance portal on academic hall
      { geo: new THREE.BoxGeometry(w * 0.24, floorH * 0.9, 0.9), py: floorH * 0.45, pz: -d * 0.16 + d * 0.34 - 0.3, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b', aoHint: 0.7 },
      // Overhanging Javanese campus hipped roof
      {
        geo: new THREE.ConeGeometry(w * 0.63, 3.5, 4),
        py: totalH + 1.75,
        pz: -d * 0.16,
        ry: Math.PI / 4,
        sz: 0.56,
        slot: 0,
        ...COLONIAL_ROOF_SUB,
      },
      // Twin stone entrance gate pylons + stepped stone caps
      { geo: new THREE.BoxGeometry(2.2, 6.2, 2.2), px: -w * 0.28, py: 3.1, pz: d * 0.5 + 1.5, slot: UTIL_SLOT, ...STONE_SUB },
      { geo: new THREE.BoxGeometry(2.6, 0.45, 2.6), px: -w * 0.28, py: 6.4, pz: d * 0.5 + 1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f8fafc' },
      { geo: new THREE.BoxGeometry(2.2, 6.2, 2.2), px: w * 0.28, py: 3.1, pz: d * 0.5 + 1.5, slot: UTIL_SLOT, ...STONE_SUB },
      { geo: new THREE.BoxGeometry(2.6, 0.45, 2.6), px: w * 0.28, py: 6.4, pz: d * 0.5 + 1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f8fafc' },
      // Spanning university arch beam + 3D crest signboard
      { geo: new THREE.BoxGeometry(w * 0.68, 1.4, 1.45), py: 6.0, pz: d * 0.5 + 1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f8fafc' },
      { geo: new THREE.BoxGeometry(w * 0.58, 1.38, 0.22), py: 6.0, pz: d * 0.5 + 2.2, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e3a8a' },
      { geo: new THREE.BoxGeometry(w * 0.56, 1.24, 0.08), py: 6.0, pz: d * 0.5 + 2.33, ...signRect },
    );
  } else if (b.style === 'highland-cafe') {
    const facadeSlot = photoSlot ?? 3;

    specs.push(
      { geo: new THREE.BoxGeometry(w + 1.6, 2.5, d + 3.0), py: -1.15, pz: 0.8, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.84 },
      // Recessed warm-lit ground cafe box
      { geo: new THREE.BoxGeometry(w * 0.92, floorH, d * 0.9), py: floorH * 0.5, pz: -0.25, slot: facadeSlot, aoHint: 0.76 },
      // Cantilevered upper viewing deck slab (creates crisp overhang shadow on ground floor)
      { geo: new THREE.BoxGeometry(w + 1.9, 0.36, d + 3.5), py: floorH + 0.18, pz: 1.0, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#475569' },
      // Glass terrace balustrade
      { geo: new THREE.BoxGeometry(w + 1.7, 0.95, 0.14), py: floorH + 0.82, pz: d * 0.5 + 2.65, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
      // Upper timber-slat lounge box
      { geo: new THREE.BoxGeometry(w * 0.78, floorH * 0.92, d * 0.76), py: floorH + floorH * 0.46, pz: -d * 0.08, slot: 3, subU0: 0.75, subV0: 0, subU1: 1, subV1: 1 },
      // Slanted cantilevered modern roof canopy
      { geo: new THREE.BoxGeometry(w + 2.4, 0.34, d + 4.0), py: totalH + 0.7, pz: 0.85, rx: -0.14, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: roofTint },
      // 3D signboard frame + plaque
      { geo: new THREE.BoxGeometry(Math.min(10.8, w * 0.54), 1.48, 0.26), py: floorH + 0.95, pz: d * 0.5 + 2.74, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1c1917' },
      { geo: new THREE.BoxGeometry(Math.min(10.4, w * 0.52), 1.3, 0.08), py: floorH + 0.95, pz: d * 0.5 + 2.88, ...signRect },
    );
  } else {
    // 'finish-gate': Race Control Hospitality Pavilion & Timing Tower
    const facadeSlot = photoSlot ?? 3;

    specs.push(
      { geo: new THREE.BoxGeometry(w + 1.4, 2.4, d + 1.6), py: -1.1, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.84 },
      // Recessed ground paddock bay
      { geo: new THREE.BoxGeometry(w * 0.7, floorH, d - 1.0), px: -w * 0.12, py: floorH * 0.5, pz: -0.35, slot: facadeSlot, aoHint: 0.74 },
      // Upper race control glass observation deck
      { geo: new THREE.BoxGeometry(w * 0.74, Math.max(2.4, totalH - floorH), d), px: -w * 0.12, py: floorH + (totalH - floorH) * 0.5, slot: facadeSlot },
      // Tall timing & telemetry tower
      { geo: new THREE.BoxGeometry(w * 0.24, totalH + 3.8, d * 0.86), px: w * 0.36, py: (totalH + 3.8) * 0.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f1f5f9' },
      // Checkered motorsport tower band
      { geo: new THREE.BoxGeometry(w * 0.25, 1.35, d * 0.88), px: w * 0.36, py: totalH + 2.35, slot: UTIL_SLOT, ...CHECK_SUB },
      // Red cantilevered finish canopy overhang
      { geo: new THREE.BoxGeometry(w + 0.8, 0.52, d + 1.2), py: totalH + 0.3, pz: 0.2, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: roofTint },
      // 3D signboard frame + plaque
      { geo: new THREE.BoxGeometry(Math.min(13.9, w * 0.64), 1.78, 0.28), py: totalH + 1.25, pz: d * 0.5 + 0.4, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#111827' },
      { geo: new THREE.BoxGeometry(Math.min(13.5, w * 0.62), 1.6, 0.08), py: totalH + 1.25, pz: d * 0.5 + 0.55, ...signRect },
    );
  }

  const out: THREE.BufferGeometry[] = new Array(specs.length);
  for (let i = 0; i < specs.length; i++) {
    out[i] = buildNormalizedAtlasPart(specs[i], worldMat);
  }
  return out;
}

interface OsmPolygonRecord {
  ring: [number, number][];
  floors: number;
  seed: number;
  chunkIdx: number;
  wallColor: THREE.Color;
  roofColor: THREE.Color;
}

const OSM_WALL_PALETTE = [
  '#efe8da',
  '#e5dac6',
  '#f4f0e8',
  '#dfd8cc',
  '#e9d9c8',
  '#dde2dc',
  '#e8e2d5',
];

const OSM_ROOF_PALETTE = [
  '#9c4532',
  '#8c3c2b',
  '#a6533c',
  '#646d78',
  '#755143',
  '#565f6b',
];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function estimateOsmFloors(props: Record<string, unknown> | undefined, seed: number): number {
  const rawLevels = props?.['building:levels'];
  if (rawLevels !== undefined && rawLevels !== null) {
    const parsed = parseFloat(String(rawLevels));
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(6, Math.max(1, Math.round(parsed)));
    }
  }

  const bType = String(props?.building ?? '').toLowerCase();
  const amenity = String(props?.amenity ?? '').toLowerCase();
  if (bType === 'hotel' || bType === 'hospital' || bType === 'university') {
    return seed > 0.5 ? 3 : 2;
  }
  if (
    bType === 'commercial' ||
    bType === 'retail' ||
    bType === 'office' ||
    bType === 'civic' ||
    amenity === 'marketplace'
  ) {
    return seed > 0.65 ? 3 : 2;
  }
  if (bType === 'school' || bType === 'mosque' || bType === 'church') {
    return seed > 0.5 ? 2 : 1;
  }
  return seed > 0.72 ? 2 : 1;
}

function cleanWorldRing(rawCoords: unknown): [number, number][] {
  if (!Array.isArray(rawCoords) || rawCoords.length < 3) return [];
  const pts: [number, number][] = [];

  for (let i = 0; i < rawCoords.length; i++) {
    const c = rawCoords[i];
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const w = gpsToWorld(lon, lat);
    if (pts.length > 0) {
      const prev = pts[pts.length - 1];
      const dx = w.x - prev[0];
      const dz = w.z - prev[1];
      if (dx * dx + dz * dz < 0.09) continue;
    }
    pts.push([w.x, w.z]);
  }

  if (pts.length >= 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dx = first[0] - last[0];
    const dz = first[1] - last[1];
    if (dx * dx + dz * dz < 0.09) {
      pts.pop();
    }
  }

  if (pts.length < 3) return [];

  let signedAreaMap = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    signedAreaMap += a[0] * -b[1] - b[0] * -a[1];
  }
  if (Math.abs(signedAreaMap) < 2.0) return [];
  if (signedAreaMap < 0) {
    pts.reverse();
  }

  return pts;
}

function buildChunkedOsmMeshes(
  trackQuery: TrackSpatialQuery,
  customPositions: { x: number; z: number; radius: number }[],
  geoJsonData: unknown,
  osmMaterial: THREE.MeshStandardMaterial,
): THREE.Mesh[] {
  if (!geoJsonData || typeof geoJsonData !== 'object') return [];
  const features = (geoJsonData as { features?: unknown[] }).features;
  if (!Array.isArray(features) || features.length === 0) return [];

  // 10.2m minimum vertex clearance guarantees zero overlap with +/-7.0m asphalt & +/-8.2m Armco barriers
  // 95m outer corridor matches highland terrain slope boundary (prevents off-track sprawl)
  const MIN_ROAD_CLEARANCE_METERS = 10.2;
  const MAX_CORRIDOR_METERS = 95.0;

  const chunkRecords = new Map<number, OsmPolygonRecord[]>();
  const tmpWallColor = new THREE.Color();
  const tmpRoofColor = new THREE.Color();

  const processRing = (
    rawRing: unknown,
    props: Record<string, unknown> | undefined,
    featureIdx: number,
  ) => {
    const ring = cleanWorldRing(rawRing);
    if (ring.length < 3) return;

    let cx = 0;
    let cz = 0;
    for (let i = 0; i < ring.length; i++) {
      cx += ring[i][0];
      cz += ring[i][1];
    }
    cx /= ring.length;
    cz /= ring.length;

    for (let i = 0; i < customPositions.length; i++) {
      const cp = customPositions[i];
      const dx = cx - cp.x;
      const dz = cz - cp.z;
      if (dx * dx + dz * dz <= cp.radius * cp.radius) return;
    }

    const cenHit = trackQuery.queryNearest(cx, cz);
    if (cenHit.dist < MIN_ROAD_CLEARANCE_METERS || cenHit.dist > MAX_CORRIDOR_METERS) {
      return;
    }

    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (trackQuery.queryNearest(a[0], a[1]).dist < MIN_ROAD_CLEARANCE_METERS) return;
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;
      if (trackQuery.queryNearest(mx, mz).dist < MIN_ROAD_CLEARANCE_METERS) return;
    }

    const seed = hashString(`${featureIdx}:${Math.round(cx)}:${Math.round(cz)}`);
    const floors = estimateOsmFloors(props, seed);
    const wallHex = OSM_WALL_PALETTE[Math.floor(seed * OSM_WALL_PALETTE.length) % OSM_WALL_PALETTE.length];
    const roofHex = OSM_ROOF_PALETTE[Math.floor(((seed * 13.7) % 1) * OSM_ROOF_PALETTE.length) % OSM_ROOF_PALETTE.length];

    tmpWallColor.set(wallHex);
    tmpRoofColor.set(roofHex);

    const chunkIdx = Math.floor(cenHit.s / CHUNK_LENGTH_METERS);
    let list = chunkRecords.get(chunkIdx);
    if (!list) {
      list = [];
      chunkRecords.set(chunkIdx, list);
    }
    list.push({
      ring,
      floors,
      seed,
      chunkIdx,
      wallColor: tmpWallColor.clone(),
      roofColor: tmpRoofColor.clone(),
    });
  };

  for (let fIdx = 0; fIdx < features.length; fIdx++) {
    const f = features[fIdx] as {
      properties?: Record<string, unknown>;
      geometry?: { type?: string; coordinates?: unknown };
    };
    const geom = f?.geometry;
    if (!geom || !geom.coordinates) continue;

    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
      processRing(geom.coordinates[0], f.properties, fIdx);
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
      for (let p = 0; p < geom.coordinates.length; p++) {
        const poly = geom.coordinates[p];
        if (Array.isArray(poly) && poly.length > 0) {
          processRing(poly[0], f.properties, fIdx * 17 + p);
        }
      }
    }
  }

  const meshes: THREE.Mesh[] = [];
  const FLOOR_HEIGHT_METERS = 3.25;

  const sortedChunks = Array.from(chunkRecords.keys()).sort((a, b) => a - b);
  for (const chunkIdx of sortedChunks) {
    const records = chunkRecords.get(chunkIdx)!;
    const pos: number[] = [];
    const norm: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];

    for (let r = 0; r < records.length; r++) {
      const rec = records[r];
      const ring = rec.ring;
      const n = ring.length;

      let minTerrainY = Infinity;
      let maxTerrainY = -Infinity;
      for (let i = 0; i < n; i++) {
        const vx = ring[i][0];
        const vz = ring[i][1];
        const hit = trackQuery.queryNearest(vx, vz);
        const gy = estimateGroundY(vx, vz, hit.dist, hit.roadY);
        if (gy < minTerrainY) minTerrainY = gy;
        if (gy > maxTerrainY) maxTerrainY = gy;
      }

      const baseY = minTerrainY - 2.2;
      const eaveY = maxTerrainY + rec.floors * FLOOR_HEIGHT_METERS;
      const vMax = (eaveY - baseY) / FLOOR_HEIGHT_METERS;

      // 1. Extruded walls with baked ground-base & roof-eave Vertex Color AO
      const wc = rec.wallColor;
      const baseAo = 0.68; // Ground contact AO
      const topAo = 0.88; // Subtle under-eave AO
      for (let i = 0; i < n; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const edgeLen = Math.hypot(dx, dz);
        if (edgeLen < 1e-4) continue;

        const nx = -dz / edgeLen;
        const nz = dx / edgeLen;
        const uMax = edgeLen / 6.0;

        const vBase = pos.length / 3;
        pos.push(
          a[0], baseY, a[1],
          b[0], baseY, b[1],
          b[0], eaveY, b[1],
          a[0], eaveY, a[1],
        );
        for (let k = 0; k < 4; k++) {
          norm.push(nx, 0, nz);
        }
        col.push(
          wc.r * baseAo, wc.g * baseAo, wc.b * baseAo,
          wc.r * baseAo, wc.g * baseAo, wc.b * baseAo,
          wc.r * topAo, wc.g * topAo, wc.b * topAo,
          wc.r * topAo, wc.g * topAo, wc.b * topAo,
        );
        uv.push(0, 0, uMax, 0, uMax, vMax, 0, vMax);
        idx.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
      }

      // 2. Roof merged into the SAME chunk buffer (UV at 0.05, 0.96 samples neutral white plaster border)
      const contour2D: THREE.Vector2[] = new Array(n);
      let cx = 0;
      let cz = 0;
      for (let i = 0; i < n; i++) {
        contour2D[i] = new THREE.Vector2(ring[i][0], -ring[i][1]);
        cx += ring[i][0];
        cz += ring[i][1];
      }
      cx /= n;
      cz /= n;

      const faces = THREE.ShapeUtils.triangulateShape(contour2D, []);
      const rc = rec.roofColor;
      const roofPeakY = eaveY + (rec.floors <= 2 ? 1.15 : 0.45);
      const roofBaseVert = pos.length / 3;

      if (n <= 6 && rec.floors <= 2) {
        for (let i = 0; i < n; i++) {
          const rx = ring[i][0];
          const rz = ring[i][1];
          const vx = rx - cx;
          const vz = rz - cz;
          const len = Math.hypot(vx, vz) || 1;
          pos.push(rx, eaveY, rz);
          norm.push((vx / len) * 0.45, 0.89, (vz / len) * 0.45);
          uv.push(0.05, 0.96);
          col.push(rc.r * 0.82, rc.g * 0.82, rc.b * 0.82); // Eave AO
        }
        const peakVert = roofBaseVert + n;
        pos.push(cx, roofPeakY, cz);
        norm.push(0, 1, 0);
        uv.push(0.05, 0.96);
        col.push(
          Math.min(1, rc.r * 1.04),
          Math.min(1, rc.g * 1.04),
          Math.min(1, rc.b * 1.04),
        );

        for (let i = 0; i < n; i++) {
          const iNext = (i + 1) % n;
          const p0x = ring[i][0];
          const p0z = ring[i][1];
          const p1x = ring[iNext][0];
          const p1z = ring[iNext][1];
          const ny = (p1z - p0z) * (cx - p0x) - (p1x - p0x) * (cz - p0z);
          if (ny >= 0) {
            idx.push(roofBaseVert + i, roofBaseVert + iNext, peakVert);
          } else {
            idx.push(roofBaseVert + i, peakVert, roofBaseVert + iNext);
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          pos.push(ring[i][0], eaveY, ring[i][1]);
          norm.push(0, 1, 0);
          uv.push(0.05, 0.96);
          col.push(rc.r * 0.94, rc.g * 0.94, rc.b * 0.94);
        }
        for (let t = 0; t < faces.length; t++) {
          const [ia, ib, ic] = faces[t];
          const p0x = ring[ia][0];
          const p0z = ring[ia][1];
          const p1x = ring[ib][0];
          const p1z = ring[ib][1];
          const p2x = ring[ic][0];
          const p2z = ring[ic][1];
          const ny = (p1z - p0z) * (p2x - p0x) - (p1x - p0x) * (p2z - p0z);
          if (ny >= 0) {
            idx.push(roofBaseVert + ia, roofBaseVert + ib, roofBaseVert + ic);
          } else {
            idx.push(roofBaseVert + ia, roofBaseVert + ic, roofBaseVert + ib);
          }
        }
      }
    }

    if (idx.length === 0) continue;
    const chunkGeo = new THREE.BufferGeometry();
    chunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    chunkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    chunkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    chunkGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    chunkGeo.setIndex(idx);
    chunkGeo.computeBoundingBox();
    chunkGeo.computeBoundingSphere();

    const mesh = new THREE.Mesh(chunkGeo, osmMaterial);
    mesh.name = `OsmCorridor_Chunk_${chunkIdx}`;
    mesh.frustumCulled = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.push(mesh);
  }

  return meshes;
}

/**
 * Builds Stage 2 custom Salatiga landmarks and OSM corridor buildings using:
 * - Single 2048x2048 dynamic runtime texture atlas (single MeshStandardMaterial for all landmarks)
 * - Procedural low-poly architectural depth + baked Vertex Color Ambient Occlusion
 * - 150m route-chunked BufferGeometryUtils.mergeGeometries batching with frustum culling
 * Plug-and-play compatible with F1cityrace.
 */
export function buildSalatigaCustomBuildings(
  trackCurve: THREE.CatmullRomCurve3,
  geoJsonData?: any,
  customBuildingsOverride?: SalatigaCustomBuilding[],
): SalatigaBuildingsBuildResult {
  const group = new THREE.Group();
  group.name = 'SalatigaBuildings';

  const buildings = customBuildingsOverride ?? SALATIGA_CUSTOM_BUILDINGS;
  const trackQuery = createTrackSpatialQuery(trackCurve);

  // 1. Build 2048x2048 Dynamic Runtime Atlas & Single Shared Landmark Material
  const atlas = buildRuntimeTextureAtlas(buildings);
  const landmarkMaterial = new THREE.MeshStandardMaterial({
    map: atlas.texture ?? undefined,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.08,
  });

  // 2. Partition custom landmarks into 150m route chunks & merge geometries per chunk
  const customPositions: { x: number; z: number; radius: number }[] = [];
  const landmarkChunkBuckets = new Map<number, THREE.BufferGeometry[]>();

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const worldPos = gpsToWorld(b.lon, b.lat);
    const hit = trackQuery.queryNearest(worldPos.x, worldPos.z);
    const groundY = estimateGroundY(worldPos.x, worldPos.z, hit.dist, hit.roadY);
    const chunkIdx = Math.floor(hit.s / CHUNK_LENGTH_METERS);

    customPositions.push({
      x: worldPos.x,
      z: worldPos.z,
      radius: b.exclusionRadius ?? 22,
    });

    const signRect = atlas.signboardRectMap.get(b.id) ?? getSignRectFromHalfIndex(0);
    const photoSlot = atlas.photoSlotMap.get(b.id);
    const partGeos = buildLandmarkGeometries(
      b,
      groundY,
      signRect,
      atlas.grandHotelBaseAtlas,
      photoSlot,
    );

    let bucket = landmarkChunkBuckets.get(chunkIdx);
    if (!bucket) {
      bucket = [];
      landmarkChunkBuckets.set(chunkIdx, bucket);
    }
    for (let p = 0; p < partGeos.length; p++) {
      bucket.push(partGeos[p]);
    }
  }

  const landmarksGroup = new THREE.Group();
  landmarksGroup.name = 'SalatigaCustomLandmarks_Chunked';
  const sortedLandmarkChunks = Array.from(landmarkChunkBuckets.keys()).sort((a, b) => a - b);
  for (const chunkIdx of sortedLandmarkChunks) {
    const geos = landmarkChunkBuckets.get(chunkIdx)!;
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    // Dispose temporary pre-merge geometries immediately
    for (let g = 0; g < geos.length; g++) {
      geos[g].dispose();
    }
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const chunkMesh = new THREE.Mesh(merged, landmarkMaterial);
    chunkMesh.name = `CustomLandmarks_Chunk_${chunkIdx}`;
    chunkMesh.frustumCulled = true;
    chunkMesh.castShadow = true;
    chunkMesh.receiveShadow = true;
    landmarksGroup.add(chunkMesh);
  }
  group.add(landmarksGroup);

  // 3. Build 150m route-chunked OSM corridor buildings (6m-95m corridor, outside exclusionRadius)
  const osmTex = createOsmFacadeTexture();
  const osmMaterial = new THREE.MeshStandardMaterial({
    map: osmTex ?? undefined,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.05,
  });

  const osmChunkMeshes = buildChunkedOsmMeshes(
    trackQuery,
    customPositions,
    geoJsonData,
    osmMaterial,
  );
  if (osmChunkMeshes.length > 0) {
    const osmGroup = new THREE.Group();
    osmGroup.name = 'OsmCorridorBuildings_Chunked';
    for (let i = 0; i < osmChunkMeshes.length; i++) {
      osmGroup.add(osmChunkMeshes[i]);
    }
    group.add(osmGroup);
  }

  const dispose = () => {
    atlas.cancelPendingLoads();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>([landmarkMaterial, osmMaterial]);
    const textures = new Set<THREE.Texture>();
    if (atlas.texture) textures.add(atlas.texture);
    if (osmTex) textures.add(osmTex);

    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          materials.add(m);
          const std = m as THREE.MeshStandardMaterial;
          if (std.map) textures.add(std.map);
        }
      }
    });

    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
  };

  return { group, dispose };
}
