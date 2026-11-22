import * as THREE from 'three';
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
    | 'finish-gate';          // Wates finish arch & buildings
  wallColor?: string;
  roofColor?: string;
  exclusionRadius?: number;   // Radius (default 22m) to skip generic GeoJSON polygons
}

export interface SalatigaBuildingsBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Curated Stage 2 real-world Salatiga landmarks positioned along the 5km street circuit.
 * Coordinates are verified against trackCurve so zero structures encroach on drivable asphalt or Armco barriers.
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
    id: 'ruko-jend-sudirman',
    name: 'RUKO JL. JEND. SUDIRMAN',
    lon: 110.504455,
    lat: -7.32656,
    rotationDeg: 97,
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

interface TrackSpatialSample {
  x: number;
  y: number;
  z: number;
}

interface TrackSpatialQuery {
  queryNearest: (x: number, z: number) => { dist: number; roadY: number };
}

function createTrackSpatialQuery(trackCurve: THREE.CatmullRomCurve3): TrackSpatialQuery {
  const approxLen = Math.max(500, trackCurve.getLength());
  const sampleCount = Math.min(4000, Math.max(1200, Math.ceil(approxLen / 2)));
  const pts = trackCurve.getSpacedPoints(sampleCount);
  const samples: TrackSpatialSample[] = pts.map((p) => ({ x: p.x, y: p.y, z: p.z }));

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

  const queryNearest = (vx: number, vz: number): { dist: number; roadY: number } => {
    const cx = Math.floor(vx / cellSize);
    const cz = Math.floor(vz / cellSize);
    let bestDistSq = Infinity;
    let bestY = 0;
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
        }
      }
    }

    return {
      dist: bestDistSq < Infinity ? Math.sqrt(bestDistSq) : Infinity,
      roadY: bestY,
    };
  };

  return { queryNearest };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Matches buildHighlandTerrain elevation profile in salatigaTrack.ts so buildings seat cleanly into terrain.
 */
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

