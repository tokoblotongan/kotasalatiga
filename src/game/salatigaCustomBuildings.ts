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
    | 'grand-hotel'           // Grand Wahid Hotel (Jl. Jend. Sudirman)
    | 'tamansari-arcade'      // Pertokoan Tamansari / Tamansari Shopping Centre
    | 'pasar-raya-ruko'       // Ruko Pasar Raya II Block 1 (Sate Sapi Suruh, Morodadi, Sinar)
    | 'pasar-raya-ruko-south'; // Ruko Pasar Raya II Block 2 (Mandiri, Wadimor, Queen's, Lia, Safira)
  wallColor?: string;
  roofColor?: string;
  exclusionRadius?: number;   // Radius (default 22m) to skip generic GeoJSON polygons
  facadeTextureUrl?: string;  // Optional photo-facade texture URL (atlas slot 12)
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
    id: 'pertokoan-tamansari',
    name: 'PERTOKOAN TAMANSARI',
    lon: 110.504979,
    lat: -7.326152,
    rotationDeg: 277,
    widthMeters: 108,
    depthMeters: 16,
    floors: 2,
    floorHeight: 4.4,
    style: 'tamansari-arcade',
    wallColor: '#dfa394',
    roofColor: '#3b4954',
    exclusionRadius: 58,
  },
  {
    id: 'ruko-pasar-raya-2',
    name: 'RUKO PASAR RAYA II',
    lon: 110.504886,
    lat: -7.326869,
    rotationDeg: 277,
    widthMeters: 38,
    depthMeters: 15,
    floors: 2,
    floorHeight: 4.1,
    style: 'pasar-raya-ruko',
    wallColor: '#ede3cf',
    roofColor: '#8c7a6b',
    exclusionRadius: 24,
  },
  {
    id: 'ruko-safira-block',
    name: 'RUKO PASAR RAYA II (SAFIRA)',
    lon: 110.504848,
    lat: -7.327246,
    rotationDeg: 277,
    widthMeters: 44,
    depthMeters: 15,
    floors: 2,
    floorHeight: 4.1,
    style: 'pasar-raya-ruko-south',
    wallColor: '#ede3cf',
    roofColor: '#8c7a6b',
    exclusionRadius: 26,
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
    id: 'pasar-raya-2',
    name: 'PASAR RAYA II SALATIGA',
    lon: 110.504866,
    lat: -7.327919,
    rotationDeg: 276,
    widthMeters: 88,
    depthMeters: 34,
    floors: 4,
    floorHeight: 4.5,
    style: 'market-complex',
    wallColor: '#e2d3cc',
    roofColor: '#9e8c82',
    exclusionRadius: 50,
  },
  {
    id: 'ruko-jend-sudirman',
    name: 'RUKO JL. JEND. SUDIRMAN',
    lon: 110.504687,
    lat: -7.328583,
    rotationDeg: 274,
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
const CHUNK_LENGTH_METERS = 1750;

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
    case 'tamansari-arcade':
      return ['#f5e4be', '#b91c1c', '#291d14'];
    case 'pasar-raya-ruko':
      return ['#fff7ed', '#ea580c', '#7c2d12'];
    case 'pasar-raya-ruko-south':
      return ['#1d4ed8', '#fbbf24', '#ffffff'];
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
  if (halfIdx === 10) {
    return {
      slot: 13,
      subU0: 0,
      subU1: 1,
      subV0: 0.52,
      subV1: 1.0,
    };
  }
  const safeIdx = halfIdx % 10;
  const slot = 4 + Math.floor(safeIdx / 2);
  const isTopHalf = safeIdx % 2 === 0;
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

function drawTamansariShopSignsSlot10(ctx: CanvasRenderingContext2D) {
  const slot = 10;
  const col = slot % ATLAS_GRID;
  const row = Math.floor(slot / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const innerY = cellY + GUTTER_PX;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
  ctx.clip();

  // Neutral dark slate background between sign cells
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

  // 2 columns x 4 rows inside 500x500 inner area
  const colStarts = [0, 256];
  const colW = 244;
  const rowH = 116;
  const rowGap = 12;

  const shopSigns: {
    c: number;
    r: number;
    label: string;
    bg: string;
    accent: string;
    fg: string;
    mode?: 'blade' | 'cobaltGlass';
  }[] = [
    { c: 0, r: 0, label: 'WAHID MOTOR', bg: '#b91c1c', accent: '#f8fafc', fg: '#ffffff' },
    { c: 1, r: 0, label: 'TAMANSARI TEKNIK', bg: '#1e3a8a', accent: '#fbbf24', fg: '#ffffff' },
    { c: 0, r: 1, label: 'SHARP ELEKTRONIK', bg: '#111827', accent: '#dc2626', fg: '#f8fafc' },
    { c: 1, r: 1, label: '+ APOTEK 24', bg: '#047857', accent: '#d1fae5', fg: '#ffffff' },
    { c: 0, r: 2, label: 'TAMANSARI MEBEL', bg: '#78350f', accent: '#fcd34d', fg: '#fef3c7' },
    { c: 1, r: 2, label: 'PARETO', bg: '#1d4ed8', accent: '#fde047', fg: '#ffffff' },
    { c: 0, r: 3, label: 'BUCCHERI', bg: '#b91c1c', accent: '#fef2f2', fg: '#ffffff', mode: 'blade' },
    { c: 1, r: 3, label: '', bg: '#1e3a8a', accent: '#cbd5e1', fg: '#ffffff', mode: 'cobaltGlass' },
  ];

  for (let i = 0; i < shopSigns.length; i++) {
    const s = shopSigns[i];
    const sx = innerX + colStarts[s.c];
    const sy = innerY + s.r * (rowH + rowGap);

    if (s.mode === 'cobaltGlass') {
      // Cobalt-blue reflective curtain-wall glass with crisp silver mullions
      const grad = ctx.createLinearGradient(sx, sy, sx + colW, sy + rowH);
      grad.addColorStop(0, '#172554');
      grad.addColorStop(0.5, '#2563eb');
      grad.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, colW, rowH);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(sx + 4, sy + 4, colW - 8, rowH - 8);
      ctx.fillStyle = 'rgba(248,250,252,0.48)';
      ctx.fillRect(sx + colW * 0.33, sy + 4, 3, rowH - 8);
      ctx.fillRect(sx + colW * 0.67, sy + 4, 3, rowH - 8);
      ctx.fillRect(sx + 4, sy + rowH * 0.5 - 1.5, colW - 8, 3);
    } else if (s.mode === 'blade') {
      // Crimson-red vertical BUCCHERI blade sign texture (oriented for vertical blade face)
      ctx.fillStyle = s.bg;
      ctx.fillRect(sx, sy, colW, rowH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(sx + 6, sy + 6, colW - 12, rowH - 12);
      ctx.fillStyle = s.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 34px Oxanium, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(s.label, sx + colW * 0.5, sy + rowH * 0.52);
    } else {
      ctx.fillStyle = s.bg;
      ctx.fillRect(sx, sy, colW, rowH);
      ctx.fillStyle = s.accent;
      ctx.fillRect(sx, sy, colW, 10);
      ctx.fillRect(sx, sy + rowH - 10, colW, 10);
      ctx.fillStyle = s.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fs = 24;
      while (fs > 14) {
        ctx.font = `700 ${fs}px Oxanium, "Plus Jakarta Sans", sans-serif`;
        if (ctx.measureText(s.label).width <= colW - 20) break;
        fs -= 1;
      }
      ctx.fillText(s.label, sx + colW * 0.5, sy + rowH * 0.52);
    }
  }
  ctx.restore();
}

const TAMANSARI_SHOP_SUBRECTS = [
  { slot: 10, subU0: 0.015, subV0: 0.77, subU1: 0.475, subV1: 0.985 }, // Wahid Motor
  { slot: 10, subU0: 0.525, subV0: 0.77, subU1: 0.985, subV1: 0.985 }, // Tamansari Teknik
  { slot: 10, subU0: 0.015, subV0: 0.52, subU1: 0.475, subV1: 0.735 }, // Sharp Elektronik
  { slot: 10, subU0: 0.525, subV0: 0.52, subU1: 0.985, subV1: 0.735 }, // Apotek 24
  { slot: 10, subU0: 0.015, subV0: 0.27, subU1: 0.475, subV1: 0.485 }, // Tamansari Mebel
  { slot: 10, subU0: 0.525, subV0: 0.27, subU1: 0.985, subV1: 0.485 }, // Pareto
];
const TAMANSARI_BUCCHERI_SUB = { slot: 10, subU0: 0.015, subV0: 0.02, subU1: 0.475, subV1: 0.235 };
const TAMANSARI_COBALT_GLASS_SUB = { slot: 10, subU0: 0.525, subV0: 0.02, subU1: 0.985, subV1: 0.235 };

function drawPasarRayaRukoTexturesSlot15(ctx: CanvasRenderingContext2D) {
  const slot = 15;
  const col = slot % ATLAS_GRID;
  const row = Math.floor(slot / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const innerY = cellY + GUTTER_PX;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
  ctx.clip();

  ctx.fillStyle = '#ede3cf';
  ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

  // Top strip (y: 0..108px in 500 -> subV 0.784..1.0): "SATE SAPI SURUH & BAKSO" signboard
  const signH = 104;
  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(innerX, innerY, INNER_SIZE, signH);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(innerX, innerY, INNER_SIZE, 12);
  ctx.fillRect(innerX, innerY + signH - 12, INNER_SIZE, 12);
  ctx.fillStyle = '#9a3412';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 32px Oxanium, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SATE SAPI SURUH & BAKSO', innerX + INNER_SIZE * 0.5, innerY + signH * 0.52);

  // Upper-mid band (y: 124..250px -> subV 0.50..0.752): Orange-and-cream striped fabric awning
  const awnY = innerY + 124;
  const awnH = 126;
  const stripes = 14;
  const sw = INNER_SIZE / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ea580c' : '#fef3c7';
    ctx.fillRect(innerX + i * sw, awnY, sw + 0.5, awnH);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(innerX, awnY + awnH - 14, INNER_SIZE, 14);

  // Bottom half (y: 268..500px -> subV 0.0..0.464): Large 2-story "TOKO MORODADI" billboard
  const bbY = innerY + 268;
  const bbH = INNER_SIZE - 268;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(innerX, bbY, INNER_SIZE, bbH);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(innerX, bbY, INNER_SIZE, 28);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(innerX, bbY + 28, INNER_SIZE, 6);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 6;
  ctx.strokeRect(innerX + 10, bbY + 42, INNER_SIZE - 20, bbH - 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 50px Oxanium, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TOKO MORODADI', innerX + INNER_SIZE * 0.5, bbY + bbH * 0.5);
  ctx.fillStyle = '#fde047';
  ctx.font = '700 22px Oxanium, "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BAHAN BANGUNAN · CAT · ALAT LISTRIK', innerX + INNER_SIZE * 0.5, bbY + bbH * 0.78);

  ctx.restore();
}

const SATE_SURUH_SIGN_SUB = { slot: 15, subU0: 0.02, subV0: 0.80, subU1: 0.98, subV1: 0.98 };
const ORANGE_AWNING_SUB = { slot: 15, subU0: 0.02, subV0: 0.51, subU1: 0.98, subV1: 0.74 };
const TOKO_MORODADI_SUB = { slot: 15, subU0: 0.02, subV0: 0.02, subU1: 0.98, subV1: 0.45 };

function drawSafiraRukoTexturesSlot14(ctx: CanvasRenderingContext2D) {
  const slot = 14;
  const col = slot % ATLAS_GRID;
  const row = Math.floor(slot / ATLAS_GRID);
  const cellX = col * CELL_SIZE;
  const cellY = row * CELL_SIZE;
  const innerX = cellX + GUTTER_PX;
  const innerY = cellY + GUTTER_PX;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, CELL_SIZE, CELL_SIZE);
  ctx.clip();

  ctx.fillStyle = '#ede3cf';
  ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

  const halfW = 244;
  const rightX = innerX + 256;
  const rowH = 112;

  const drawPanel = (
    px: number,
    py: number,
    pw: number,
    ph: number,
    bg: string,
    accent: string,
    fg: string,
    title: string,
    subtitle?: string,
    fontSize = 30,
  ) => {
    ctx.fillStyle = bg;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = accent;
    ctx.fillRect(px, py, pw, 10);
    ctx.fillRect(px, py + ph - 10, pw, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 5, py + 13, pw - 10, ph - 26);

    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fs = fontSize;
    while (fs > 14) {
      ctx.font = `800 ${fs}px Oxanium, "Plus Jakarta Sans", sans-serif`;
      if (ctx.measureText(title).width <= pw - 20) break;
      fs -= 1;
    }
    if (subtitle) {
      ctx.fillText(title, px + pw * 0.5, py + ph * 0.42);
      ctx.fillStyle = accent;
      ctx.font = '700 16px Oxanium, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(subtitle, px + pw * 0.5, py + ph * 0.72);
    } else {
      ctx.fillText(title, px + pw * 0.5, py + ph * 0.52);
    }
  };

  // Row 0 (y: 0..112): MANDIRI BUSANA | WADIMOR
  drawPanel(innerX, innerY, halfW, rowH, '#065f46', '#fbbf24', '#ffffff', 'MANDIRI BUSANA', 'TEXTILE & KONVEKSI', 26);
  drawPanel(rightX, innerY, halfW, rowH, '#991b1b', '#fde047', '#ffffff', 'WADIMOR', 'SARUNG TENUN KHAS', 34);

  // Row 1 (y: 124..236): QUEEN'S | LIA
  const r1Y = innerY + 124;
  drawPanel(innerX, r1Y, halfW, rowH, '#581c87', '#f5d061', '#fdf4ff', "QUEEN'S", 'BOUTIQUE & FASHION', 34);
  drawPanel(rightX, r1Y, halfW, rowH, '#f8fafc', '#1e3a8a', '#0f172a', 'LIA', 'TOKO BUSANA', 38);

  // Row 2 (y: 248..368): Bold Blue & Gold TOKO EMAS SAFIRA
  const r2Y = innerY + 248;
  const r2H = 120;
  drawPanel(innerX, r2Y, INNER_SIZE, r2H, '#1d4ed8', '#fbbf24', '#fef08a', 'TOKO EMAS SAFIRA', 'JUAL BELI PERHIASAN EMAS & BERLIAN', 44);

  // Row 3 (y: 380..500): Striped Canvas Awning (#64748b / #b91c1c / #f8fafc) | SINAR
  const r3Y = innerY + 380;
  const r3H = 120;
  const awnStripes = 12;
  const sw = halfW / awnStripes;
  const awnColors = ['#64748b', '#f8fafc', '#b91c1c', '#f8fafc'];
  for (let i = 0; i < awnStripes; i++) {
    ctx.fillStyle = awnColors[i % awnColors.length];
    ctx.fillRect(innerX + i * sw, r3Y, sw + 0.5, r3H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(innerX, r3Y + r3H - 12, halfW, 12);

  drawPanel(rightX, r3Y, halfW, r3H, '#0f172a', '#ef4444', '#ffffff', 'SINAR', 'ELEKTRONIK & OPTIK', 34);

  ctx.restore();
}

function drawMarketGlassInSlot13Bottom(ctx: CanvasRenderingContext2D) {
  const slot = 13;
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

  ctx.fillStyle = '#2f3e46';
  ctx.fillRect(cellX, botY - 6, CELL_SIZE, halfH + 12);

  // Left sub-rect (x: 0..244): Dark green-grey tinted curtain glass (#2f3e46) with mullions
  const lw = 244;
  const grad = ctx.createLinearGradient(innerX, botY, innerX + lw, botY + halfH);
  grad.addColorStop(0, '#233037');
  grad.addColorStop(0.5, '#374a54');
  grad.addColorStop(1, '#26343b');
  ctx.fillStyle = grad;
  ctx.fillRect(innerX, botY, lw, halfH);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(innerX + 4, botY + 4, lw - 8, halfH - 8);
  ctx.fillStyle = 'rgba(226,211,204,0.52)';
  for (let c = 1; c < 4; c++) {
    ctx.fillRect(innerX + (lw * c) / 4 - 1.5, botY + 4, 3, halfH - 8);
  }
  for (let r = 1; r < 3; r++) {
    ctx.fillRect(innerX + 4, botY + (halfH * r) / 3 - 1.5, lw - 8, 3);
  }

  // Right sub-rect (x: 256..500): Repeating horizontal band of square attic clerestory windows
  const rx = innerX + 256;
  ctx.fillStyle = '#d6c7c0';
  ctx.fillRect(rx, botY, lw, halfH);
  const cols = 4;
  const cw = lw / cols;
  for (let c = 0; c < cols; c++) {
    const wx = rx + c * cw + 8;
    const ww = cw - 16;
    const wy = botY + 28;
    const wh = halfH - 56;
    ctx.fillStyle = '#2f3e46';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = '#e2d3cc';
    ctx.lineWidth = 4;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    ctx.fillRect(wx + 4, wy + 4, ww - 8, wh * 0.4);
  }

  ctx.restore();
}

const MANDIRI_SIGN_SUB = { slot: 14, subU0: 0.015, subV0: 0.785, subU1: 0.475, subV1: 0.985 };
const WADIMOR_SIGN_SUB = { slot: 14, subU0: 0.525, subV0: 0.785, subU1: 0.985, subV1: 0.985 };
const QUEENS_SIGN_SUB = { slot: 14, subU0: 0.015, subV0: 0.538, subU1: 0.475, subV1: 0.742 };
const LIA_SIGN_SUB = { slot: 14, subU0: 0.525, subV0: 0.538, subU1: 0.985, subV1: 0.742 };
const SAFIRA_SIGN_SUB = { slot: 14, subU0: 0.015, subV0: 0.274, subU1: 0.985, subV1: 0.494 };
const SAFIRA_AWNING_SUB = { slot: 14, subU0: 0.015, subV0: 0.015, subU1: 0.475, subV1: 0.228 };
const SINAR_SIGN_SUB = { slot: 14, subU0: 0.525, subV0: 0.015, subU1: 0.985, subV1: 0.228 };
const CURTAIN_GLASS_SUB = { slot: 13, subU0: 0.015, subV0: 0.02, subU1: 0.475, subV1: 0.46 };
const CLERESTORY_GLASS_SUB = { slot: 13, subU0: 0.525, subV0: 0.02, subU1: 0.985, subV1: 0.46 };

function buildRuntimeTextureAtlas(buildings: SalatigaCustomBuilding[]): AtlasBuildResult {
  const signboardRectMap = new Map<string, SignboardAtlasRect>();
  const photoSlotMap = new Map<string, number>();

  for (let i = 0; i < buildings.length; i++) {
    // Slots 4..8 hold bands 0..9; Slot 13 top holds band 10
    const idx = i < 11 ? i : i % 10;
    signboardRectMap.set(buildings[i].id, getSignRectFromHalfIndex(idx));
  }
  const grandHotelBaseAtlas = getGrandHotelBaseAtlas();

  let nextPhotoSlot = 12;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (b.facadeTextureUrl && nextPhotoSlot <= 12) {
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

  // Slots 4-8 (0..9) + Slot 13 top (10): High-contrast 3D building signboard bands
  for (let i = 0; i < Math.min(buildings.length, 11); i++) {
    const b = buildings[i];
    const [bg, accent, textCol] = getSignboardColors(b.style);
    const slot = i === 10 ? 13 : 4 + Math.floor(i / 2);
    const isTopHalf = i === 10 ? true : i % 2 === 0;
    let displayLabel = b.name;
    if (b.style === 'grand-hotel' && b.name === 'GRAND WAHID HOTEL') {
      displayLabel = 'Grand Wahid Hotel';
    } else if (b.style === 'tamansari-arcade' && b.name === 'PERTOKOAN TAMANSARI') {
      displayLabel = 'TAMANSARI Shopping Centre';
    }
    drawHalfBandSignboard(ctx, slot, isTopHalf, displayLabel, bg, accent, textCol, false);
  }

  // Slot 9 Top: Grand Wahid bold gold porte-cochere signboard
  drawHalfBandSignboard(ctx, 9, true, 'Grand Wahid', '#2b1d12', '#d4af37', '#f5d061', true);
  // Slot 9 Bottom: Grand Hotel solid color & glass muntin swatches
  drawGrandHotelSwatchesInSlot9Bottom(ctx);
  // Slot 10: Pertokoan Tamansari shopfront signs, BUCCHERI blade & cobalt curtain glass
  drawTamansariShopSignsSlot10(ctx);

  // Slot 11: Architectural utility sub-rects (Clock Dial, Neutral White, Checkered Trim, Stone)
  drawSlotWithGutter(ctx, 11, (x, y, w, h) => drawUtilityPaletteSlot(ctx, x, y, w, h));

  // Slot 12: Reserved procedural market fallback / Workbench photo upload
  drawSlotWithGutter(ctx, 12, (x, y, w, h) => drawMarketSlot(ctx, x, y, w, h));
  // Slot 13 Bottom: Pasar Raya II tinted curtain glass & clerestory window strip
  drawMarketGlassInSlot13Bottom(ctx);
  // Slot 14: Ruko Safira Block signage (Mandiri Busana, Wadimor, Queen's, Lia, Toko Emas Safira, Sinar, Striped Awning)
  drawSafiraRukoTexturesSlot14(ctx);
  // Slot 15: Dedicated Pasar Raya II Ruko Block 1 (Sate Sapi Suruh & Toko Morodadi) signage & awning
  drawPasarRayaRukoTexturesSlot15(ctx);

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
  rx: number;
  rz: number;
}

interface TrackSpatialQuery {
  trackLengthMeters: number;
  queryNearest: (
    x: number,
    z: number,
  ) => { dist: number; roadY: number; s: number; lateralOffset: number };
}

function createTrackSpatialQuery(trackCurve: THREE.CatmullRomCurve3): TrackSpatialQuery {
  const trackLengthMeters = Math.max(500, trackCurve.getLength());
  const sampleCount = Math.min(4000, Math.max(1200, Math.ceil(trackLengthMeters / 2)));
  const pts = trackCurve.getSpacedPoints(sampleCount);
  const samples: TrackSpatialSample[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    // right = cross(fwd, UP) = (-fz, 0, fx)
    const rx = -tz / len;
    const rz = tx / len;
    samples[i] = {
      x: pts[i].x,
      y: pts[i].y,
      z: pts[i].z,
      s: (i / sampleCount) * trackLengthMeters,
      rx,
      rz,
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

  const queryNearest = (
    vx: number,
    vz: number,
  ): { dist: number; roadY: number; s: number; lateralOffset: number } => {
    const cx = Math.floor(vx / cellSize);
    const cz = Math.floor(vz / cellSize);
    let bestDistSq = Infinity;
    let bestY = 0;
    let bestS = 0;
    let bestLat = 0;
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
              bestLat = (vx - px) * a.rx + (vz - pz) * a.rz;
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
          bestLat = (vx - px) * a.rx + (vz - pz) * a.rz;
        }
      }
    }

    return {
      dist: bestDistSq < Infinity ? Math.sqrt(bestDistSq) : Infinity,
      roadY: bestY,
      s: bestS,
      lateralOffset: bestLat,
    };
  };

  return { trackLengthMeters, queryNearest };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function estimateGroundY(
  vx: number,
  vz: number,
  dist: number,
  roadY: number,
  s = -1,
  lateralOffset = 0,
): number {
  const hillWave =
    Math.sin(vx * 0.011 + 0.4) * Math.cos(vz * 0.013 - 0.2) * 3.8 +
    Math.sin((vx + vz) * 0.023) * 1.4;

  const inEastUrbanPad = s >= 50.0 && s <= 430.0 && lateralOffset < 0;

  if (dist <= 11.0) {
    return roadY - 0.35;
  }
  if (inEastUrbanPad && dist <= 58.0) {
    return roadY - 0.35;
  }
  if (inEastUrbanPad && dist <= 80.0) {
    const blend = smoothstep(58.0, 80.0, dist);
    const targetValley = THREE.MathUtils.lerp(roadY - 0.3, -2.8, blend);
    return targetValley + hillWave * 0.2 * blend;
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
    const ao = Math.max(0.56, Math.min(1.0, groundAo * soffitAo * partAo));

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

function buildTriangularGableGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  // Build triangular gable prism in local space centered at base y = 0 .. height
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -hd);
  geo.computeVertexNormals();
  // Normalize UVs into [0..1]
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, 0.5, 0.5);
    }
    uv.needsUpdate = true;
  }
  return geo;
}

function addFrontSidewalkApron(specs: AtlasPartSpec[], w: number, d: number) {
  const apronDepth = 6.2;
  const apronPz = d * 0.5 + apronDepth * 0.5;
  specs.push(
    // Flat concrete sidewalk & storefront parking apron (top surface at y = +0.02, skirt to -2.2m)
    {
      geo: new THREE.BoxGeometry(w + 2.4, 2.24, apronDepth),
      py: -1.1,
      pz: apronPz,
      slot: UTIL_SLOT,
      ...STONE_SUB,
      tintHex: '#cbd5e1',
      aoHint: 0.86,
    },
    // Raised light-grey trotoar curb lip right beside the Armco barrier
    {
      geo: new THREE.BoxGeometry(w + 2.4, 0.14, 0.42),
      py: -0.01,
      pz: d * 0.5 + apronDepth - 0.18,
      slot: UTIL_SLOT,
      ...WHITE_SUB,
      tintHex: '#94a3b8',
      aoHint: 0.88,
    },
  );
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
    const plasterGrid = wallTint || '#e2d3cc';
    const infillPanel = '#d6c7c0';
    const atticTrim = roofTint || '#9e8c82';
    const portRoofHex = '#6e473b';
    const canopyGreen = '#2d6a4f';
    const pergolaRust = '#5c4033';

    const sx = w / 88;
    const sz = d / 34;
    const frontZ = d * 0.5;
    const numFrontBays = 9;
    const numSideBays = 4;
    const bayW = w / numFrontBays;
    const sideBayD = d / numSideBays;

    // 0. Wide paved concrete market plaza apron (y = 0) extending forward to road kerb + north 8m side-street apron
    const apronDepth = 7.0;
    specs.push(
      // Main market plaza apron extending forward toward the Armco kerb
      {
        geo: new THREE.BoxGeometry(w + 12.0 * sx, 2.35, apronDepth + 1.2),
        px: 2.0 * sx,
        py: -1.16,
        pz: frontZ + apronDepth * 0.5 - 0.5,
        slot: UTIL_SLOT,
        ...STONE_SUB,
        tintHex: '#cbd5e1',
        aoHint: 0.86,
      },
      // Raised trotoar curb edge along road frontage
      {
        geo: new THREE.BoxGeometry(w + 12.0 * sx, 0.14, 0.44),
        px: 2.0 * sx,
        py: -0.02,
        pz: frontZ + apronDepth - 0.12,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: '#94a3b8',
        aoHint: 0.88,
      },
      // 8m paved north side-street lane separating Toko Emas Safira & Pasar Raya II
      {
        geo: new THREE.BoxGeometry(8.2, 2.32, d + apronDepth),
        px: -w * 0.5 - 4.1,
        py: -1.18,
        pz: apronDepth * 0.5,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: '#475569',
        aoHint: 0.82,
      },
      // Continuous foundation plinth under main market block
      {
        geo: new THREE.BoxGeometry(w + 1.8, 2.45, d + 1.6),
        py: -1.2,
        slot: UTIL_SLOT,
        ...STONE_SUB,
        aoHint: 0.8,
      },
      // Inner 4-story recessed infill core (#d6c7c0)
      {
        geo: new THREE.BoxGeometry(w - 0.8, totalH, d - 0.8),
        py: totalH * 0.5,
        slot: photoSlot ?? UTIL_SLOT,
        ...(photoSlot !== undefined ? {} : WHITE_SUB),
        tintHex: infillPanel,
        aoHint: 0.82,
      },
    );

    // 1. PALE PINK-BEIGE STRUCTURAL GRID (9 front bays x 4 deep, 4 floors)
    // Horizontal floor bands wrapping front & side walls
    for (let fl = 0; fl <= b.floors; fl++) {
      const bandY = fl === 0 ? 0.24 : fl === b.floors ? totalH - 0.2 : fl * floorH;
      const bandH = fl === b.floors ? 0.62 : 0.44;
      specs.push({
        geo: new THREE.BoxGeometry(w + 0.9, bandH, d + 0.9),
        py: bandY,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.94,
      });
    }

    // 10 Vertical grid columns along +Z front (and rear)
    for (let i = 0; i <= numFrontBays; i++) {
      const cx = -w * 0.5 + i * bayW;
      const isCorner = i === 0 || i === numFrontBays;
      specs.push({
        geo: new THREE.BoxGeometry(isCorner ? 1.28 * sx : 0.86 * sx, totalH + 0.35, 0.72),
        px: cx,
        py: (totalH + 0.35) * 0.5,
        pz: frontZ - 0.14,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.94,
      });
    }

    // Intermediate vertical columns along -X (north) and +X (south) side walls (4 bays deep)
    for (let j = 1; j < numSideBays; j++) {
      const szPos = -d * 0.5 + j * sideBayD;
      for (const sideSign of [-1, 1]) {
        specs.push({
          geo: new THREE.BoxGeometry(0.72, totalH + 0.35, 0.86 * sz),
          px: sideSign * (w * 0.5 - 0.14),
          py: (totalH + 0.35) * 0.5,
          pz: szPos,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: plasterGrid,
          aoHint: 0.92,
        });
      }
    }

    // Corner columns on back corners (-Z)
    for (const sideSign of [-1, 1]) {
      specs.push({
        geo: new THREE.BoxGeometry(1.25 * sx, totalH + 0.35, 1.25 * sz),
        px: sideSign * (w * 0.5 - 0.2),
        py: (totalH + 0.35) * 0.5,
        pz: -d * 0.5 + 0.2,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.9,
      });
    }

    // 2. RECESSED GRID INFILL BAYS + CORNER TINTED-GLASS CURTAIN WALLS (#2f3e46)
    for (let i = 0; i < numFrontBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      const isCornerBay = i === 0 || i === numFrontBays - 1;

      // Ground-floor dark shaded arcade shopfronts (strong AO = 0.60)
      specs.push({
        geo: new THREE.BoxGeometry(bayW - 1.2 * sx, floorH * 0.82, 0.34),
        px: bx,
        py: floorH * 0.42,
        pz: frontZ - 0.38,
        slot: 1,
        subU0: 0,
        subV0: 0,
        subU1: 1,
        subV1: 0.34,
        aoHint: 0.6,
      });

      // Floors 2..4 (indices 1..floors-1)
      for (let fl = 1; fl < b.floors; fl++) {
        const wy = fl * floorH + floorH * 0.52;
        if (isCornerBay) {
          // Stacked dark green-grey tinted glass curtain wall (#2f3e46)
          specs.push({
            geo: new THREE.BoxGeometry(bayW - 1.15 * sx, floorH * 0.72, 0.26),
            px: bx,
            py: wy,
            pz: frontZ - 0.22,
            ...CURTAIN_GLASS_SUB,
            tintHex: '#ffffff',
            aoHint: 0.9,
          });
        } else {
          // Deep shaded window / ventilation louver opening inside concrete bay recess (AO = 0.60)
          specs.push(
            {
              geo: new THREE.BoxGeometry(bayW - 1.6 * sx, floorH * 0.48, 0.24),
              px: bx,
              py: wy + 0.12,
              pz: frontZ - 0.34,
              slot: UTIL_SLOT,
              ...WHITE_SUB,
              tintHex: '#2f3e46',
              aoHint: 0.6,
            },
            {
              geo: new THREE.BoxGeometry(bayW - 1.3 * sx, 0.18, 0.36),
              px: bx,
              py: wy - floorH * 0.18,
              pz: frontZ - 0.22,
              slot: UTIL_SLOT,
              ...WHITE_SUB,
              tintHex: plasterGrid,
              aoHint: 0.86,
            },
          );
        }
      }
    }

    // Wrap corner tinted-glass curtain walls onto 1st side bay (north -X and south +X) for floors 2, 3, 4
    const firstSideBayZ = frontZ - sideBayD * 0.5;
    for (const sideSign of [-1, 1]) {
      for (let fl = 1; fl < b.floors; fl++) {
        const wy = fl * floorH + floorH * 0.52;
        specs.push({
          geo: new THREE.BoxGeometry(0.26, floorH * 0.72, sideBayD - 1.2 * sz),
          px: sideSign * (w * 0.5 - 0.22),
          py: wy,
          pz: firstSideBayZ,
          ...CURTAIN_GLASS_SUB,
          tintHex: '#ffffff',
          aoHint: 0.88,
        });
      }
      // Subtle recessed louver bands on remaining side bays 1..3
      for (let j = 1; j < numSideBays; j++) {
        const szPos = frontZ - sideBayD * (j + 0.5);
        for (let fl = 1; fl < b.floors; fl++) {
          specs.push({
            geo: new THREE.BoxGeometry(0.22, floorH * 0.44, sideBayD - 1.6 * sz),
            px: sideSign * (w * 0.5 - 0.32),
            py: fl * floorH + floorH * 0.54,
            pz: szPos,
            slot: UTIL_SLOT,
            ...WHITE_SUB,
            tintHex: '#334155',
            aoHint: 0.64,
          });
        }
      }
    }

    // 3. TOP ATTIC CLERESTORY BAND (+3.5m above 4th floor cornice) + DECORATIVE FIN BRACKETS
    const atticH = 3.5;
    const atticW = w - 3.2 * sx;
    const atticD = d - 3.2 * sz;
    const atticCy = totalH + atticH * 0.5;
    specs.push(
      // Setback 5th attic body
      {
        geo: new THREE.BoxGeometry(atticW, atticH, atticD),
        py: atticCy,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: infillPanel,
        aoHint: 0.88,
      },
      // Continuous horizontal clerestory window band along front & rear
      {
        geo: new THREE.BoxGeometry(atticW - 1.2, 1.55, atticD + 0.16),
        py: totalH + 1.75,
        ...CLERESTORY_GLASS_SUB,
        tintHex: '#ffffff',
        aoHint: 0.86,
      },
      // Continuous clerestory window band along north & south attic sides
      {
        geo: new THREE.BoxGeometry(atticW + 0.16, 1.55, atticD - 1.2),
        py: totalH + 1.75,
        ...CLERESTORY_GLASS_SUB,
        tintHex: '#ffffff',
        aoHint: 0.86,
      },
      // Projecting attic roof cornice slab
      {
        geo: new THREE.BoxGeometry(atticW + 2.2, 0.48, atticD + 2.2),
        py: totalH + atticH + 0.15,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.96,
      },
      // Attic roof cap & central mechanical penthouse
      {
        geo: new THREE.BoxGeometry(atticW * 0.36, 1.85, atticD * 0.38),
        py: totalH + atticH + 1.3,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: atticTrim,
        aoHint: 0.88,
      },
    );

    // Vertical decorative fin brackets under projecting roof cornice
    const frontFins = 16;
    for (let f = 0; f <= frontFins; f++) {
      const fx = THREE.MathUtils.lerp(-atticW * 0.48, atticW * 0.48, f / frontFins);
      specs.push({
        geo: new THREE.BoxGeometry(0.24, 0.55, 0.78),
        px: fx,
        py: totalH + atticH - 0.3,
        pz: atticD * 0.5 + 0.52,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.72,
      });
    }
    const sideFins = 6;
    for (let f = 0; f <= sideFins; f++) {
      const fz = THREE.MathUtils.lerp(-atticD * 0.46, atticD * 0.46, f / sideFins);
      for (const sideSign of [-1, 1]) {
        specs.push({
          geo: new THREE.BoxGeometry(0.78, 0.55, 0.24),
          px: sideSign * (atticW * 0.5 + 0.52),
          py: totalH + atticH - 0.3,
          pz: fz,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: plasterGrid,
          aoHint: 0.72,
        });
      }
    }

    // 4. MONUMENTAL RIGHT-CENTER PORTICO CANOPY (x = +22m scaled, 14m wide, projecting 7m forward)
    const portCx = 22.0 * sx;
    const portW = 14.0 * sx;
    const portProj = 7.0;
    const portPz = frontZ + portProj * 0.5;
    const portFrontZ = frontZ + portProj;
    const portEaveY = floorH * 2.02; // Double height (~9.1m)

    specs.push(
      // Shaded grand entry portal recessed inside building wall (AO = 0.60)
      {
        geo: new THREE.BoxGeometry(portW * 0.76, portEaveY * 0.82, 0.48),
        px: portCx,
        py: portEaveY * 0.41,
        pz: frontZ - 0.22,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: '#1f2937',
        aoHint: 0.6,
      },
      // Portico ceiling soffit deck (strong underside AO = 0.60)
      {
        geo: new THREE.BoxGeometry(portW + 0.6, 0.68, portProj + 0.4),
        px: portCx,
        py: portEaveY,
        pz: portPz,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: plasterGrid,
        aoHint: 0.6,
      },
      // Projecting portico frieze band
      {
        geo: new THREE.BoxGeometry(portW + 1.0, 0.75, portProj + 0.7),
        px: portCx,
        py: portEaveY + 0.6,
        pz: portPz,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: atticTrim,
        aoHint: 0.9,
      },
      // Pitched triangular gable truss roof (#6e473b) over portico
      {
        geo: buildTriangularGableGeometry(portW + 0.8, 3.3, portProj + 0.6),
        px: portCx,
        py: portEaveY + 0.95,
        pz: portPz,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: portRoofHex,
        aoHint: 0.88,
      },
      // Dark gable truss overhang slopes
      {
        geo: new THREE.BoxGeometry(portW * 0.62, 0.22, portProj + 1.1),
        px: portCx - portW * 0.26,
        py: portEaveY + 2.6,
        pz: portPz + 0.15,
        rz: 0.43,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: portRoofHex,
      },
      {
        geo: new THREE.BoxGeometry(portW * 0.62, 0.22, portProj + 1.1),
        px: portCx + portW * 0.26,
        py: portEaveY + 2.6,
        pz: portPz + 0.15,
        rz: -0.43,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: portRoofHex,
      },
      // Prominent PASAR RAYA II SALATIGA 3D signboard on portico frieze
      {
        geo: new THREE.BoxGeometry(Math.min(12.2, portW * 0.86), 1.68, 0.26),
        px: portCx,
        py: portEaveY + 1.75,
        pz: portFrontZ + 0.36,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: '#0f172a',
      },
      {
        geo: new THREE.BoxGeometry(Math.min(11.8, portW * 0.82), 1.48, 0.08),
        px: portCx,
        py: portEaveY + 1.75,
        pz: portFrontZ + 0.51,
        ...signRect,
      },
    );

    // 4 Massive stepped pink-cream pillars supporting portico
    const portPillarPos: [number, number][] = [
      [portCx - portW * 0.44, portFrontZ - 0.55],
      [portCx + portW * 0.44, portFrontZ - 0.55],
      [portCx - portW * 0.44, frontZ + portProj * 0.45],
      [portCx + portW * 0.44, frontZ + portProj * 0.45],
    ];
    for (const [px, pz] of portPillarPos) {
      specs.push(
        { geo: new THREE.BoxGeometry(1.38, 0.65, 1.38), px, py: 0.32, pz, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.6 },
        { geo: new THREE.BoxGeometry(1.06, portEaveY - 0.5, 1.06), px, py: portEaveY * 0.5, pz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: plasterGrid, aoHint: 0.72 },
        { geo: new THREE.BoxGeometry(1.32, 0.45, 1.32), px, py: portEaveY - 0.45, pz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: plasterGrid, aoHint: 0.62 },
      );
    }

    // 5. 3 GREEN PITCHED-ROOF MARKET CANOPIES (#2d6a4f) & BLUE/WHITE STREET VENDOR STALLS LEFT OF PORTICO
    const greenCanopyXs = [-32.5 * sx, -14.5 * sx, 3.5 * sx];
    const gcW = 14.5 * sx;
    const gcDepth = 3.6;
    const gcEaveY = 3.55;
    for (const gcx of greenCanopyXs) {
      specs.push(
        // Shaded underside canopy soffit (AO = 0.60)
        {
          geo: new THREE.BoxGeometry(gcW, 0.2, gcDepth),
          px: gcx,
          py: gcEaveY,
          pz: frontZ + gcDepth * 0.5,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: '#1b4332',
          aoHint: 0.6,
        },
        // Pitched green canopy roof (#2d6a4f)
        {
          geo: buildTriangularGableGeometry(gcW + 0.4, 1.35, gcDepth + 0.35),
          px: gcx,
          py: gcEaveY + 0.1,
          pz: frontZ + gcDepth * 0.5 + 0.05,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: canopyGreen,
          aoHint: 0.9,
        },
        // Steel canopy support posts
        { geo: new THREE.BoxGeometry(0.24, gcEaveY, 0.24), px: gcx - gcW * 0.44, py: gcEaveY * 0.5, pz: frontZ + gcDepth - 0.25, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#475569', aoHint: 0.6 },
        { geo: new THREE.BoxGeometry(0.24, gcEaveY, 0.24), px: gcx + gcW * 0.44, py: gcEaveY * 0.5, pz: frontZ + gcDepth - 0.25, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#475569', aoHint: 0.6 },
      );
    }

    // 8 Low-poly blue/white street vendor stalls (#1d4ed8 / #f8fafc) beneath/along market plaza
    for (let v = 0; v < 8; v++) {
      const vx = THREE.MathUtils.lerp(-38.0 * sx, 9.5 * sx, v / 7);
      const vz = frontZ + 4.35;
      specs.push(
        // White vendor stall counter/base (strong ground AO = 0.60)
        { geo: new THREE.BoxGeometry(3.4, 1.15, 1.8), px: vx, py: 0.58, pz: vz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f8fafc', aoHint: 0.64 },
        // Slender stall frame posts
        { geo: new THREE.BoxGeometry(0.12, 2.35, 0.12), px: vx - 1.55, py: 1.2, pz: vz + 0.78, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8', aoHint: 0.62 },
        { geo: new THREE.BoxGeometry(0.12, 2.35, 0.12), px: vx + 1.55, py: 1.2, pz: vz + 0.78, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8', aoHint: 0.62 },
        // Blue/white alternating stall pitched tarp roof (#1d4ed8 / #f8fafc)
        {
          geo: new THREE.BoxGeometry(3.7, 0.18, 2.3),
          px: vx,
          py: 2.45,
          pz: vz,
          rx: 0.18,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: v % 2 === 0 ? '#1d4ed8' : '#f8fafc',
          aoHint: 0.9,
        },
      );
    }

    // 6. SOUTH-END 3-STORY STEPPED WING & EXPOSED DARK-RUST STEEL PERGOLA FRAMING (#5c4033)
    const wingW = 7.5 * sx;
    const wingD = d * 0.74;
    const wingH = floorH * 3;
    const wingCx = w * 0.5 + wingW * 0.5 - 0.4;
    const wingCz = -d * 0.06;
    const pergolaY = wingH;
    const pergolaH = 3.2;

    specs.push(
      // Foundation under south stepped wing
      { geo: new THREE.BoxGeometry(wingW + 1.2, 2.45, wingD + 1.2), px: wingCx, py: -1.2, pz: wingCz, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.78 },
      // 3-story stepped annex volume
      { geo: new THREE.BoxGeometry(wingW, wingH, wingD), px: wingCx, py: wingH * 0.5, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: infillPanel, aoHint: 0.88 },
      // Stepped floor bands on south wing
      { geo: new THREE.BoxGeometry(wingW + 0.5, 0.4, wingD + 0.5), px: wingCx, py: floorH, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: plasterGrid },
      { geo: new THREE.BoxGeometry(wingW + 0.5, 0.4, wingD + 0.5), px: wingCx, py: floorH * 2, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: plasterGrid },
      { geo: new THREE.BoxGeometry(wingW + 0.7, 0.48, wingD + 0.7), px: wingCx, py: wingH, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: plasterGrid },
      // Side stair/corridor window strips on south wing
      { geo: new THREE.BoxGeometry(wingW * 0.62, wingH * 0.68, 0.24), px: wingCx, py: wingH * 0.5, pz: wingCz + wingD * 0.5 + 0.04, ...CURTAIN_GLASS_SUB, tintHex: '#ffffff', aoHint: 0.84 },
      { geo: new THREE.BoxGeometry(0.24, wingH * 0.68, wingD * 0.55), px: wingCx + wingW * 0.5 + 0.04, py: wingH * 0.5, pz: wingCz, ...CURTAIN_GLASS_SUB, tintHex: '#ffffff', aoHint: 0.84 },
      // Open dark-rust steel pergola perimeter top beams (#5c4033)
      { geo: new THREE.BoxGeometry(wingW + 0.6, 0.34, 0.34), px: wingCx, py: pergolaY + pergolaH, pz: wingCz + wingD * 0.46, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: pergolaRust },
      { geo: new THREE.BoxGeometry(wingW + 0.6, 0.34, 0.34), px: wingCx, py: pergolaY + pergolaH, pz: wingCz - wingD * 0.46, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: pergolaRust },
      { geo: new THREE.BoxGeometry(0.34, 0.34, wingD + 0.6), px: wingCx - wingW * 0.46, py: pergolaY + pergolaH, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: pergolaRust },
      { geo: new THREE.BoxGeometry(0.34, 0.34, wingD + 0.6), px: wingCx + wingW * 0.46, py: pergolaY + pergolaH, pz: wingCz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: pergolaRust },
    );

    // 4 Corner steel pergola posts + open lattice steel rafters
    for (const pxSign of [-1, 1]) {
      for (const pzSign of [-1, 1]) {
        specs.push({
          geo: new THREE.BoxGeometry(0.34, pergolaH, 0.34),
          px: wingCx + pxSign * (wingW * 0.45),
          py: pergolaY + pergolaH * 0.5,
          pz: wingCz + pzSign * (wingD * 0.45),
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: pergolaRust,
        });
      }
    }
    for (let r = 1; r <= 5; r++) {
      const rz = THREE.MathUtils.lerp(wingCz - wingD * 0.42, wingCz + wingD * 0.42, (r - 1) / 4);
      specs.push({
        geo: new THREE.BoxGeometry(wingW + 0.4, 0.24, 0.22),
        px: wingCx,
        py: pergolaY + pergolaH,
        pz: rz,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: pergolaRust,
      });
    }
    for (let c = 1; c <= 3; c++) {
      const rx = THREE.MathUtils.lerp(wingCx - wingW * 0.36, wingCx + wingW * 0.36, (c - 1) / 2);
      specs.push({
        geo: new THREE.BoxGeometry(0.2, 0.22, wingD + 0.4),
        px: rx,
        py: pergolaY + pergolaH + 0.14,
        pz: wingCz,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: pergolaRust,
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
  } else if (b.style === 'tamansari-arcade') {
    const salmon = wallTint || '#dfa394';
    const corniceSalmon = '#e8b4a6';
    const cream = '#f3e7d8';
    const domePink = '#c47d70';
    const spireSlate = roofTint || '#3b4954';
    const crimson = '#b91c1c';

    const sx = w / 114;
    const sz = d / 18;
    const numBays = 12;
    const bayW = w / numBays;
    const frontZ = d * 0.5;
    const gateX = -6.0 * sx;
    const gateHalfW = 3.4 * sx; // 6.8m Jalan Tembus Tamansari underpass opening
    const gateOpenH = Math.min(totalH - 1.6, 6.4);

    addFrontSidewalkApron(specs, w, d);

    // 0. Continuous stone foundation plinth & front sidewalk apron (-2.2m terrain skirt)
    specs.push(
      { geo: new THREE.BoxGeometry(w + 2.4, 2.4, d + 3.4 * sz), py: -1.15, pz: 0.6 * sz, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.78 },
    );

    // 1. MAIN 2-STORY ARCADE MASSING SPLIT AROUND CENTRAL JALAN TEMBUS UNDERPASS
    const leftWingSpan = (gateX - gateHalfW) - (-w * 0.5); // ~47.6m
    const leftWingCx = -w * 0.5 + leftWingSpan * 0.5;
    const rightWingSpan = (w * 0.5) - (gateX + gateHalfW); // ~59.6m
    const rightWingCx = (gateX + gateHalfW) + rightWingSpan * 0.5;

    const recessedDepth = Math.max(4, d - 1.6 * sz);
    const recessedPz = -0.8 * sz;
    const upperH = Math.max(2.6, totalH - floorH);
    const upperPy = floorH + upperH * 0.5;

    // Ground floor recessed shopfront cores (darkened arcade shadow AO = 0.62) + 2nd floor salmon bodies
    for (const [wingCx, wingW] of [
      [leftWingCx, leftWingSpan],
      [rightWingCx, rightWingSpan],
    ] as [number, number][]) {
      specs.push(
        // Recessed ground shopfront mass (set back 1.6m from front overhang)
        { geo: new THREE.BoxGeometry(wingW, floorH, recessedDepth), px: wingCx, py: floorH * 0.5, pz: recessedPz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: salmon, aoHint: 0.62 },
        // Upper 2nd floor overhanging salmon-pink body
        { geo: new THREE.BoxGeometry(wingW, upperH, d), px: wingCx, py: upperPy, slot: photoSlot ?? UTIL_SLOT, ...(photoSlot !== undefined ? {} : WHITE_SUB), tintHex: salmon },
        // Projecting upper cornice (#e8b4a6) & cream parapet molding (#f3e7d8)
        { geo: new THREE.BoxGeometry(wingW + 0.3, 0.55, d + 0.9 * sz), px: wingCx, py: totalH + 0.28, pz: 0.25 * sz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: corniceSalmon },
        { geo: new THREE.BoxGeometry(wingW + 0.5, 0.32, d + 1.15 * sz), px: wingCx, py: totalH + 0.68, pz: 0.3 * sz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
        // Horizontal 1st-floor soffit fascia & cream arcade trim
        { geo: new THREE.BoxGeometry(wingW, 0.42, 1.8 * sz), px: wingCx, py: floorH - 0.12, pz: frontZ - 0.85 * sz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: corniceSalmon, aoHint: 0.62 },
        { geo: new THREE.BoxGeometry(wingW, 0.16, 0.26), px: wingCx, py: floorH + 0.14, pz: frontZ + 0.08, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
      );
    }

    // 13 Vertical cream pilasters dividing the 12 rhythmic bays
    for (let i = 0; i <= numBays; i++) {
      const px = -w * 0.5 + i * bayW;
      // Skip pilaster if it falls inside central archway opening
      if (Math.abs(px - gateX) < gateHalfW - 0.3) continue;
      specs.push(
        { geo: new THREE.BoxGeometry(0.76 * sx, totalH + 0.72, 0.68), px, py: (totalH + 0.72) * 0.5, pz: frontZ - 0.05, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.92 },
        { geo: new THREE.BoxGeometry(1.02 * sx, 0.38, 0.92), px, py: 0.19, pz: frontZ - 0.02, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.64 },
      );
    }

    // 12 Rhythmic Shopfront Bays (bay #1 and bay #5 are modern cobalt-blue + crimson-red curtain walls)
    let signCounter = 0;
    for (let i = 0; i < numBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      const isModernBay = i === 0 || i === 4; // bay #1 & bay #5 (1-based)
      const overlapsGate = Math.abs(bx - gateX) < gateHalfW + bayW * 0.25;

      if (overlapsGate) continue;

      if (isModernBay) {
        // Modern cobalt-blue curtain-wall glass storefront framed in bold crimson-red trim
        const bayGlassW = bayW - 1.35 * sx;
        specs.push(
          // Outer crimson-red portal frame
          { geo: new THREE.BoxGeometry(bayGlassW + 0.8, totalH + 0.25, 0.36), px: bx, py: (totalH + 0.25) * 0.5, pz: frontZ + 0.05, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: crimson },
          // Full-height cobalt-blue reflective glass curtain wall
          { geo: new THREE.BoxGeometry(bayGlassW, totalH - 0.35, 0.24), px: bx, py: totalH * 0.5, pz: frontZ + 0.16, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#ffffff' },
          // Horizontal crimson mid-transom bar
          { geo: new THREE.BoxGeometry(bayGlassW + 0.3, 0.38, 0.42), px: bx, py: floorH, pz: frontZ + 0.18, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: crimson },
        );
      } else {
        // Recessed ground-floor dark shopfront interior / roll-up shutters (AO = 0.62)
        specs.push(
          { geo: new THREE.BoxGeometry(bayW - 1.6 * sx, floorH * 0.78, 0.24), px: bx, py: floorH * 0.4, pz: frontZ - 1.55 * sz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1f2937', aoHint: 0.62 },
        );

        // 2nd-floor wide segmental arch window cutout & arched cream brow surround
        const winW = bayW * 0.68;
        const winH = upperH * 0.56;
        const winPy = floorH + upperH * 0.48;
        specs.push(
          // Dark recessed window backdrop (AO = 0.64)
          { geo: new THREE.BoxGeometry(winW, winH, 0.22), px: bx, py: winPy, pz: frontZ - 0.04, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#94a3b8', aoHint: 0.64 },
          // Window sill
          { geo: new THREE.BoxGeometry(winW + 0.4, 0.2, 0.36), px: bx, py: winPy - winH * 0.5, pz: frontZ + 0.08, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
          // Segmental arch cream header molding curving upward (+Y via rx = -PI/2)
          {
            geo: new THREE.CylinderGeometry(winW * 0.56, winW * 0.56, 0.34, 10, 1, true, -Math.PI * 0.42, Math.PI * 0.84),
            px: bx,
            py: winPy + winH * 0.22,
            pz: frontZ + 0.06,
            rx: -Math.PI / 2,
            sz: 0.38,
            slot: UTIL_SLOT,
            ...WHITE_SUB,
            tintHex: cream,
            aoHint: 0.88,
          },
          // Dark under-arch soffit shadow bar
          { geo: new THREE.BoxGeometry(winW * 0.94, 0.22, 0.28), px: bx, py: winPy + winH * 0.46, pz: frontZ + 0.02, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#334155', aoHint: 0.62 },
        );

        // Colorful shop signboard above 1st-floor arcade fascia
        const shopSub = TAMANSARI_SHOP_SUBRECTS[signCounter % TAMANSARI_SHOP_SUBRECTS.length];
        signCounter++;
        specs.push(
          { geo: new THREE.BoxGeometry(bayW * 0.72, 1.08, 0.16), px: bx, py: floorH - 0.08, pz: frontZ + 0.16, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b' },
          { geo: new THREE.BoxGeometry(bayW * 0.68, 0.92, 0.06), px: bx, py: floorH - 0.08, pz: frontZ + 0.26, ...shopSub },
        );
      }

      // Vertical crimson BUCCHERI blade sign projecting perpendicular to facade on bay #4
      if (i === 3) {
        specs.push(
          { geo: new THREE.BoxGeometry(0.18, 3.6, 1.45), px: bx + bayW * 0.38, py: floorH + 1.4, pz: frontZ + 0.95, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: crimson },
          { geo: new THREE.BoxGeometry(0.06, 3.3, 1.28), px: bx + bayW * 0.38 + 0.1, py: floorH + 1.4, pz: frontZ + 0.95, ry: Math.PI / 2, rz: Math.PI / 2, ...TAMANSARI_BUCCHERI_SUB },
          { geo: new THREE.BoxGeometry(0.06, 3.3, 1.28), px: bx + bayW * 0.38 - 0.1, py: floorH + 1.4, pz: frontZ + 0.95, ry: -Math.PI / 2, rz: Math.PI / 2, ...TAMANSARI_BUCCHERI_SUB },
        );
      }
    }

    // 2. NORTH-WEST CORNER CUPOLA DOME TOWER (Left end near Bundaran Tamansari, x ≈ -46m)
    const cupolaX = -46.5 * sx;
    const cupolaZ = frontZ - 4.0 * sz;
    const cupolaW = 7.4 * sx;
    const cupolaD = 7.4 * sz;
    const towerBaseY = totalH + 0.6;
    const towerBodyH = 4.0;
    const belvedereBaseY = towerBaseY + towerBodyH;
    const belvedereH = 2.7;
    const domeBaseY = belvedereBaseY + belvedereH + 0.35;

    specs.push(
      // 3rd-story salmon-pink square tower block + cream corner trims & arched window recesses
      { geo: new THREE.BoxGeometry(cupolaW, towerBodyH, cupolaD), px: cupolaX, py: towerBaseY + towerBodyH * 0.5, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: salmon },
      { geo: new THREE.BoxGeometry(cupolaW + 0.6, 0.42, cupolaD + 0.6), px: cupolaX, py: belvedereBaseY + 0.16, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
      { geo: new THREE.BoxGeometry(cupolaW * 0.44, towerBodyH * 0.56, 0.22), px: cupolaX, py: towerBaseY + towerBodyH * 0.5, pz: cupolaZ + cupolaD * 0.5 + 0.04, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#94a3b8', aoHint: 0.66 },
      { geo: new THREE.BoxGeometry(0.22, towerBodyH * 0.56, cupolaD * 0.44), px: cupolaX - cupolaW * 0.5 - 0.04, py: towerBaseY + towerBodyH * 0.5, pz: cupolaZ, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#94a3b8', aoHint: 0.66 },
      // Bell-cast terracotta-pink cupola dome (#c47d70) + flared skirt + lantern finial
      { geo: new THREE.CylinderGeometry(3.15 * sx, 3.95 * sx, 0.8, 12), px: cupolaX, py: domeBaseY + 0.4, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: domePink },
      {
        geo: new THREE.SphereGeometry(3.12 * sx, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        px: cupolaX,
        py: domeBaseY + 0.72,
        pz: cupolaZ,
        sy: 0.88,
        slot: UTIL_SLOT,
        ...WHITE_SUB,
        tintHex: domePink,
      },
      // Cream cupola lantern & pinnacle spire
      { geo: new THREE.CylinderGeometry(0.65 * sx, 0.75 * sx, 1.15, 8), px: cupolaX, py: domeBaseY + 3.85, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
      { geo: new THREE.ConeGeometry(0.9 * sx, 1.35, 8), px: cupolaX, py: domeBaseY + 5.05, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: domePink },
      { geo: new THREE.CylinderGeometry(0.05, 0.1, 1.1, 6), px: cupolaX, py: domeBaseY + 6.1, pz: cupolaZ, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#d4af37' },
    );
    // Open 4-pillar belvedere pavilion under dome (with darkened interior soffit AO)
    for (const pxSign of [-1, 1]) {
      for (const pzSign of [-1, 1]) {
        specs.push({
          geo: new THREE.BoxGeometry(0.62, belvedereH, 0.62),
          px: cupolaX + pxSign * (cupolaW * 0.36),
          py: belvedereBaseY + belvedereH * 0.5 + 0.2,
          pz: cupolaZ + pzSign * (cupolaD * 0.36),
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: cream,
          aoHint: 0.74,
        });
      }
    }
    specs.push({
      geo: new THREE.BoxGeometry(cupolaW * 0.88, 0.38, cupolaD * 0.88),
      px: cupolaX,
      py: domeBaseY - 0.05,
      pz: cupolaZ,
      slot: UTIL_SLOT,
      ...WHITE_SUB,
      tintHex: cream,
      aoHint: 0.65,
    });

    // 3. CENTRAL GATEHOUSE ARCHWAY (Jalan Tembus Tamansari) & TWIN STEEPLE TOWERS (x ≈ -6m)
    const gateBridgeH = Math.max(2.6, totalH + 1.4 - gateOpenH);
    const gateBridgePy = gateOpenH + gateBridgeH * 0.5;
    specs.push(
      // Gatehouse overhead bridge spanning Jalan Tembus Tamansari underpass
      { geo: new THREE.BoxGeometry(gateHalfW * 2 + 1.2, gateBridgeH, d + 0.4), px: gateX, py: gateBridgePy, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: salmon, aoHint: 0.84 },
      // Shaded underpass tunnel ceiling & side jambs (AO = 0.62)
      { geo: new THREE.BoxGeometry(gateHalfW * 2, 0.35, d), px: gateX, py: gateOpenH - 0.15, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.62 },
      { geo: new THREE.BoxGeometry(0.55, gateOpenH, d), px: gateX - gateHalfW + 0.25, py: gateOpenH * 0.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.62 },
      { geo: new THREE.BoxGeometry(0.55, gateOpenH, d), px: gateX + gateHalfW - 0.25, py: gateOpenH * 0.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.62 },
      // Stepped golden/cream gatehouse pediment crown
      { geo: new THREE.BoxGeometry(gateHalfW * 2 + 1.8, 0.58, d + 1.1 * sz), px: gateX, py: totalH + 1.65, pz: 0.25 * sz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
      { geo: new THREE.BoxGeometry(gateHalfW * 1.4, 1.15, 1.4), px: gateX, py: totalH + 2.45, pz: frontZ - 0.35, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: corniceSalmon },
      // Prominent "TAMANSARI Shopping Centre" golden/cream fascia sign above central arch
      { geo: new THREE.BoxGeometry(gateHalfW * 2.1, 1.72, 0.32), px: gateX, py: gateOpenH + 1.35, pz: frontZ + 0.26, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#d4af37' },
      { geo: new THREE.BoxGeometry(gateHalfW * 2.0, 1.5, 0.08), px: gateX, py: gateOpenH + 1.35, pz: frontZ + 0.44, ...signRect },
    );

    // Twin 3-tier narrow steeple towers flanking the central arch (x ≈ -13m and x ≈ +1m)
    const steepleXs = [gateX - 7.0 * sx, gateX + 7.0 * sx];
    for (let t = 0; t < steepleXs.length; t++) {
      const tx = steepleXs[t];
      const tz = frontZ - 2.2 * sz;
      const tw = 3.4 * sx;
      const td = 3.6 * sz;
      const t2Base = totalH + 0.7;
      const t2H = 3.2;
      const t3Base = t2Base + t2H;
      const t3H = 2.9;
      const spireBase = t3Base + t3H;

      specs.push(
        // Tier 2 salmon shaft + stepped cream cornice
        { geo: new THREE.BoxGeometry(tw, t2H, td), px: tx, py: t2Base + t2H * 0.5, pz: tz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: salmon },
        { geo: new THREE.BoxGeometry(tw + 0.55, 0.36, td + 0.55), px: tx, py: t3Base, pz: tz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
        // Tier 3 belfry shaft + projecting cornice collar
        { geo: new THREE.BoxGeometry(tw * 0.92, t3H, td * 0.92), px: tx, py: t3Base + t3H * 0.5, pz: tz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: corniceSalmon },
        { geo: new THREE.BoxGeometry(tw + 0.6, 0.42, td + 0.6), px: tx, py: spireBase + 0.15, pz: tz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
        // Steep slate-grey pyramidal spire roof (#3b4954) + vertical lightning rod spire
        { geo: new THREE.ConeGeometry(tw * 0.72, 3.7, 4), px: tx, py: spireBase + 2.15, pz: tz, ry: Math.PI / 4, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: spireSlate },
        { geo: new THREE.CylinderGeometry(0.04, 0.08, 2.3, 6), px: tx, py: spireBase + 5.05, pz: tz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
      );

      // Double arched belfry openings on front face of Tier 3 (dark recessed niches, AO = 0.62)
      for (const side of [-1, 1]) {
        const bxOff = tx + side * (tw * 0.21);
        specs.push(
          { geo: new THREE.BoxGeometry(tw * 0.26, t3H * 0.62, 0.22), px: bxOff, py: t3Base + t3H * 0.5, pz: tz + td * 0.46 + 0.04, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b', aoHint: 0.62 },
          { geo: new THREE.BoxGeometry(tw * 0.32, 0.18, 0.26), px: bxOff, py: t3Base + t3H * 0.82, pz: tz + td * 0.46 + 0.06, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream },
        );
      }
    }

    // 4. SUBTLE ROOFTOP TELECOM MASTS & SATELLITE DISHES (#64748b)
    const mastXs = [-30 * sx, 19 * sx, 44 * sx];
    for (let m = 0; m < mastXs.length; m++) {
      const mx = mastXs[m];
      const mz = -3.0 * sz;
      specs.push(
        { geo: new THREE.CylinderGeometry(0.08, 0.26, 4.4, 4), px: mx, py: totalH + 2.5, pz: mz, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
        { geo: new THREE.ConeGeometry(0.75, 0.45, 8), px: mx + 1.1, py: totalH + 1.35, pz: mz + 0.6, rx: 0.7, rz: -0.35, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
      );
    }
  } else if (b.style === 'pasar-raya-ruko') {
    const cream = wallTint || '#ede3cf';
    const taupe = roofTint || '#8c7a6b';
    const numBays = 4;
    const bayW = w / numBays;
    const frontZ = d * 0.5;
    const upperH = Math.max(2.4, totalH - floorH);

    addFrontSidewalkApron(specs, w, d);

    specs.push(
      // Foundation plinth
      { geo: new THREE.BoxGeometry(w + 1.8, 2.4, d + 1.8), py: -1.15, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.82 },
      // Recessed ground-floor shopfront core (AO shadow depth = 0.60)
      { geo: new THREE.BoxGeometry(w - 0.6, floorH, d - 1.2), py: floorH * 0.5, pz: -0.6, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.6 },
      // 2nd-floor continuous cream plaster massing
      { geo: new THREE.BoxGeometry(w, upperH, d), py: floorH + upperH * 0.5, slot: photoSlot ?? UTIL_SLOT, ...(photoSlot !== undefined ? {} : WHITE_SUB), tintHex: cream },
      // Horizontal floor-1/2 cornice molding & top roof parapet molding
      { geo: new THREE.BoxGeometry(w + 0.5, 0.28, d + 0.7), py: floorH + 0.08, pz: 0.18, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
      { geo: new THREE.BoxGeometry(w + 0.6, 0.36, d + 0.85), py: totalH + 0.16, pz: 0.22, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
      // Flat roof slab behind gables
      { geo: new THREE.BoxGeometry(w - 0.4, 0.22, d - 0.4), py: totalH + 0.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
    );

    // 4 rhythmic bay piers + 4 triangular gable parapets
    for (let i = 0; i <= numBays; i++) {
      const px = -w * 0.5 + i * bayW;
      specs.push(
        { geo: new THREE.BoxGeometry(0.48, totalH + 0.2, 0.52), px, py: (totalH + 0.2) * 0.5, pz: frontZ - 0.04, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.9 },
      );
    }

    for (let i = 0; i < numBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      // Low triangular gable parapet centered at front roofline
      specs.push(
        {
          geo: buildTriangularGableGeometry(bayW - 0.26, 1.55, 0.55),
          px: bx,
          py: totalH + 0.3,
          pz: frontZ - 0.18,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: cream,
          aoHint: 0.95,
        },
        // Gable roof cap accent strips
        {
          geo: new THREE.BoxGeometry(bayW * 0.56, 0.16, 0.72),
          px: bx - bayW * 0.24,
          py: totalH + 1.08,
          pz: frontZ - 0.16,
          rz: 0.34,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: taupe,
        },
        {
          geo: new THREE.BoxGeometry(bayW * 0.56, 0.16, 0.72),
          px: bx + bayW * 0.24,
          py: totalH + 1.08,
          pz: frontZ - 0.16,
          rz: -0.34,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: taupe,
        },
      );

      // 2nd-floor windows on bay 0 (Sate Sapi Suruh) and bay 3 (Sinar)
      if (i === 0 || i === 3) {
        for (const wSide of [-1, 1]) {
          const wx = bx + wSide * (bayW * 0.22);
          const wy = floorH + upperH * 0.56;
          specs.push(
            { geo: new THREE.BoxGeometry(bayW * 0.28, upperH * 0.48, 0.18), px: wx, py: wy, pz: frontZ + 0.04, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1f2937' },
            { geo: new THREE.BoxGeometry(bayW * 0.23, upperH * 0.4, 0.22), px: wx, py: wy, pz: frontZ + 0.07, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#94a3b8' },
            { geo: new THREE.BoxGeometry(bayW * 0.31, 0.12, 0.28), px: wx, py: wy - upperH * 0.25, pz: frontZ + 0.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
          );
        }
      }

      // Ground-floor recessed shuttered shopfront opening (AO = 0.60)
      specs.push(
        { geo: new THREE.BoxGeometry(bayW - 1.1, floorH * 0.76, 0.22), px: bx, py: floorH * 0.38, pz: frontZ - 1.25, slot: 2, subU0: 0, subV0: 0, subU1: 1, subV1: 0.42, aoHint: 0.6 },
      );

      if (i === 0) {
        // Bay 0 (north): Orange-and-cream striped fabric awning
        specs.push(
          { geo: new THREE.BoxGeometry(bayW - 0.35, 0.18, 2.6), px: bx, py: 3.35, pz: frontZ + 1.15, rx: 0.34, ...ORANGE_AWNING_SUB, aoHint: 0.94 },
        );
      } else if (i === 1 || i === 2) {
        // Middle bays: Crisp white canvas awnings beneath Toko Morodadi
        specs.push(
          { geo: new THREE.BoxGeometry(bayW - 0.35, 0.18, 2.5), px: bx, py: 3.35, pz: frontZ + 1.1, rx: 0.34, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#f8fafc', aoHint: 0.94 },
        );
      } else {
        // Bay 3 (south): Striped slate/red/white awning under SINAR
        specs.push(
          { geo: new THREE.BoxGeometry(bayW - 0.35, 0.18, 2.5), px: bx, py: 3.35, pz: frontZ + 1.1, rx: 0.34, ...SAFIRA_AWNING_SUB, aoHint: 0.94 },
        );
      }
    }

    // Bay 0: "SATE SAPI SURUH & BAKSO" signboard
    const sateCx = -w * 0.5 + bayW * 0.5;
    specs.push(
      { geo: new THREE.BoxGeometry(bayW * 0.92, 1.28, 0.22), px: sateCx, py: floorH + 0.55, pz: frontZ + 0.24, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#9a3412' },
      { geo: new THREE.BoxGeometry(bayW * 0.86, 1.12, 0.08), px: sateCx, py: floorH + 0.55, pz: frontZ + 0.36, ...SATE_SURUH_SIGN_SUB },
    );

    // Bays 1..2: Large 2-story "TOKO MORODADI" billboard panels
    const morodadiCx = 0;
    specs.push(
      { geo: new THREE.BoxGeometry(bayW * 1.84, totalH * 0.72, 0.26), px: morodadiCx, py: totalH * 0.56, pz: frontZ + 0.26, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e293b' },
      { geo: new THREE.BoxGeometry(bayW * 1.76, totalH * 0.66, 0.08), px: morodadiCx, py: totalH * 0.56, pz: frontZ + 0.41, ...TOKO_MORODADI_SUB },
    );

    // Bay 3: "SINAR" horizontal signboard
    const sinarCx = w * 0.5 - bayW * 0.5;
    specs.push(
      { geo: new THREE.BoxGeometry(bayW * 0.9, 1.24, 0.22), px: sinarCx, py: floorH + 0.55, pz: frontZ + 0.24, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#0f172a' },
      { geo: new THREE.BoxGeometry(bayW * 0.84, 1.08, 0.08), px: sinarCx, py: floorH + 0.55, pz: frontZ + 0.36, ...SINAR_SIGN_SUB },
    );

    // 2 thin rooftop TV antennas above bays 0 & 3
    for (const ax of [-w * 0.5 + bayW * 0.5, w * 0.5 - bayW * 0.5]) {
      specs.push(
        { geo: new THREE.CylinderGeometry(0.04, 0.07, 3.2, 4), px: ax, py: totalH + 1.7, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
        { geo: new THREE.BoxGeometry(1.4, 0.05, 0.05), px: ax, py: totalH + 3.05, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
        { geo: new THREE.BoxGeometry(1.0, 0.05, 0.05), px: ax, py: totalH + 2.65, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
      );
    }
  } else if (b.style === 'pasar-raya-ruko-south') {
    const cream = wallTint || '#ede3cf';
    const taupe = roofTint || '#8c7a6b';
    const numBays = 5;
    const bayW = w / numBays;
    const frontZ = d * 0.5;
    const upperH = Math.max(2.4, totalH - floorH);

    addFrontSidewalkApron(specs, w, d);

    specs.push(
      // Foundation plinth
      { geo: new THREE.BoxGeometry(w + 1.8, 2.4, d + 1.8), py: -1.15, slot: UTIL_SLOT, ...STONE_SUB, aoHint: 0.82 },
      // Recessed ground-floor shopfront core (AO shadow depth = 0.60)
      { geo: new THREE.BoxGeometry(w - 0.6, floorH, d - 1.2), py: floorH * 0.5, pz: -0.6, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.6 },
      // 2nd-floor continuous cream plaster massing
      { geo: new THREE.BoxGeometry(w, upperH, d), py: floorH + upperH * 0.5, slot: photoSlot ?? UTIL_SLOT, ...(photoSlot !== undefined ? {} : WHITE_SUB), tintHex: cream },
      // Horizontal floor-1/2 cornice molding & top roof parapet molding
      { geo: new THREE.BoxGeometry(w + 0.5, 0.28, d + 0.7), py: floorH + 0.08, pz: 0.18, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
      { geo: new THREE.BoxGeometry(w + 0.6, 0.36, d + 0.85), py: totalH + 0.16, pz: 0.22, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
      // Flat roof slab behind gables
      { geo: new THREE.BoxGeometry(w - 0.4, 0.22, d - 0.4), py: totalH + 0.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
    );

    // 6 Bay piers
    for (let i = 0; i <= numBays; i++) {
      const px = -w * 0.5 + i * bayW;
      specs.push(
        { geo: new THREE.BoxGeometry(0.48, totalH + 0.2, 0.54), px, py: (totalH + 0.2) * 0.5, pz: frontZ - 0.04, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: cream, aoHint: 0.9 },
      );
    }

    const leftBillboardSubs = [MANDIRI_SIGN_SUB, WADIMOR_SIGN_SUB, QUEENS_SIGN_SUB];
    const leftBillboardFrames = ['#064e3b', '#7f1d1d', '#3b0764'];

    for (let i = 0; i < numBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      // 5 Triangular gable parapets + taupe ridge caps
      specs.push(
        {
          geo: buildTriangularGableGeometry(bayW - 0.26, 1.55, 0.55),
          px: bx,
          py: totalH + 0.3,
          pz: frontZ - 0.18,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: cream,
          aoHint: 0.95,
        },
        {
          geo: new THREE.BoxGeometry(bayW * 0.56, 0.16, 0.72),
          px: bx - bayW * 0.24,
          py: totalH + 1.08,
          pz: frontZ - 0.16,
          rz: 0.34,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: taupe,
        },
        {
          geo: new THREE.BoxGeometry(bayW * 0.56, 0.16, 0.72),
          px: bx + bayW * 0.24,
          py: totalH + 1.08,
          pz: frontZ - 0.16,
          rz: -0.34,
          slot: UTIL_SLOT,
          ...WHITE_SUB,
          tintHex: taupe,
        },
      );

      // Upper floor per-bay detailing:
      if (i < 3) {
        // Bays 0..2 (north -> south): MANDIRI BUSANA, WADIMOR, QUEEN'S colorful upper billboards
        specs.push(
          { geo: new THREE.BoxGeometry(bayW * 0.88, upperH * 0.72, 0.22), px: bx, py: floorH + upperH * 0.5, pz: frontZ + 0.18, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: leftBillboardFrames[i] },
          { geo: new THREE.BoxGeometry(bayW * 0.82, upperH * 0.64, 0.08), px: bx, py: floorH + upperH * 0.5, pz: frontZ + 0.31, ...leftBillboardSubs[i] },
        );
      } else {
        // Bays 3..4 (LIA, TOKO EMAS SAFIRA): Dark-framed upper windows + horizontal signboards
        for (const wSide of [-1, 1]) {
          const wx = bx + wSide * (bayW * 0.22);
          const wy = floorH + upperH * 0.58;
          specs.push(
            { geo: new THREE.BoxGeometry(bayW * 0.28, upperH * 0.44, 0.18), px: wx, py: wy, pz: frontZ + 0.04, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1f2937' },
            { geo: new THREE.BoxGeometry(bayW * 0.23, upperH * 0.36, 0.22), px: wx, py: wy, pz: frontZ + 0.07, ...TAMANSARI_COBALT_GLASS_SUB, tintHex: '#94a3b8' },
            { geo: new THREE.BoxGeometry(bayW * 0.31, 0.12, 0.28), px: wx, py: wy - upperH * 0.23, pz: frontZ + 0.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: taupe },
          );
        }
        if (i === 3) {
          // Bay 3: LIA signboard
          specs.push(
            { geo: new THREE.BoxGeometry(bayW * 0.9, 1.15, 0.22), px: bx, py: floorH + 0.5, pz: frontZ + 0.22, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1e3a8a' },
            { geo: new THREE.BoxGeometry(bayW * 0.84, 1.0, 0.08), px: bx, py: floorH + 0.5, pz: frontZ + 0.35, ...LIA_SIGN_SUB },
          );
        } else {
          // Bay 4 (far right corner bay next to side street): Bold blue-and-gold TOKO EMAS SAFIRA signboard
          specs.push(
            { geo: new THREE.BoxGeometry(bayW * 0.96, 1.38, 0.26), px: bx, py: floorH + 0.56, pz: frontZ + 0.24, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#fbbf24' },
            { geo: new THREE.BoxGeometry(bayW * 0.9, 1.2, 0.08), px: bx, py: floorH + 0.56, pz: frontZ + 0.39, ...SAFIRA_SIGN_SUB },
            // Corner blue accent band wrapping south corner
            { geo: new THREE.BoxGeometry(0.22, 1.38, 2.2), px: w * 0.5 + 0.05, py: floorH + 0.56, pz: frontZ - 1.1, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#1d4ed8' },
          );
        }
      }

      // Ground floor: recessed shopfront shutters (AO = 0.60) + continuous striped canvas awning (#64748b / #b91c1c / #f8fafc)
      specs.push(
        { geo: new THREE.BoxGeometry(bayW - 1.05, floorH * 0.76, 0.22), px: bx, py: floorH * 0.38, pz: frontZ - 1.25, slot: 2, subU0: 0, subV0: 0, subU1: 1, subV1: 0.42, aoHint: 0.6 },
        { geo: new THREE.BoxGeometry(bayW - 0.14, 0.18, 2.65), px: bx, py: 3.35, pz: frontZ + 1.15, rx: 0.34, ...SAFIRA_AWNING_SUB, aoHint: 0.94 },
      );
    }

    // 2 thin rooftop TV antennas above bays 1 & 4
    for (const ax of [-w * 0.5 + bayW * 1.5, -w * 0.5 + bayW * 4.5]) {
      specs.push(
        { geo: new THREE.CylinderGeometry(0.04, 0.07, 3.2, 4), px: ax, py: totalH + 1.7, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#64748b' },
        { geo: new THREE.BoxGeometry(1.4, 0.05, 0.05), px: ax, py: totalH + 3.05, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
        { geo: new THREE.BoxGeometry(1.0, 0.05, 0.05), px: ax, py: totalH + 2.65, pz: -1.5, slot: UTIL_SLOT, ...WHITE_SUB, tintHex: '#94a3b8' },
      );
    }
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
        const gy = estimateGroundY(vx, vz, hit.dist, hit.roadY, hit.s, hit.lateralOffset);
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
    mesh.castShadow = false;
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
    const isRoadsideCommercial =
      b.style === 'tamansari-arcade' ||
      b.style === 'pasar-raya-ruko' ||
      b.style === 'pasar-raya-ruko-south' ||
      b.style === 'market-complex' ||
      b.style === 'shophouse-row';
    const groundY = isRoadsideCommercial
      ? hit.roadY + 0.24
      : estimateGroundY(worldPos.x, worldPos.z, hit.dist, hit.roadY, hit.s, hit.lateralOffset);
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
