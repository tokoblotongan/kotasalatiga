import * as THREE from 'three';

export const SALATIGA_TRACK_CONFIG = {
  originLon: 110.504924,
  originLat: -7.324859,
  originElev: 590,
  metersPerDegLat: 110574,
  metersPerDegLon: 111320 * Math.cos((-7.324859 * Math.PI) / 180),
  normalizeElevationToStart: true,
  elevationScale: 0.35,
  roadWidthMeters: 14,
  kerbWidthMeters: 1.2,
  barrierOffsetMeters: 8.2,
  preventOffTrackSprawl: true,
  onlyAlongActiveTrack: true,
} as const;

export interface SalatigaGeoJsonFeature {
  type: string;
  properties?: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: [number, number, number?][];
  };
}

export interface SalatigaGeoJson {
  type: string;
  features: SalatigaGeoJsonFeature[];
}

export interface TrackSample {
  u: number;
  distanceMeters: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  horizForward: THREE.Vector3;
  right: THREE.Vector3;
}

export interface SalatigaTrackBuildResult {
  group: THREE.Group;
  trackCurve: THREE.CatmullRomCurve3;
  trackLengthMeters: number;
  samples: TrackSample[];
  dispose: () => void;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Exact F1cityrace projection: GPS (lon, lat, elev) -> Three.js World (x, y, z)
 * East (+X), Up (+Y), South (+Z)
 */
export function gpsToWorld(
  lon: number,
  lat: number,
  elev: number = SALATIGA_TRACK_CONFIG.originElev,
): THREE.Vector3 {
  const {
    originLon,
    originLat,
    originElev,
    metersPerDegLon,
    metersPerDegLat,
    normalizeElevationToStart,
    elevationScale,
  } = SALATIGA_TRACK_CONFIG;

  const x = (lon - originLon) * metersPerDegLon;
  const z = -(lat - originLat) * metersPerDegLat;
  const baseElev = normalizeElevationToStart ? originElev : 0;
  const y = (elev - baseElev) * elevationScale;

  return new THREE.Vector3(x, y, z);
}

/**
 * Exact inverse F1cityrace projection: Three.js World (x, z, y) -> GPS (lon, lat, elev)
 */
export function worldToGps(
  x: number,
  z: number,
  y: number = 0,
): { lon: number; lat: number; elev: number } {
  const {
    originLon,
    originLat,
    originElev,
    metersPerDegLon,
    metersPerDegLat,
    normalizeElevationToStart,
    elevationScale,
  } = SALATIGA_TRACK_CONFIG;

  const lon = originLon + x / metersPerDegLon;
  const lat = originLat - z / metersPerDegLat;
  const baseElev = normalizeElevationToStart ? originElev : 0;
  const elev = baseElev + y / elevationScale;

  return { lon, lat, elev };
}

function createAsphaltTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, width, height);

  // Subtle aggregate grain (deterministic pseudo-random)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 14000; i++) {
    const px = rand() * width;
    const py = rand() * height;
    const v = 26 + Math.floor(rand() * 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(px, py, 2, 2);
  }

  // Subtle tire rubber wear tracks in both lanes
  const leftLane = ctx.createLinearGradient(width * 0.16, 0, width * 0.42, 0);
  leftLane.addColorStop(0, 'rgba(12,14,17,0)');
  leftLane.addColorStop(0.5, 'rgba(12,14,17,0.22)');
  leftLane.addColorStop(1, 'rgba(12,14,17,0)');
  ctx.fillStyle = leftLane;
  ctx.fillRect(width * 0.16, 0, width * 0.26, height);

  const rightLane = ctx.createLinearGradient(width * 0.58, 0, width * 0.84, 0);
  rightLane.addColorStop(0, 'rgba(12,14,17,0)');
  rightLane.addColorStop(0.5, 'rgba(12,14,17,0.22)');
  rightLane.addColorStop(1, 'rgba(12,14,17,0)');
  ctx.fillStyle = rightLane;
  ctx.fillRect(width * 0.58, 0, width * 0.26, height);

  // Crisp solid white edge lines (inset ~0.35m from 14m edges -> ~2.5% of width)
  ctx.fillStyle = '#e4e8ed';
  const edgeWidth = 9;
  const edgeInset = 12;
  ctx.fillRect(edgeInset, 0, edgeWidth, height);
  ctx.fillRect(width - edgeInset - edgeWidth, 0, edgeWidth, height);

  // Crisp white dashed center line (2 dashes per tile)
  const centerW = 8;
  const centerX = (width - centerW) * 0.5;
  ctx.fillStyle = '#eef2f6';
  ctx.fillRect(centerX, 24, centerW, 112);
  ctx.fillRect(centerX, 280, centerW, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function createKerbTexture(): THREE.CanvasTexture {
  const width = 64;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Alternating FIA red & white blocks
  ctx.fillStyle = '#d92626';
  ctx.fillRect(0, 0, width, height / 2);
  ctx.fillStyle = '#f4f4f6';
  ctx.fillRect(0, height / 2, width, height / 2);

  // Subtle concrete seam shading
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, 4, height);
  ctx.fillRect(0, height / 2 - 2, width, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function createCheckeredTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const cols = 16;
  const rows = 4;
  const cw = width / cols;
  const ch = height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f4f4f5' : '#18181b';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function createGantryBannerTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, width, height);

  // Checkered left & right flanks
  const sq = 20;
  for (let r = 0; r < height / sq; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f4f4f5' : '#18181b';
      ctx.fillRect(c * sq, r * sq, sq, sq);
      ctx.fillRect(width - (c + 1) * sq, r * sq, sq, sq);
    }
  }

  // Crimson racing stripe accent
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(120, 0, width - 240, 12);
  ctx.fillRect(120, height - 12, width - 240, 12);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 48px "Oxanium", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SALATIGA · TAMANSARI 5KM', width / 2, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function createTerrainGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3f6a34';
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const g = 88 + Math.floor(rand() * 38);
    const r = Math.floor(g * 0.62);
    const b = Math.floor(g * 0.45);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(90, 90);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds an anti-twist horizontal ribbon BufferGeometry along track samples.
 * Every slice uses fixed world-up crossed with horizontal tangent so the ribbon
 * never banks or twists sideways on climbs/descents.
 */
function buildHorizontalRibbonGeometry(
  samples: TrackSample[],
  offsetLeft: number,
  offsetRight: number,
  yOffsetLeft: number,
  yOffsetRight: number,
  uvTileLengthMeters: number,
): THREE.BufferGeometry {
  const count = samples.length;
  const positions = new Float32Array(count * 2 * 3);
  const normals = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indices = new Uint32Array((count - 1) * 6);

  const surfaceNormal = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const s = samples[i];
    const v = s.distanceMeters / uvTileLengthMeters;

    // Left edge vertex (offsetLeft along right vector)
    const lx = s.position.x + s.right.x * offsetLeft;
    const ly = s.position.y + yOffsetLeft;
    const lz = s.position.z + s.right.z * offsetLeft;

    // Right edge vertex (offsetRight along right vector)
    const rx = s.position.x + s.right.x * offsetRight;
    const ry = s.position.y + yOffsetRight;
    const rz = s.position.z + s.right.z * offsetRight;

    const vi = i * 2;
    positions[vi * 3] = lx;
    positions[vi * 3 + 1] = ly;
    positions[vi * 3 + 2] = lz;

    positions[(vi + 1) * 3] = rx;
    positions[(vi + 1) * 3 + 1] = ry;
    positions[(vi + 1) * 3 + 2] = rz;

    // Surface normal perpendicular to horizontal right vector and 3D tangent
    surfaceNormal.crossVectors(s.right, s.tangent).normalize();
    if (surfaceNormal.y < 0) surfaceNormal.negate();

    normals[vi * 3] = surfaceNormal.x;
    normals[vi * 3 + 1] = surfaceNormal.y;
    normals[vi * 3 + 2] = surfaceNormal.z;

    normals[(vi + 1) * 3] = surfaceNormal.x;
    normals[(vi + 1) * 3 + 1] = surfaceNormal.y;
    normals[(vi + 1) * 3 + 2] = surfaceNormal.z;

    uvs[vi * 2] = 0;
    uvs[vi * 2 + 1] = v;
    uvs[(vi + 1) * 2] = 1;
    uvs[(vi + 1) * 2 + 1] = v;

    if (i < count - 1) {
      const idx = i * 6;
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      indices[idx] = a;
      indices[idx + 1] = b;
      indices[idx + 2] = c;
      indices[idx + 3] = b;
      indices[idx + 4] = d;
      indices[idx + 5] = c;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds a vertical Armco W-beam guardrail ribbon along one side of the track.
 */
function buildArmcoBarrierGeometry(
  samples: TrackSample[],
  lateralOffset: number,
): THREE.BufferGeometry {
  // Profile points: (heightOffset, extraOutwardOffset)
  // Double-faced closed-top beam profile so visible from both track and Free Orbit camera
  const sign = Math.sign(lateralOffset) || 1;
  const profile: [number, number][] = [
    [0.34, 0.0],
    [0.44, -0.07 * sign],
    [0.56, 0.02 * sign],
    [0.68, -0.07 * sign],
    [0.78, 0.0],
    [0.78, 0.08 * sign],
    [0.34, 0.08 * sign],
    [0.34, 0.0],
  ];
  const ringPts = profile.length;
  const count = samples.length;
  const positions = new Float32Array(count * ringPts * 3);
  const indices = new Uint32Array((count - 1) * (ringPts - 1) * 6);

  for (let i = 0; i < count; i++) {
    const s = samples[i];
    for (let p = 0; p < ringPts; p++) {
      const [hy, dLat] = profile[p];
      const off = lateralOffset + dLat;
      const vi = (i * ringPts + p) * 3;
      positions[vi] = s.position.x + s.right.x * off;
      positions[vi + 1] = s.position.y + hy;
      positions[vi + 2] = s.position.z + s.right.z * off;
    }

    if (i < count - 1) {
      for (let p = 0; p < ringPts - 1; p++) {
        const a = i * ringPts + p;
        const b = i * ringPts + p + 1;
        const c = (i + 1) * ringPts + p;
        const d = (i + 1) * ringPts + p + 1;
        const base = (i * (ringPts - 1) + p) * 6;
        if (sign > 0) {
          indices[base] = a;
          indices[base + 1] = b;
          indices[base + 2] = c;
          indices[base + 3] = b;
          indices[base + 4] = d;
          indices[base + 5] = c;
        } else {
          indices[base] = a;
          indices[base + 1] = c;
          indices[base + 2] = b;
          indices[base + 3] = b;
          indices[base + 4] = c;
          indices[base + 5] = d;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildStartFinishGantry(sample0: TrackSample): THREE.Group {
  const gantry = new THREE.Group();
  gantry.name = 'StartFinishGantry';

  // Align gantry to start sample orientation
  // Local +Z = horizForward, Local +X = -right, Local +Y = up
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-sample0.right.x, 0, -sample0.right.z),
    WORLD_UP,
    sample0.horizForward,
  );
  gantry.position.copy(sample0.position);
  gantry.quaternion.setFromRotationMatrix(basis);

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x222730,
    metalness: 0.78,
    roughness: 0.34,
  });
  const footingMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    metalness: 0.1,
    roughness: 0.85,
  });

  // 1-2. Left and Right concrete footings & vertical steel stanchions at ±9.2m
  const stanchionGeo = new THREE.BoxGeometry(0.48, 6.4, 0.56);
  const footingGeo = new THREE.BoxGeometry(0.9, 1.0, 1.1);
  for (const side of [-1, 1]) {
    const xPos = side * 9.2;
    const footing = new THREE.Mesh(footingGeo, footingMat);
    footing.position.set(xPos, 0.1, 0);
    footing.castShadow = true;
    footing.receiveShadow = true;
    gantry.add(footing);

    const tower = new THREE.Mesh(stanchionGeo, steelMat);
    tower.position.set(xPos, 3.2, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    gantry.add(tower);
  }

  // 3. Overhead truss bridge spanning 18.88m
  const bridgeGeo = new THREE.BoxGeometry(18.88, 0.55, 0.7);
  const bridge = new THREE.Mesh(bridgeGeo, steelMat);
  bridge.position.set(0, 6.1, 0);
  bridge.castShadow = true;
  bridge.receiveShadow = true;
  gantry.add(bridge);

  // 4. Dual-sided Start/Finish signage banner
  const bannerTex = createGantryBannerTexture();
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.42,
    metalness: 0.18,
  });
  const bannerGeo = new THREE.BoxGeometry(15.2, 1.35, 0.18);
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 5.45, 0);
  banner.castShadow = true;
  gantry.add(banner);

  // 5. FIA 5-pod start light gantry bar
  const lightBoxGeo = new THREE.BoxGeometry(3.4, 0.44, 0.28);
  const lightBox = new THREE.Mesh(lightBoxGeo, steelMat);
  lightBox.position.set(0, 4.45, 0.18);
  lightBox.castShadow = true;
  gantry.add(lightBox);

  const lensGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12);
  lensGeo.rotateX(Math.PI / 2);
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.1,
  });
  for (let i = 0; i < 5; i++) {
    const lx = (i - 2) * 0.62;
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(lx, 4.45, 0.34);
    gantry.add(lens);
  }

  // 6. Checkered Start/Finish asphalt stripe flush on road
  const checkTex = createCheckeredTexture();
  const checkMat = new THREE.MeshStandardMaterial({
    map: checkTex,
    roughness: 0.75,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const lineGeo = new THREE.PlaneGeometry(13.2, 1.8);
  lineGeo.rotateX(-Math.PI / 2);
  const startLine = new THREE.Mesh(lineGeo, checkMat);
  startLine.position.set(0, 0.025, 0);
  startLine.receiveShadow = true;
  gantry.add(startLine);

  return gantry;
}

function buildHighlandTerrain(
  samples: TrackSample[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): THREE.Group {
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'HighlandTerrain';

  // Build spatial hash grid for fast O(1) nearest-segment lookup in XZ
  const cellSize = 32;
  const grid = new Map<string, number[]>();
  const numSegs = samples.length - 1;

  for (let i = 0; i < numSegs; i++) {
    const a = samples[i].position;
    const b = samples[i + 1].position;
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

  const checkedStamp = new Int32Array(numSegs);
  let stampId = 1;

  function queryNearestTrack(vx: number, vz: number): { dist: number; roadY: number } {
    const cx = Math.floor(vx / cellSize);
    const cz = Math.floor(vz / cellSize);
    const radiusCells = 4; // +/-128m coverage (comfortably covers 95m slope zone)
    let bestDistSq = Infinity;
    let bestY = 0;
    stampId++;

    for (let dxCell = -radiusCells; dxCell <= radiusCells; dxCell++) {
      for (let dzCell = -radiusCells; dzCell <= radiusCells; dzCell++) {
        const list = grid.get(`${cx + dxCell},${cz + dzCell}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const segIdx = list[k];
          if (checkedStamp[segIdx] === stampId) continue;
          checkedStamp[segIdx] = stampId;

          const a = samples[segIdx].position;
          const b = samples[segIdx + 1].position;
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const lenSq = abx * abx + abz * abz;
          let t = 0;
          if (lenSq > 1e-8) {
            t = ((vx - a.x) * abx + (vz - a.z) * abz) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
          }
          const projX = a.x + abx * t;
          const projZ = a.z + abz * t;
          const dSq = (vx - projX) * (vx - projX) + (vz - projZ) * (vz - projZ);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestY = a.y + (b.y - a.y) * t;
          }
        }
      }
    }

    return {
      dist: bestDistSq < Infinity ? Math.sqrt(bestDistSq) : Infinity,
      roadY: bestY,
    };
  }

  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Highland terrain inner grid covering circuit footprint + margin
  const margin = 170;
  const x0 = minX - margin;
  const x1 = maxX + margin;
  const z0 = minZ - margin;
  const z1 = maxZ + margin;
  const width = x1 - x0;
  const depth = z1 - z0;

  // 7m spacing ensures >= 2 vertices inside every 14m+11m road corridor so triangles cannot bridge above asphalt
  const step = 7;
  const segX = Math.max(80, Math.ceil(width / step));
  const segZ = Math.max(80, Math.ceil(depth / step));

  const innerGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  innerGeo.rotateX(-Math.PI / 2);
  innerGeo.translate((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5);

  const posAttr = innerGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cRoadShoulder = new THREE.Color('#4a7239');
  const cMidGrass = new THREE.Color('#3c6831');
  const cOuterHighland = new THREE.Color('#2f5528');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    const { dist, roadY } = queryNearestTrack(vx, vz);

    // Gentle Javanese highland undulation
    const hillWave =
      Math.sin(vx * 0.011 + 0.4) * Math.cos(vz * 0.013 - 0.2) * 3.8 +
      Math.sin((vx + vz) * 0.023) * 1.4;

    let vy: number;
    if (dist <= 11.0) {
      // Strictly clamped at least 0.35m below road elevation inside road + barrier corridor
      vy = roadY - 0.35;
      tmpColor.copy(cRoadShoulder);
    } else if (dist <= 15.0) {
      // Buffer zone: still strictly clamped <= roadY - 0.20m to prevent any diagonal triangle clipping
      const blend = smoothstep(11.0, 15.0, dist);
      const targetSlope = roadY + Math.max(-1.2, hillWave * 0.15) - 0.25;
      vy = Math.min(roadY - 0.2, THREE.MathUtils.lerp(roadY - 0.35, targetSlope, blend));
      tmpColor.copy(cRoadShoulder).lerp(cMidGrass, blend);
    } else if (dist <= 95.0) {
      // Gentle highland slopes strictly within 6m-95m of active track (onlyAlongActiveTrack / preventOffTrackSprawl)
      const upRamp = smoothstep(15.0, 48.0, dist);
      const outFade = 1.0 - smoothstep(72.0, 95.0, dist);
      const slopeRelief = (2.6 + hillWave) * upRamp * outFade;
      const baseValley = THREE.MathUtils.lerp(roadY - 0.25, -2.8, smoothstep(55.0, 95.0, dist));
      vy = baseValley + slopeRelief;
      tmpColor.copy(cMidGrass).lerp(cOuterHighland, smoothstep(25.0, 95.0, dist));
    } else {
      // Calm valley floor beyond 95m (prevents off-track sprawl)
      vy = -2.8 + hillWave * 0.25;
      tmpColor.copy(cOuterHighland);
    }

    posAttr.setY(i, vy);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  innerGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  innerGeo.computeVertexNormals();

  const grassTex = createTerrainGrassTexture();
  const innerMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const innerTerrain = new THREE.Mesh(innerGeo, innerMat);
  innerTerrain.receiveShadow = true;
  innerTerrain.castShadow = false;
  terrainGroup.add(innerTerrain);

  // Seamless outer horizon valley skirt so outdoor terrain extends into horizon fog without floating void edges
  const outerSize = 18000;
  const outerGeo = new THREE.PlaneGeometry(outerSize, outerSize, 96, 96);
  outerGeo.rotateX(-Math.PI / 2);
  outerGeo.translate((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5);
  const outerPos = outerGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < outerPos.count; i++) {
    const vx = outerPos.getX(i);
    const vz = outerPos.getZ(i);
    const insideInner = vx >= x0 + 25 && vx <= x1 - 25 && vz >= z0 + 25 && vz <= z1 - 25;
    if (insideInner) {
      // Depress strictly beneath inner terrain footprint so there is zero overlap/clipping
      outerPos.setY(i, -24);
    } else {
      const distFromBox = Math.hypot(
        Math.max(0, x0 - vx, vx - x1),
        Math.max(0, z0 - vz, vz - z1),
      );
      const gentleOuter =
        -3.2 +
        smoothstep(80, 1200, distFromBox) *
          (Math.sin(vx * 0.0018) * Math.cos(vz * 0.0016) * 14);
      outerPos.setY(i, gentleOuter);
    }
  }
  outerGeo.computeVertexNormals();
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x335a2b,
    roughness: 0.95,
    metalness: 0.0,
  });
  const outerSkirt = new THREE.Mesh(outerGeo, outerMat);
  outerSkirt.receiveShadow = false;
  terrainGroup.add(outerSkirt);

  return terrainGroup;
}

/**
 * Builds stylized Mount Merbabu volcanic massif backdrop strictly > 3,200m from route perimeter.
 */
function buildMountMerbabuBackdrop(
  minX: number,
  maxX: number,
  maxZ: number,
): THREE.Group {
  const merbabuGroup = new THREE.Group();
  merbabuGroup.name = 'MountMerbabuBackdrop';

  // Position Mount Merbabu South-Southwest of Salatiga, with base radius 1,450m
  // and center at maxZ + 4,950m => closest skirt edge is > 3,450m from route perimeter (> 3,200m).
  const centerX = (minX + maxX) * 0.5 - 950;
  const centerZ = maxZ + 4950;
  merbabuGroup.position.set(centerX, -4, centerZ);

  const radialSegs = 72;
  const heightSegs = 28;
  const baseRadius = 1450;
  const peakHeight = 1480;

  const geo = new THREE.ConeGeometry(baseRadius, peakHeight, radialSegs, heightSegs, true);
  geo.translate(0, peakHeight * 0.5, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color('#2d522a');
  const cMid = new THREE.Color('#3f5b3a');
  const cUpper = new THREE.Color('#5a6772');
  const cPeak = new THREE.Color('#7a8793');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hNorm = Math.max(0, Math.min(1, y / peakHeight));
    const angle = Math.atan2(z, x);

    // Sculpt volcanic radial ridges & gullies + classic Merbabu twin-summit saddle profile
    const ridge1 = Math.sin(angle * 7.0 + 0.6) * 0.14;
    const ridge2 = Math.cos(angle * 13.0 - 1.1) * 0.06;
    const radialScale = 1.0 + (ridge1 + ridge2) * (1.0 - hNorm * 0.65);

    x *= radialScale;
    z *= radialScale;

    // Soften summit into an asymmetric volcanic caldera rim
    if (hNorm > 0.86) {
      const craterBlend = (hNorm - 0.86) / 0.14;
      const saddleDip = Math.cos(angle * 2.0 + 0.4) * 55 * craterBlend;
      y -= craterBlend * 48 + saddleDip;
    }

    // Concave volcanic stratovolcano profile
    const curveDrop = Math.sin(hNorm * Math.PI) * 75;
    y = Math.max(0, y - curveDrop * 0.45);

    pos.setXYZ(i, x, y, z);

    if (hNorm < 0.35) {
      tmp.copy(cBase).lerp(cMid, hNorm / 0.35);
    } else if (hNorm < 0.72) {
      tmp.copy(cMid).lerp(cUpper, (hNorm - 0.35) / 0.37);
    } else {
      tmp.copy(cUpper).lerp(cPeak, (hNorm - 0.72) / 0.28);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: false,
  });

  const mainCone = new THREE.Mesh(geo, mat);
  merbabuGroup.add(mainCone);

  // Flanking western foothill ridge (also strictly > 3,200m from route)
  const ridgeGeo = new THREE.ConeGeometry(920, 840, 48, 16, true);
  ridgeGeo.translate(-1150, 410, 420);
  const rPos = ridgeGeo.attributes.position as THREE.BufferAttribute;
  const rCols = new Float32Array(rPos.count * 3);
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const ry = rPos.getY(i);
    const rz = rPos.getZ(i);
    const hn = Math.max(0, Math.min(1, ry / 840));
    const ang = Math.atan2(rz - 420, rx + 1150);
    const undul = 1 + Math.sin(ang * 5) * 0.12 * (1 - hn * 0.5);
    rPos.setX(i, -1150 + (rx + 1150) * undul);
    rPos.setZ(i, 420 + (rz - 420) * undul);
    tmp.copy(cBase).lerp(cUpper, hn * 0.75);
    rCols[i * 3] = tmp.r;
    rCols[i * 3 + 1] = tmp.g;
    rCols[i * 3 + 2] = tmp.b;
  }
  ridgeGeo.setAttribute('color', new THREE.BufferAttribute(rCols, 3));
  ridgeGeo.computeVertexNormals();
  merbabuGroup.add(new THREE.Mesh(ridgeGeo, mat));

  return merbabuGroup;
}

export function buildSalatigaTrack(routeGeoJson: SalatigaGeoJson): SalatigaTrackBuildResult {
  const feature = routeGeoJson?.features?.[0];
  const rawCoords = feature?.geometry?.coordinates;
  if (!rawCoords || rawCoords.length < 2) {
    throw new Error('Invalid Salatiga GeoJSON: missing features[0].geometry.coordinates');
  }

  // Project exact [lon, lat, elev] GPS coordinates without altering, simplifying, or inventing points
  const worldPoints: THREE.Vector3[] = rawCoords.map(([lon, lat, elev]) =>
    gpsToWorld(lon, lat, elev ?? SALATIGA_TRACK_CONFIG.originElev),
  );

  const trackCurve = new THREE.CatmullRomCurve3(worldPoints, false, 'centripetal');
  trackCurve.arcLengthDivisions = 2400;
  const trackLengthMeters = trackCurve.getLength();

  // Sample densely (~1 segment per 2 meters)
  const segmentCount = Math.max(600, Math.round(trackLengthMeters / 2));
  const samples: TrackSample[] = [];
  const lastHoriz = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i <= segmentCount; i++) {
    const u = i / segmentCount;
    const position = trackCurve.getPointAt(u);
    const tangent = trackCurve.getTangentAt(u);
    const horizForward = new THREE.Vector3(tangent.x, 0, tangent.z);
    if (horizForward.lengthSq() > 1e-8) {
      horizForward.normalize();
      lastHoriz.copy(horizForward);
    } else {
      horizForward.copy(lastHoriz);
    }
    const right = new THREE.Vector3().crossVectors(horizForward, WORLD_UP).normalize();

    samples.push({
      u,
      distanceMeters: u * trackLengthMeters,
      position,
      tangent,
      horizForward,
      right,
    });
  }

  // Compute circuit world bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    if (s.position.x < minX) minX = s.position.x;
    if (s.position.x > maxX) maxX = s.position.x;
    if (s.position.z < minZ) minZ = s.position.z;
    if (s.position.z > maxZ) maxZ = s.position.z;
  }

  const group = new THREE.Group();
  group.name = 'SalatigaCircuitGroup';

  const { roadWidthMeters, kerbWidthMeters, barrierOffsetMeters } = SALATIGA_TRACK_CONFIG;
  const roadHalf = roadWidthMeters * 0.5;

  // 1. Dark Textured Asphalt Ribbon (14m wide)
  const asphaltTex = createAsphaltTexture();
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.78,
    metalness: 0.05,
  });
  const roadGeo = buildHorizontalRibbonGeometry(samples, -roadHalf, roadHalf, 0, 0, 16);
  const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
  roadMesh.name = 'AsphaltRoad';
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2. Alternating Red/White FIA Kerbs (1.2m wide along both edges)
  const kerbTex = createKerbTexture();
  const kerbMat = new THREE.MeshStandardMaterial({
    map: kerbTex,
    roughness: 0.65,
    metalness: 0.05,
  });
  const leftKerbGeo = buildHorizontalRibbonGeometry(
    samples,
    -(roadHalf + kerbWidthMeters),
    -roadHalf,
    0.04,
    0.012,
    2.4,
  );
  const rightKerbGeo = buildHorizontalRibbonGeometry(
    samples,
    roadHalf,
    roadHalf + kerbWidthMeters,
    0.012,
    0.04,
    2.4,
  );
  const leftKerb = new THREE.Mesh(leftKerbGeo, kerbMat);
  leftKerb.receiveShadow = true;
  const rightKerb = new THREE.Mesh(rightKerbGeo, kerbMat);
  rightKerb.receiveShadow = true;
  group.add(leftKerb, rightKerb);

  // Subtle concrete shoulder apron dropping from outer kerb into clamped terrain so zero gaps appear
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    roughness: 0.9,
    metalness: 0.05,
  });
  const leftShoulderGeo = buildHorizontalRibbonGeometry(
    samples,
    -(roadHalf + kerbWidthMeters + 0.5),
    -(roadHalf + kerbWidthMeters),
    -0.38,
    0.04,
    8,
  );
  const rightShoulderGeo = buildHorizontalRibbonGeometry(
    samples,
    roadHalf + kerbWidthMeters,
    roadHalf + kerbWidthMeters + 0.5,
    0.04,
    -0.38,
    8,
  );
  group.add(
    new THREE.Mesh(leftShoulderGeo, shoulderMat),
    new THREE.Mesh(rightShoulderGeo, shoulderMat),
  );

  // 3. Metallic Armco Guardrails at ±8.2m + InstancedMesh Steel Posts
  const armcoMat = new THREE.MeshStandardMaterial({
    color: 0xc2cbd4,
    metalness: 0.8,
    roughness: 0.32,
  });
  const leftBarrierGeo = buildArmcoBarrierGeometry(samples, -barrierOffsetMeters);
  const rightBarrierGeo = buildArmcoBarrierGeometry(samples, barrierOffsetMeters);
  const leftBarrier = new THREE.Mesh(leftBarrierGeo, armcoMat);
  leftBarrier.castShadow = true;
  leftBarrier.receiveShadow = true;
  const rightBarrier = new THREE.Mesh(rightBarrierGeo, armcoMat);
  rightBarrier.castShadow = true;
  rightBarrier.receiveShadow = true;
  group.add(leftBarrier, rightBarrier);

  // Instanced steel guardrail posts every ~4m (2 segments)
  const postStep = 2;
  const postSampleCount = Math.floor(samples.length / postStep);
  const postCount = postSampleCount * 2;
  const postGeo = new THREE.BoxGeometry(0.1, 0.96, 0.14);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x6b7480,
    metalness: 0.72,
    roughness: 0.42,
  });
  const postInstanced = new THREE.InstancedMesh(postGeo, postMat, postCount);
  postInstanced.castShadow = true;
  postInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  let instanceIdx = 0;
  for (let i = 0; i < postSampleCount; i++) {
    const s = samples[i * postStep];
    const yaw = Math.atan2(s.horizForward.x, s.horizForward.z);
    for (const side of [-1, 1]) {
      const off = side * (barrierOffsetMeters + 0.11);
      dummy.position.set(
        s.position.x + s.right.x * off,
        s.position.y + 0.34,
        s.position.z + s.right.z * off,
      );
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      postInstanced.setMatrixAt(instanceIdx++, dummy.matrix);
    }
  }
  postInstanced.instanceMatrix.needsUpdate = true;
  postInstanced.computeBoundingSphere();
  group.add(postInstanced);

  // 4. Start/Finish Gantry Arch at Bundaran Tamansari (t = 0)
  const gantry = buildStartFinishGantry(samples[0]);
  group.add(gantry);

  // 5. Continuous Highland Terrain (with Zero-Clipping Guarantee)
  const terrainGroup = buildHighlandTerrain(samples, minX, maxX, minZ, maxZ);
  group.add(terrainGroup);

  // 6. Stylized Mount Merbabu Backdrop (> 3,200m from route perimeter)
  const merbabu = buildMountMerbabuBackdrop(minX, maxX, maxZ);
  group.add(merbabu);

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

  return {
    group,
    trackCurve,
    trackLengthMeters,
    samples,
    dispose,
  };
}