function createSignboardTexture(
  label: string,
  bgColor = '#111827',
  accentColor = '#dc2626',
  textColor = '#f9fafb',
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top and bottom accent trims
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, canvas.width, 14);
  ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

  // Subtle metallic frame border
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 18, canvas.width - 16, canvas.height - 32);

  // Auto-fit crisp Oxanium/sans title text
  let fontSize = 42;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (fontSize > 20) {
    ctx.font = `700 ${fontSize}px Oxanium, "Plus Jakarta Sans", sans-serif`;
    if (ctx.measureText(label).width <= canvas.width - 48) break;
    fontSize -= 2;
  }

  ctx.fillStyle = textColor;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createClockDialTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#f8f5ec';
  ctx.fillRect(0, 0, 256, 256);

  const cx = 128;
  const cy = 128;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 112, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.stroke();

  // Hour ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 78 : 86;
    const r1 = 96;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
    ctx.stroke();
  }

  // Clock hands (10:10 iconic watch angle)
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 44, cy - 28);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 62, cy - 36);
  ctx.stroke();

  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createOsmFacadeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Neutral white plaster base so vertex colors tint each building naturally
  ctx.fillStyle = '#f2f2f0';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle horizontal floor band shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillRect(0, 240, 256, 16);

  // 4 window bays per 1.0 UV repeat (each repeat = 1 floor height x 6m width)
  const cols = 4;
  const padX = 12;
  const cellW = 256 / cols;
  for (let c = 0; c < cols; c++) {
    const wx = c * cellW + padX;
    const ww = cellW - padX * 2;
    const wy = 48;
    const wh = 128;
    // Window glass
    ctx.fillStyle = '#475569';
    ctx.fillRect(wx, wy, ww, wh);
    // Subtle sky highlight
    ctx.fillStyle = '#64748b';
    ctx.fillRect(wx + 3, wy + 4, ww - 6, wh * 0.42);
    // Sill
    ctx.fillStyle = '#d6d3cd';
    ctx.fillRect(wx - 2, wy + wh, ww + 4, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createLandmarkSignMesh(
  name: string,
  width: number,
  height: number,
  bgColor: string,
  accentColor: string,
): THREE.Mesh {
  const tex = createSignboardTexture(name, bgColor, accentColor);
  const mat = new THREE.MeshStandardMaterial({
    map: tex ?? undefined,
    color: tex ? 0xffffff : 0x1e293b,
    roughness: 0.45,
    metalness: 0.15,
  });
  const geo = new THREE.BoxGeometry(width, height, 0.22);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function buildCustomLandmarkMesh(
  b: SalatigaCustomBuilding,
  groundY: number,
): THREE.Group {
  const landmark = new THREE.Group();
  landmark.name = `CustomLandmark_${b.id}`;

  const pos = gpsToWorld(b.lon, b.lat);
  landmark.position.set(pos.x, groundY, pos.z);
  landmark.rotation.y = THREE.MathUtils.degToRad(180 - b.rotationDeg);

  const floorH = b.floorHeight ?? 3.6;
  const totalH = b.floors * floorH;
  const w = b.widthMeters;
  const d = b.depthMeters;

  const wallMat = new THREE.MeshStandardMaterial({
    color: b.wallColor ?? '#efe8da',
    roughness: 0.82,
    metalness: 0.04,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: b.roofColor ?? '#9b3c2c',
    roughness: 0.72,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.22,
    metalness: 0.65,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3af,
    roughness: 0.9,
    metalness: 0.04,
  });

  // Grounding skirt (-2.2m below groundY so slopes never expose an air gap)
  const skirtMat = stoneMat;

  if (b.style === 'clock-roundabout') {
    // Landscaped octagonal plinth inside Bundaran Tamansari roundabout island
    const outerPlinth = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.1, 2.8, 8), stoneMat);
    outerPlinth.position.y = -0.7;
    outerPlinth.receiveShadow = true;
    outerPlinth.castShadow = true;
    landmark.add(outerPlinth);

    const grassRing = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f6e34, roughness: 0.92 }),
    );
    grassRing.position.y = 0.75;
    grassRing.receiveShadow = true;
    landmark.add(grassRing);

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 1.8, 8), wallMat);
    ped.position.y = 1.7;
    ped.castShadow = true;
    ped.receiveShadow = true;
    landmark.add(ped);

    // Tapered Javanese-colonial clock obelisk shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7.2, 2.2), wallMat);
    shaft.position.y = 6.2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    landmark.add(shaft);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.45, 2.7), trimMat);
    cornice.position.y = 9.95;
    cornice.castShadow = true;
    landmark.add(cornice);

    // Clock housing + 4-sided dials
    const clockBox = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.2, 2.35), wallMat);
    clockBox.position.y = 11.2;
    clockBox.castShadow = true;
    landmark.add(clockBox);

    const dialTex = createClockDialTexture();
    const dialMat = new THREE.MeshStandardMaterial({
      map: dialTex ?? undefined,
      color: dialTex ? 0xffffff : 0xf8f5ec,
      roughness: 0.35,
      metalness: 0.1,
    });
    const dialGeo = new THREE.PlaneGeometry(1.65, 1.65);
    const dialOffsets: [number, number, number, number][] = [
      [0, 11.2, 1.19, 0],
      [0, 11.2, -1.19, Math.PI],
      [1.19, 11.2, 0, Math.PI / 2],
      [-1.19, 11.2, 0, -Math.PI / 2],
    ];
    for (const [dx, dy, dz, ry] of dialOffsets) {
      const dial = new THREE.Mesh(dialGeo, dialMat);
      dial.position.set(dx, dy, dz);
      dial.rotation.y = ry;
      landmark.add(dial);
    }

    // Terracotta pyramid crown & gold finial spire
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.4, 4), roofMat);
    cap.position.y = 13.4;
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    landmark.add(cap);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.25,
    });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 1.6, 8), goldMat);
    spire.position.y = 15.2;
    landmark.add(spire);

    const sign = createLandmarkSignMesh(b.name, 3.8, 0.82, '#14213d', '#f59e0b');
    sign.position.set(0, 2.8, 1.32);
    landmark.add(sign);
  } else if (b.style === 'colonial-civic') {
    // Raised veranda podium + foundation
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 2.8, d + 3.2), skirtMat);
    plinth.position.set(0, -0.8, 0.6);
    plinth.receiveShadow = true;
    landmark.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, totalH, d), wallMat);
    body.position.set(0, 0.6 + totalH * 0.5, -0.4);
    body.castShadow = true;
    body.receiveShadow = true;
    landmark.add(body);

    // Front colonnade portico + 6 white Tuscan columns
    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.68, 0.48, 4.4), trimMat);
    porticoRoof.position.set(0, 0.6 + totalH + 0.1, d * 0.5 + 1.2);
    porticoRoof.castShadow = true;
    landmark.add(porticoRoof);

    const colGeo = new THREE.CylinderGeometry(0.24, 0.28, totalH, 10);
    for (let i = 0; i < 6; i++) {
      const cx = THREE.MathUtils.lerp(-w * 0.28, w * 0.28, i / 5);
      const col = new THREE.Mesh(colGeo, trimMat);
      col.position.set(cx, 0.6 + totalH * 0.5, d * 0.5 + 2.8);
      col.castShadow = true;
      landmark.add(col);
    }

    // Tall colonial louvered windows across facade
    const winGeo = new THREE.BoxGeometry(1.35, 2.3, 0.18);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.78 });
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const win = new THREE.Mesh(winGeo, woodMat);
      win.position.set(i * (w / 8.2), 0.6 + totalH * 0.48, d * 0.5 - 0.36);
      landmark.add(win);
    }

    // Tiered Javanese-Dutch Limasan / hipped clay roof
    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.6, 4), roofMat);
    mainRoof.position.set(0, 0.6 + totalH + 1.8, -0.4);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    mainRoof.castShadow = true;
    landmark.add(mainRoof);

    const crownRoof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.26, 2.0, 4), roofMat);
    crownRoof.position.set(0, 0.6 + totalH + 3.6, -0.4);
    crownRoof.rotation.y = Math.PI / 4;
    crownRoof.castShadow = true;
    landmark.add(crownRoof);

    const sign = createLandmarkSignMesh(b.name, Math.min(11, w * 0.45), 1.35, '#1e293b', '#b91c1c');
    sign.position.set(0, 0.6 + totalH + 0.75, d * 0.5 + 3.15);
    landmark.add(sign);
  } else if (b.style === 'market-complex') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 2.4, d + 1.2), skirtMat);
    base.position.set(0, -1.1, 0);
    base.receiveShadow = true;
    landmark.add(base);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, totalH, d), wallMat);
    body.position.set(0, totalH * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    landmark.add(body);

    // Upper floor horizontal sun-breaker ledges + dark glass window bands
    for (let fl = 1; fl < b.floors; fl++) {
      const fy = fl * floorH + 0.4;
      const winBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 1.45, d + 0.16), glassMat);
      winBand.position.set(0, fy + 1.2, 0);
      landmark.add(winBand);

      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.26, d + 0.9), trimMat);
      ledge.position.set(0, fy, 0);
      ledge.castShadow = true;
      landmark.add(ledge);
    }

    // Vibrant Indonesian market entrance canopies along the road-facing facade (+Z)
    const canopyColors = [0xc2410c, 0x0f766e, 0xb45309, 0x0f766e, 0xc2410c];
    const segW = w / canopyColors.length;
    for (let i = 0; i < canopyColors.length; i++) {
      const canopyMat = new THREE.MeshStandardMaterial({
        color: canopyColors[i],
        roughness: 0.65,
      });
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(segW - 0.3, 0.22, 3.2), canopyMat);
      canopy.position.set(-w * 0.5 + segW * (i + 0.5), 3.35, d * 0.5 + 1.45);
      canopy.rotation.x = 0.22;
      canopy.castShadow = true;
      landmark.add(canopy);
    }

    // Pitched industrial steel roof + parapet
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 1.1, d + 0.5), roofMat);
    parapet.position.set(0, totalH + 0.55, 0);
    parapet.castShadow = true;
    landmark.add(parapet);

    const sign = createLandmarkSignMesh(b.name, Math.min(14, w * 0.52), 1.8, '#0f172a', '#f59e0b');
    sign.position.set(0, totalH + 0.85, d * 0.5 + 0.36);
    landmark.add(sign);
  } else if (b.style === 'shophouse-row') {
    const numBays = 5;
    const bayW = w / numBays;
    const bayPalettes = ['#efe4d2', '#e5d3b8', '#dce5dd', '#ebd8c8', '#e6dfcf'];
    const awningColors = ['#b91c1c', '#1d4ed8', '#047857', '#b45309', '#991b1b'];

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 2.4, d + 1.8), skirtMat);
    plinth.position.set(0, -1.1, 0.5);
    plinth.receiveShadow = true;
    landmark.add(plinth);

    for (let i = 0; i < numBays; i++) {
      const bx = -w * 0.5 + bayW * (i + 0.5);
      const bayMat = new THREE.MeshStandardMaterial({
        color: bayPalettes[i % bayPalettes.length],
        roughness: 0.84,
      });
      const bayBody = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.25, totalH, d), bayMat);
      bayBody.position.set(bx, totalH * 0.5, 0);
      bayBody.castShadow = true;
      bayBody.receiveShadow = true;
      landmark.add(bayBody);

      // Sloped terracotta gable roof per ruko
      const bayRoof = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.2, 0.35, d + 1.4), roofMat);
      bayRoof.position.set(bx, totalH + 0.35, 0.3);
      bayRoof.rotation.x = 0.16;
      bayRoof.castShadow = true;
      landmark.add(bayRoof);

      // Ground floor colonnade overhang
      const awningMat = new THREE.MeshStandardMaterial({
        color: awningColors[i % awningColors.length],
        roughness: 0.65,
      });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.3, 0.24, 2.4), awningMat);
      awning.position.set(bx, 3.25, d * 0.5 + 1.05);
      awning.rotation.x = 0.18;
      awning.castShadow = true;
      landmark.add(awning);

      // Upper floor window strip
      const win = new THREE.Mesh(new THREE.BoxGeometry(bayW * 0.72, 1.35, 0.18), glassMat);
      win.position.set(bx, floorH * 1.45, d * 0.5 + 0.02);
      landmark.add(win);
      if (b.floors >= 3) {
        const win2 = new THREE.Mesh(new THREE.BoxGeometry(bayW * 0.72, 1.35, 0.18), glassMat);
        win2.position.set(bx, floorH * 2.45, d * 0.5 + 0.02);
        landmark.add(win2);
      }
    }

    const sign = createLandmarkSignMesh(b.name, Math.min(13, w * 0.42), 1.45, '#1e293b', '#dc2626');
    sign.position.set(0, 4.15, d * 0.5 + 0.25);
    landmark.add(sign);
  } else if (b.style === 'campus-gate') {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 2.4, d + 4.4), skirtMat);
    plinth.position.set(0, -1.1, 1.4);
    plinth.receiveShadow = true;
    landmark.add(plinth);

    // Main academic block set slightly back
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(w, totalH, d * 0.68), wallMat);
    mainHall.position.set(0, totalH * 0.5, -d * 0.16);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    landmark.add(mainHall);

    // Window glazing bands
    for (let fl = 0; fl < b.floors; fl++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 1.5, 0.2), glassMat);
      band.position.set(0, fl * floorH + 1.75, -d * 0.16 + d * 0.34 + 0.04);
      landmark.add(band);
    }

    // Javanese campus hipped roof
    const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.6, 3.4, 4), roofMat);
    hallRoof.position.set(0, totalH + 1.7, -d * 0.16);
    hallRoof.rotation.y = Math.PI / 4;
    hallRoof.scale.set(1, 1, 0.55);
    hallRoof.castShadow = true;
    landmark.add(hallRoof);

    // Twin university entrance gate pylons + arch beam
    const pylonGeo = new THREE.BoxGeometry(2.2, 6.2, 2.2);
    const pylonL = new THREE.Mesh(pylonGeo, stoneMat);
    pylonL.position.set(-w * 0.28, 3.1, d * 0.5 + 1.5);
    pylonL.castShadow = true;
    landmark.add(pylonL);

    const pylonR = new THREE.Mesh(pylonGeo, stoneMat);
    pylonR.position.set(w * 0.28, 3.1, d * 0.5 + 1.5);
    pylonR.castShadow = true;
    landmark.add(pylonR);

    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.66, 1.35, 1.4), trimMat);
    archBeam.position.set(0, 6.0, d * 0.5 + 1.5);
    archBeam.castShadow = true;
    landmark.add(archBeam);

    const sign = createLandmarkSignMesh(b.name, w * 0.56, 1.25, '#1e3a8a', '#f59e0b');
    sign.position.set(0, 6.0, d * 0.5 + 2.25);
    landmark.add(sign);
  } else if (b.style === 'highland-cafe') {
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.76 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.85 });

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 2.5, d + 2.8), skirtMat);
    plinth.position.set(0, -1.15, 0.8);
    plinth.receiveShadow = true;
    landmark.add(plinth);

    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(w, floorH, d), wallMat);
    lowerBody.position.set(0, floorH * 0.5, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    landmark.add(lowerBody);

    // Warm glazed front cafe wall
    const warmGlass = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.5,
    });
    const storefront = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, floorH * 0.72, 0.25), warmGlass);
    storefront.position.set(0, floorH * 0.45, d * 0.5 + 0.04);
    landmark.add(storefront);

    // Upper viewing deck + slatted wood overhang
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 1.8, 0.35, d + 3.4), deckMat);
    deck.position.set(0, floorH + 0.18, 1.0);
    deck.castShadow = true;
    landmark.add(deck);

    const upperPavilion = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, floorH * 0.9, d * 0.76), timberMat);
    upperPavilion.position.set(0, floorH + floorH * 0.45, -d * 0.08);
    upperPavilion.castShadow = true;
    landmark.add(upperPavilion);

    const slantedRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 0.32, d + 3.8), roofMat);
    slantedRoof.position.set(0, totalH + 0.65, 0.8);
    slantedRoof.rotation.x = -0.14;
    slantedRoof.castShadow = true;
    landmark.add(slantedRoof);

    const sign = createLandmarkSignMesh(b.name, Math.min(10.5, w * 0.52), 1.35, '#1c1917', '#f59e0b');
    sign.position.set(0, floorH + 0.95, d * 0.5 + 2.75);
    landmark.add(sign);
  } else {
    // 'finish-gate': Race Control Hospitality Tower & Roadside Timing Gate
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 2.4, d + 1.4), skirtMat);
    plinth.position.set(0, -1.1, 0);
    plinth.receiveShadow = true;
    landmark.add(plinth);

    const pavilion = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, totalH, d), wallMat);
    pavilion.position.set(-w * 0.12, totalH * 0.5, 0);
    pavilion.castShadow = true;
    pavilion.receiveShadow = true;
    landmark.add(pavilion);

    const timingTower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, totalH + 3.6, d * 0.85), trimMat);
    timingTower.position.set(w * 0.36, (totalH + 3.6) * 0.5, 0);
    timingTower.castShadow = true;
    landmark.add(timingTower);

    const redAccent = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.55, d + 0.6), roofMat);
    redAccent.position.set(0, totalH + 0.28, 0);
    redAccent.castShadow = true;
    landmark.add(redAccent);

    const glazing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.66, floorH * 0.72, 0.22), glassMat);
    glazing.position.set(-w * 0.12, floorH * 1.42, d * 0.5 + 0.05);
    landmark.add(glazing);

    const sign = createLandmarkSignMesh(b.name, Math.min(13.5, w * 0.62), 1.6, '#111827', '#ef4444');
    sign.position.set(0, totalH + 1.2, d * 0.5 + 0.35);
    landmark.add(sign);
  }

  return landmark;
}

interface OsmPolygonRecord {
  ring: [number, number][]; // [x, z] in world space
  floors: number;
  seed: number;
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
  if (bType === 'commercial' || bType === 'retail' || bType === 'office' || bType === 'civic' || amenity === 'marketplace') {
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
      if (dx * dx + dz * dz < 0.09) continue; // Skip near-duplicate vertices (< 0.3m)
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

  // Normalize winding to CCW in map space (x, -z) so outward wall normals are (-dz, 0, dx)
  let signedAreaMap = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    signedAreaMap += a[0] * -b[1] - b[0] * -a[1];
  }
  if (Math.abs(signedAreaMap) < 2.0) return []; // Ignore degenerate slivers < 1m²
  if (signedAreaMap < 0) {
    pts.reverse();
  }

  return pts;
}

function buildMergedOsmBuildings(
  trackQuery: TrackSpatialQuery,
  customPositions: { x: number; z: number; radius: number }[],
  geoJsonData: unknown,
): { wallsMesh: THREE.Mesh | null; roofsMesh: THREE.Mesh | null } {
  if (!geoJsonData || typeof geoJsonData !== 'object') {
    return { wallsMesh: null, roofsMesh: null };
  }
  const features = (geoJsonData as { features?: unknown[] }).features;
  if (!Array.isArray(features) || features.length === 0) {
    return { wallsMesh: null, roofsMesh: null };
  }

  const MIN_ROAD_CLEARANCE_METERS = 10.8; // Road +/-7.0m, kerbs +/-7.6m, Armco +/-8.2m + clearance
  const MAX_CORRIDOR_METERS = 260;

  const records: OsmPolygonRecord[] = [];
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

    // Check custom building exclusion radius
    for (let i = 0; i < customPositions.length; i++) {
      const cp = customPositions[i];
      const dx = cx - cp.x;
      const dz = cz - cp.z;
      if (dx * dx + dz * dz <= cp.radius * cp.radius) {
        return;
      }
    }

    // Check distance to track across centroid, all vertices, and edge midpoints
    const cenHit = trackQuery.queryNearest(cx, cz);
    if (cenHit.dist < MIN_ROAD_CLEARANCE_METERS || cenHit.dist > MAX_CORRIDOR_METERS) {
      return;
    }

    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (trackQuery.queryNearest(a[0], a[1]).dist < MIN_ROAD_CLEARANCE_METERS) {
        return;
      }
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;
      if (trackQuery.queryNearest(mx, mz).dist < MIN_ROAD_CLEARANCE_METERS) {
        return;
      }
    }

    const seed = hashString(`${featureIdx}:${Math.round(cx)}:${Math.round(cz)}`);
    const floors = estimateOsmFloors(props, seed);
    const wallHex = OSM_WALL_PALETTE[Math.floor(seed * OSM_WALL_PALETTE.length) % OSM_WALL_PALETTE.length];
    const roofHex = OSM_ROOF_PALETTE[Math.floor(((seed * 13.7) % 1) * OSM_ROOF_PALETTE.length) % OSM_ROOF_PALETTE.length];

    tmpWallColor.set(wallHex);
    tmpRoofColor.set(roofHex);

    records.push({
      ring,
      floors,
      seed,
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

  if (records.length === 0) {
    return { wallsMesh: null, roofsMesh: null };
  }

  const wallPos: number[] = [];
  const wallNorm: number[] = [];
  const wallUv: number[] = [];
  const wallCol: number[] = [];
  const wallIdx: number[] = [];

  const roofPos: number[] = [];
  const roofNorm: number[] = [];
  const roofCol: number[] = [];
  const roofIdx: number[] = [];

  const FLOOR_HEIGHT_METERS = 3.25;

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

    const baseY = minTerrainY - 2.2; // Deep foundation skirt prevents floating on slopes
    const eaveY = maxTerrainY + rec.floors * FLOOR_HEIGHT_METERS;
    const heightSpan = eaveY - baseY;
    const vMax = heightSpan / FLOOR_HEIGHT_METERS;

    // 1. Extruded Vertical Walls
    const wc = rec.wallColor;
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

      const vBase = wallPos.length / 3;
      wallPos.push(
        a[0], baseY, a[1],
        b[0], baseY, b[1],
        b[0], eaveY, b[1],
        a[0], eaveY, a[1],
      );
      for (let k = 0; k < 4; k++) {
        wallNorm.push(nx, 0, nz);
        wallCol.push(wc.r, wc.g, wc.b);
      }
      wallUv.push(0, 0, uMax, 0, uMax, vMax, 0, vMax);
      wallIdx.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    }

    // 2. Triangulated Roof Deck + Subtle Raised Cap for silhouette depth
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
    const roofBaseVert = roofPos.length / 3;

    // Eave perimeter vertices
    for (let i = 0; i < n; i++) {
      roofPos.push(ring[i][0], eaveY, ring[i][1]);
      roofNorm.push(0, 1, 0);
      roofCol.push(rc.r, rc.g, rc.b);
    }

    if (n <= 6 && rec.floors <= 2) {
      // Crisp Javanese hipped/pyramidal roof peak for residential/compact buildings
      const peakVert = roofBaseVert + n;
      roofPos.push(cx, roofPeakY, cz);
      roofNorm.push(0, 1, 0);
      roofCol.push(
        Math.min(1, rc.r * 1.12),
        Math.min(1, rc.g * 1.12),
        Math.min(1, rc.b * 1.12),
      );
      for (let i = 0; i < n; i++) {
        const iNext = (i + 1) % n;
        const p0x = ring[i][0];
        const p0z = ring[i][1];
        const p1x = ring[iNext][0];
        const p1z = ring[iNext][1];
        // Verify upward Y normal: (p1-p0) x (center-p0)
        const ny = (p1z - p0z) * (cx - p0x) - (p1x - p0x) * (cz - p0z);
        if (ny >= 0) {
          roofIdx.push(roofBaseVert + i, roofBaseVert + iNext, peakVert);
        } else {
          roofIdx.push(roofBaseVert + i, peakVert, roofBaseVert + iNext);
        }
      }
    } else {
      // Triangulated flat/parapet roof deck for complex commercial footprints
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
          roofIdx.push(roofBaseVert + ia, roofBaseVert + ib, roofBaseVert + ic);
        } else {
          roofIdx.push(roofBaseVert + ia, roofBaseVert + ic, roofBaseVert + ib);
        }
      }
    }
  }

  let wallsMesh: THREE.Mesh | null = null;
  if (wallIdx.length > 0) {
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wallNorm, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(wallCol, 3));
    wallGeo.setIndex(wallIdx);
    wallGeo.computeBoundingSphere();

    const facadeTex = createOsmFacadeTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex ?? undefined,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.05,
    });
    wallsMesh = new THREE.Mesh(wallGeo, wallMat);
    wallsMesh.name = 'OsmBuildingWalls';
    wallsMesh.castShadow = true;
    wallsMesh.receiveShadow = true;
  }

  let roofsMesh: THREE.Mesh | null = null;
  if (roofIdx.length > 0) {
    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPos, 3));
    roofGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roofNorm, 3));
    roofGeo.setAttribute('color', new THREE.Float32BufferAttribute(roofCol, 3));
    roofGeo.setIndex(roofIdx);
    roofGeo.computeVertexNormals();
    roofGeo.computeBoundingSphere();

    const roofMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.06,
    });
    roofsMesh = new THREE.Mesh(roofGeo, roofMat);
    roofsMesh.name = 'OsmBuildingRoofs';
    roofsMesh.castShadow = true;
    roofsMesh.receiveShadow = true;
  }

  return { wallsMesh, roofsMesh };
}

/**
 * Builds Stage 2 custom Salatiga landmarks and merged 60 FPS OSM corridor buildings.
 * Plug-and-play compatible with F1cityrace.
 */
export function buildSalatigaCustomBuildings(
  trackCurve: THREE.CatmullRomCurve3,
  geoJsonData?: any,
): SalatigaBuildingsBuildResult {
  const group = new THREE.Group();
  group.name = 'SalatigaBuildings';

  const trackQuery = createTrackSpatialQuery(trackCurve);
  const customPositions: { x: number; z: number; radius: number }[] = [];

  // 1. Curated Salatiga Landmarks
  const landmarksGroup = new THREE.Group();
  landmarksGroup.name = 'SalatigaCustomLandmarks';
  for (let i = 0; i < SALATIGA_CUSTOM_BUILDINGS.length; i++) {
    const b = SALATIGA_CUSTOM_BUILDINGS[i];
    const worldPos = gpsToWorld(b.lon, b.lat);
    const hit = trackQuery.queryNearest(worldPos.x, worldPos.z);
    const groundY = estimateGroundY(worldPos.x, worldPos.z, hit.dist, hit.roadY);

    customPositions.push({
      x: worldPos.x,
      z: worldPos.z,
      radius: b.exclusionRadius ?? 22,
    });

    landmarksGroup.add(buildCustomLandmarkMesh(b, groundY));
  }
  group.add(landmarksGroup);

  // 2. Merged OSM GeoJSON Corridor Buildings (2 draw calls total for 60 FPS)
  const { wallsMesh, roofsMesh } = buildMergedOsmBuildings(
    trackQuery,
    customPositions,
    geoJsonData,
  );
  if (wallsMesh) group.add(wallsMesh);
  if (roofsMesh) group.add(roofsMesh);

  const dispose = () => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

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
