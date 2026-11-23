import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  leftBarrierValid: boolean;
  rightBarrierValid: boolean;
}

export interface TrackClosestQueryResult {
  segIndex: number;
  t: number;
  distSq: number;
  distanceMeters: number;
  lateralOffset: number;
  roadY: number;
  projX: number;
  projZ: number;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
}

export interface SalatigaTrackBuildResult {
  group: THREE.Group;
  trackCurve: THREE.CatmullRomCurve3;
  trackLengthMeters: number;
  samples: TrackSample[];
  queryClosestTrack: (
    px: number,
    pz: number,
    out?: TrackClosestQueryResult,
  ) => TrackClosestQueryResult;
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

function createRoadSurfaceAtlasTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt fill across left 74% (u: 0.00..0.74)
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, Math.round(width * 0.74), height);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const asphaltW = Math.round(width * 0.72);
  for (let i = 0; i < 16000; i++) {
    const px = rand() * asphaltW;
    const py = rand() * height;
    const v = 26 + Math.floor(rand() * 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(px, py, 2, 2);
  }

  // Subtle tire rubber wear tracks in both lanes
  const leftLane = ctx.createLinearGradient(asphaltW * 0.16, 0, asphaltW * 0.42, 0);
  leftLane.addColorStop(0, 'rgba(12,14,17,0)');
  leftLane.addColorStop(0.5, 'rgba(12,14,17,0.22)');
  leftLane.addColorStop(1, 'rgba(12,14,17,0)');
  ctx.fillStyle = leftLane;
  ctx.fillRect(asphaltW * 0.16, 0, asphaltW * 0.26, height);

  const rightLane = ctx.createLinearGradient(asphaltW * 0.58, 0, asphaltW * 0.84, 0);
  rightLane.addColorStop(0, 'rgba(12,14,17,0)');
  rightLane.addColorStop(0.5, 'rgba(12,14,17,0.22)');
  rightLane.addColorStop(1, 'rgba(12,14,17,0)');
  ctx.fillStyle = rightLane;
  ctx.fillRect(asphaltW * 0.58, 0, asphaltW * 0.26, height);

  // Middle band (u: 0.74..0.92): Alternating FIA red & white kerb blocks
  const kerbX = Math.round(width * 0.74);
  const kerbW = Math.round(width * 0.18);
  ctx.fillStyle = '#d92626';
  ctx.fillRect(kerbX, 0, kerbW, height / 2);
  ctx.fillStyle = '#f4f4f6';
  ctx.fillRect(kerbX, height / 2, kerbW, height / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(kerbX, 0, 4, height);
  ctx.fillRect(kerbX, height / 2 - 2, kerbW, 3);

  // Right band (u: 0.92..1.00): Dark concrete shoulder apron
  const shX = Math.round(width * 0.92);
  ctx.fillStyle = '#3b4046';
  ctx.fillRect(shX, 0, width - shX, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}

function createGantryAtlasTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Top half (y: 0..160 -> v: 0.5..1.0): Start/Finish gantry banner
  const halfH = height / 2;
  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, width, halfH);

  const sq = 20;
  for (let r = 0; r < halfH / sq; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f4f4f5' : '#18181b';
      ctx.fillRect(c * sq, r * sq, sq, sq);
      ctx.fillRect(width - (c + 1) * sq, r * sq, sq, sq);
    }
  }
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(120, 0, width - 240, 12);
  ctx.fillRect(120, halfH - 12, width - 240, 12);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 48px "Oxanium", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SALATIGA · TAMANSARI 5KM', width / 2, halfH / 2 + 2);

  // Bottom half (y: 160..320 -> v: 0.0..0.5): Checkered start/finish asphalt line
  const cols = 16;
  const rows = 4;
  const cw = width / cols;
  const ch = halfH / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f4f4f5' : '#18181b';
      ctx.fillRect(c * cw, halfH + r * ch, cw, ch);
    }
  }

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
 * Optional validMask omits segments cleanly without bridging across gaps, and
 * optional yBiasArray applies deterministic vertical separation at overlapping junctions.
 */
function buildHorizontalRibbonGeometry(
  samples: TrackSample[],
  offsetLeft: number,
  offsetRight: number,
  yOffsetLeft: number,
  yOffsetRight: number,
  uvTileLengthMeters: number,
  validMask?: boolean[],
  yBiasArray?: Float32Array,
  uMin = 0,
  uMax = 1,
): THREE.BufferGeometry {
  const count = samples.length;
  const positions = new Float32Array(count * 2 * 3);
  const normals = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const indicesArr: number[] = [];

  const surfaceNormal = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const s = samples[i];
    const v = s.distanceMeters / uvTileLengthMeters;
    const yBias = yBiasArray ? yBiasArray[i] : 0;

    // Left edge vertex (offsetLeft along right vector)
    const lx = s.position.x + s.right.x * offsetLeft;
    const ly = s.position.y + yOffsetLeft + yBias;
    const lz = s.position.z + s.right.z * offsetLeft;

    // Right edge vertex (offsetRight along right vector)
    const rx = s.position.x + s.right.x * offsetRight;
    const ry = s.position.y + yOffsetRight + yBias;
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

    uvs[vi * 2] = uMin;
    uvs[vi * 2 + 1] = v;
    uvs[(vi + 1) * 2] = uMax;
    uvs[(vi + 1) * 2 + 1] = v;

    if (i < count - 1) {
      if (!validMask || (validMask[i] && validMask[i + 1])) {
        const a = vi;
        const b = vi + 1;
        const c = vi + 2;
        const d = vi + 3;
        indicesArr.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indicesArr), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds a vertical Armco W-beam guardrail ribbon along one side of the track.
 * Respects validMask so segments entering other road lanes are cleanly omitted
 * without stretched triangles across gaps.
 */
function buildArmcoBarrierGeometry(
  samples: TrackSample[],
  lateralOffset: number,
  validMask?: boolean[],
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
  const indicesArr: number[] = [];

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
      if (!validMask || (validMask[i] && validMask[i + 1])) {
        for (let p = 0; p < ringPts - 1; p++) {
          const a = i * ringPts + p;
          const b = i * ringPts + p + 1;
          const c = (i + 1) * ringPts + p;
          const d = (i + 1) * ringPts + p + 1;
          if (sign > 0) {
            indicesArr.push(a, b, c, b, d, c);
          } else {
            indicesArr.push(a, c, b, b, c, d);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indicesArr), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds feathered solid white edge lines along cleared left/right track boundaries.
 * Smoothly tapers vertex alpha at junction openings so asphalt merges without harsh white-line cross-cuts.
 */
function buildFeatheredEdgeLinesGeometry(
  samples: TrackSample[],
  roadHalf: number,
  leftValidMask: boolean[],
  rightValidMask: boolean[],
  yBiasArray: Float32Array,
): THREE.BufferGeometry {
  const count = samples.length;
  const lineWidth = 0.22;
  const edgeInset = 0.36;
  const fadeSamples = 3;

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const surfaceNormal = new THREE.Vector3();

  const computeMaskAlpha = (mask: boolean[], idx: number, fadeAtTrackEnd: boolean): number => {
    if (!mask[idx]) return 0;
    let distToGap = 999;
    for (let d = 1; d <= fadeSamples; d++) {
      if (idx - d >= 0 && !mask[idx - d]) {
        distToGap = Math.min(distToGap, d - 1);
      }
      if (idx + d < count && !mask[idx + d]) {
        distToGap = Math.min(distToGap, d - 1);
      }
    }
    if (fadeAtTrackEnd && idx >= count - 1 - fadeSamples) {
      distToGap = Math.min(distToGap, count - 1 - idx);
    }
    if (distToGap >= fadeSamples) return 0.92;
    return (distToGap / fadeSamples) * 0.92;
  };

  const emitSide = (
    offsetInner: number,
    offsetOuter: number,
    mask: boolean[],
    fadeAtTrackEnd: boolean,
  ) => {
    const baseVert = positions.length / 3;
    const minOff = Math.min(offsetInner, offsetOuter);
    const maxOff = Math.max(offsetInner, offsetOuter);

    for (let i = 0; i < count; i++) {
      const s = samples[i];
      const y = s.position.y + 0.013 + yBiasArray[i];
      const alpha = computeMaskAlpha(mask, i, fadeAtTrackEnd);

      surfaceNormal.crossVectors(s.right, s.tangent).normalize();
      if (surfaceNormal.y < 0) surfaceNormal.negate();

      positions.push(
        s.position.x + s.right.x * minOff,
        y,
        s.position.z + s.right.z * minOff,
        s.position.x + s.right.x * maxOff,
        y,
        s.position.z + s.right.z * maxOff,
      );
      normals.push(
        surfaceNormal.x,
        surfaceNormal.y,
        surfaceNormal.z,
        surfaceNormal.x,
        surfaceNormal.y,
        surfaceNormal.z,
      );
      colors.push(0.91, 0.93, 0.95, alpha, 0.91, 0.93, 0.95, alpha);

      if (i < count - 1 && mask[i] && mask[i + 1]) {
        const a = baseVert + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
  };

  emitSide(-(roadHalf - edgeInset - lineWidth), -(roadHalf - edgeInset), leftValidMask, true);
  emitSide(roadHalf - edgeInset, roadHalf - edgeInset - lineWidth, rightValidMask, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds dashed centerline markings that smoothly feather out before road merges and junctions
 * (such as the 4834m approach merge and Bundaran Tamansari roundabout).
 */
function buildFeatheredCenterDashGeometry(
  samples: TrackSample[],
  leftValidMask: boolean[],
  rightValidMask: boolean[],
  yBiasArray: Float32Array,
  trackLengthMeters: number,
): THREE.BufferGeometry {
  const halfWidth = 0.13;
  const dashPeriod = 12.0;
  const dashLen = 5.2;
  const fadeStartDist = 24.0;
  const fadeEndDist = trackLengthMeters - 135.0; // Cleanly fade out before 4834m merge & roundabout

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const surfaceNormal = new THREE.Vector3();

  for (let i = 0; i < samples.length - 1; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];
    const midS = (s0.distanceMeters + s1.distanceMeters) * 0.5;
    if (midS < fadeStartDist || midS > fadeEndDist) continue;
    if (!leftValidMask[i] || !rightValidMask[i] || !leftValidMask[i + 1] || !rightValidMask[i + 1]) {
      continue;
    }

    const phase = midS % dashPeriod;
    if (phase > dashLen) continue;

    let alpha = 0.9;
    if (midS < fadeStartDist + 14.0) {
      alpha *= (midS - fadeStartDist) / 14.0;
    }
    if (midS > fadeEndDist - 16.0) {
      alpha *= (fadeEndDist - midS) / 16.0;
    }
    alpha = Math.max(0, Math.min(0.9, alpha));
    if (alpha <= 0.02) continue;

    surfaceNormal.crossVectors(s0.right, s0.tangent).normalize();
    if (surfaceNormal.y < 0) surfaceNormal.negate();

    const y0 = s0.position.y + 0.013 + yBiasArray[i];
    const y1 = s1.position.y + 0.013 + yBiasArray[i + 1];
    const baseVert = positions.length / 3;

    positions.push(
      s0.position.x - s0.right.x * halfWidth,
      y0,
      s0.position.z - s0.right.z * halfWidth,
      s0.position.x + s0.right.x * halfWidth,
      y0,
      s0.position.z + s0.right.z * halfWidth,
      s1.position.x - s1.right.x * halfWidth,
      y1,
      s1.position.z - s1.right.z * halfWidth,
      s1.position.x + s1.right.x * halfWidth,
      y1,
      s1.position.z + s1.right.z * halfWidth,
    );
    for (let v = 0; v < 4; v++) {
      normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      colors.push(0.94, 0.96, 0.98, alpha);
    }
    indices.push(baseVert, baseVert + 1, baseVert + 2, baseVert + 1, baseVert + 3, baseVert + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function stampVertexColorAndTransform(
  geo: THREE.BufferGeometry,
  hex: string,
  px = 0,
  py = 0,
  pz = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  if (px !== 0 || py !== 0 || pz !== 0 || ry !== 0 || rz !== 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, 'XYZ')),
      new THREE.Vector3(1, 1, 1),
    );
    geo.applyMatrix4(m);
  }
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const count = geo.attributes.position.count;
  const cols = new Float32Array(count * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < count; i++) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}

function remapUvSubRect(
  geo: THREE.BufferGeometry,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): THREE.BufferGeometry {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const du = u1 - u0;
  const dv = v1 - v0;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
  }
  uv.needsUpdate = true;
  return geo;
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

  const xOuter = 9.2;
  const structureParts: THREE.BufferGeometry[] = [
    stampVertexColorAndTransform(new THREE.BoxGeometry(1.4, 1.0, 1.6), '#6b7280', xOuter, 0.1, 0),
    stampVertexColorAndTransform(new THREE.BoxGeometry(0.56, 6.4, 0.72), '#222730', xOuter, 3.2, 0),
    stampVertexColorAndTransform(new THREE.BoxGeometry(0.28, 4.6, 0.34), '#222730', xOuter - 1.55, 4.45, 0, 0, -0.68),
    stampVertexColorAndTransform(new THREE.BoxGeometry(17.1, 0.55, 0.7), '#222730', 0.95, 6.1, 0),
    stampVertexColorAndTransform(new THREE.BoxGeometry(3.4, 0.44, 0.28), '#222730', 0, 4.45, 0.18),
  ];
  for (let i = 0; i < 5; i++) {
    const lensGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12);
    lensGeo.rotateX(Math.PI / 2);
    structureParts.push(
      stampVertexColorAndTransform(lensGeo, '#ef4444', (i - 2) * 0.62, 4.45, 0.34),
    );
  }
  const mergedStructure = mergeGeometries(structureParts, false)!;
  structureParts.forEach((g) => g.dispose());

  const structureMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.68,
    roughness: 0.38,
  });
  const structureMesh = new THREE.Mesh(mergedStructure, structureMat);
  structureMesh.castShadow = true;
  structureMesh.receiveShadow = true;
  gantry.add(structureMesh);

  // Merge dual-sided gantry banner + checkered finish line using 1 combined atlas texture (1 draw call)
  const gantryTex = createGantryAtlasTexture();
  const gantrySignMat = new THREE.MeshStandardMaterial({
    map: gantryTex,
    roughness: 0.55,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const bannerGeo = remapUvSubRect(new THREE.BoxGeometry(15.2, 1.35, 0.18), 0.01, 0.52, 0.99, 0.99);
  bannerGeo.translate(0, 5.45, 0);

  const lineGeo = remapUvSubRect(new THREE.PlaneGeometry(13.2, 1.8), 0.01, 0.01, 0.99, 0.48);
  lineGeo.rotateX(-Math.PI / 2);
  lineGeo.translate(0, 0.04, 0);

  const mergedSignGeo = mergeGeometries([bannerGeo, lineGeo], false)!;
  bannerGeo.dispose();
  lineGeo.dispose();

  const gantrySignMesh = new THREE.Mesh(mergedSignGeo, gantrySignMat);
  gantrySignMesh.receiveShadow = true;
  gantry.add(gantrySignMesh);

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

  function queryNearestTrack(
    vx: number,
    vz: number,
  ): { dist: number; roadY: number; s: number; lateralOffset: number } {
    const cx = Math.floor(vx / cellSize);
    const cz = Math.floor(vz / cellSize);
    const radiusCells = 4; // +/-128m coverage (comfortably covers 95m slope zone)
    let bestDistSq = Infinity;
    let bestY = 0;
    let bestS = 0;
    let bestLat = 0;
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
            bestS = THREE.MathUtils.lerp(samples[segIdx].distanceMeters, samples[segIdx + 1].distanceMeters, t);
            const r = samples[segIdx].right;
            bestLat = (vx - projX) * r.x + (vz - projZ) * r.z;
          }
        }
      }
    }

    return {
      dist: bestDistSq < Infinity ? Math.sqrt(bestDistSq) : Infinity,
      roadY: bestY,
      s: bestS,
      lateralOffset: bestLat,
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
  const cUrbanConcrete = new THREE.Color('#5a5f66');
  const cMidGrass = new THREE.Color('#3c6831');
  const cOuterHighland = new THREE.Color('#2f5528');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    const { dist, roadY, s, lateralOffset } = queryNearestTrack(vx, vz);

    // Gentle Javanese highland undulation
    const hillWave =
      Math.sin(vx * 0.011 + 0.4) * Math.cos(vz * 0.013 - 0.2) * 3.8 +
      Math.sin((vx + vz) * 0.023) * 1.4;

    // Urban commercial corridor along Jl. Jend. Sudirman east side (s = 50..430m, lateralOffset < 0)
    const inEastUrbanPad = s >= 50.0 && s <= 430.0 && lateralOffset < 0;

    let vy: number;
    if (dist <= 11.0) {
      // Strictly clamped at least 0.35m below road elevation inside road + barrier corridor
      vy = roadY - 0.35;
      tmpColor.copy(cRoadShoulder);
    } else if (inEastUrbanPad && dist <= 58.0) {
      // Flattened urban sidewalk & market plaza pad strictly below road/apron elevation (eliminates green hill gaps)
      vy = roadY - 0.35;
      tmpColor.copy(cUrbanConcrete);
    } else if (inEastUrbanPad && dist <= 80.0) {
      const blend = smoothstep(58.0, 80.0, dist);
      const targetValley = THREE.MathUtils.lerp(roadY - 0.3, -2.8, blend);
      vy = targetValley + hillWave * 0.2 * blend;
      tmpColor.copy(cUrbanConcrete).lerp(cOuterHighland, blend);
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

  // Merge outer horizon valley skirt + Mount Merbabu massif into 1 draw call
  const outerSize = 18000;
  const outerGeo = new THREE.PlaneGeometry(outerSize, outerSize, 96, 96);
  outerGeo.rotateX(-Math.PI / 2);
  outerGeo.translate((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5);
  const outerPos = outerGeo.attributes.position as THREE.BufferAttribute;
  const outerCols = new Float32Array(outerPos.count * 3);
  const cSkirt = new THREE.Color(0x335a2b);
  for (let i = 0; i < outerPos.count; i++) {
    const vx = outerPos.getX(i);
    const vz = outerPos.getZ(i);
    const insideInner = vx >= x0 + 25 && vx <= x1 - 25 && vz >= z0 + 25 && vz <= z1 - 25;
    if (insideInner) {
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
    outerCols[i * 3] = cSkirt.r;
    outerCols[i * 3 + 1] = cSkirt.g;
    outerCols[i * 3 + 2] = cSkirt.b;
  }
  outerGeo.setAttribute('color', new THREE.BufferAttribute(outerCols, 3));
  outerGeo.computeVertexNormals();
  if (outerGeo.attributes.uv) outerGeo.deleteAttribute('uv');

  const merbabuCenterX = (minX + maxX) * 0.5 - 950;
  const merbabuCenterZ = maxZ + 4950;
  const radialSegs = 72;
  const heightSegs = 28;
  const baseRadius = 1450;
  const peakHeight = 1480;

  const mainConeGeo = new THREE.ConeGeometry(baseRadius, peakHeight, radialSegs, heightSegs, true);
  mainConeGeo.translate(0, peakHeight * 0.5, 0);
  const mPos = mainConeGeo.attributes.position as THREE.BufferAttribute;
  const mCols = new Float32Array(mPos.count * 3);
  const cBase = new THREE.Color('#2d522a');
  const cMid = new THREE.Color('#3f5b3a');
  const cUpper = new THREE.Color('#5a6772');
  const cPeak = new THREE.Color('#7a8793');
  const tmp = new THREE.Color();

  for (let i = 0; i < mPos.count; i++) {
    let x = mPos.getX(i);
    let y = mPos.getY(i);
    let z = mPos.getZ(i);
    const hNorm = Math.max(0, Math.min(1, y / peakHeight));
    const angle = Math.atan2(z, x);
    const ridge1 = Math.sin(angle * 7.0 + 0.6) * 0.14;
    const ridge2 = Math.cos(angle * 13.0 - 1.1) * 0.06;
    const radialScale = 1.0 + (ridge1 + ridge2) * (1.0 - hNorm * 0.65);
    x *= radialScale;
    z *= radialScale;
    if (hNorm > 0.86) {
      const craterBlend = (hNorm - 0.86) / 0.14;
      const saddleDip = Math.cos(angle * 2.0 + 0.4) * 55 * craterBlend;
      y -= craterBlend * 48 + saddleDip;
    }
    const curveDrop = Math.sin(hNorm * Math.PI) * 75;
    y = Math.max(0, y - curveDrop * 0.45);
    mPos.setXYZ(i, x, y, z);

    if (hNorm < 0.35) tmp.copy(cBase).lerp(cMid, hNorm / 0.35);
    else if (hNorm < 0.72) tmp.copy(cMid).lerp(cUpper, (hNorm - 0.35) / 0.37);
    else tmp.copy(cUpper).lerp(cPeak, (hNorm - 0.72) / 0.28);
    mCols[i * 3] = tmp.r;
    mCols[i * 3 + 1] = tmp.g;
    mCols[i * 3 + 2] = tmp.b;
  }
  mainConeGeo.setAttribute('color', new THREE.BufferAttribute(mCols, 3));
  mainConeGeo.computeVertexNormals();
  mainConeGeo.translate(merbabuCenterX, -4, merbabuCenterZ);
  if (mainConeGeo.attributes.uv) mainConeGeo.deleteAttribute('uv');

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
  ridgeGeo.translate(merbabuCenterX, -4, merbabuCenterZ);
  if (ridgeGeo.attributes.uv) ridgeGeo.deleteAttribute('uv');

  const horizonMergedGeo = mergeGeometries([outerGeo, mainConeGeo, ridgeGeo], false)!;
  outerGeo.dispose();
  mainConeGeo.dispose();
  ridgeGeo.dispose();

  const horizonMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.01,
  });
  const horizonMesh = new THREE.Mesh(horizonMergedGeo, horizonMat);
  horizonMesh.name = 'HorizonAndMountMerbabu';
  horizonMesh.receiveShadow = false;
  horizonMesh.castShadow = false;
  terrainGroup.add(horizonMesh);

  return terrainGroup;
}

export function buildSalatigaTrack(routeGeoJson: SalatigaGeoJson): SalatigaTrackBuildResult {
  const feature = routeGeoJson?.features?.[0];
  const rawCoords = feature?.geometry?.coordinates;
  if (!rawCoords || rawCoords.length < 2) {
    throw new Error('Invalid Salatiga GeoJSON: missing features[0].geometry.coordinates');
  }

  // Project exact [lon, lat, elev] GPS coordinates, prune GPS spikes/collinear micro-steps,
  // and apply 2D circular arc filleting (R = 18m) to all corners sharper than 22 deg.
  const rawWorldPoints: THREE.Vector3[] = rawCoords.map(([lon, lat, elev]) =>
    gpsToWorld(lon, lat, elev ?? SALATIGA_TRACK_CONFIG.originElev),
  );

  // 1. Deduplicate near-coincident GPS points (< 3.5m), pinning Start and End
  const dedupPoints: THREE.Vector3[] = [rawWorldPoints[0].clone()];
  for (let i = 1; i < rawWorldPoints.length - 1; i++) {
    if (rawWorldPoints[i].distanceTo(dedupPoints[dedupPoints.length - 1]) >= 3.5) {
      dedupPoints.push(rawWorldPoints[i].clone());
    }
  }
  dedupPoints.push(rawWorldPoints[rawWorldPoints.length - 1].clone());

  // 2. Remove 180-deg out-and-back GPS reversal spikes (2 passes)
  let spikeCleaned = dedupPoints;
  for (let pass = 0; pass < 2; pass++) {
    const next: THREE.Vector3[] = [spikeCleaned[0].clone()];
    for (let i = 1; i < spikeCleaned.length - 1; i++) {
      const a = next[next.length - 1];
      const b = spikeCleaned[i];
      const c = spikeCleaned[i + 1];
      const v1x = b.x - a.x;
      const v1z = b.z - a.z;
      const v2x = c.x - b.x;
      const v2z = c.z - b.z;
      const l1 = Math.hypot(v1x, v1z);
      const l2 = Math.hypot(v2x, v2z);
      if (l1 > 1e-3 && l2 > 1e-3) {
        const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
        if (dot < -0.766 && Math.min(l1, l2) < 20.0) {
          continue;
        }
      }
      next.push(b.clone());
    }
    next.push(spikeCleaned[spikeCleaned.length - 1].clone());
    spikeCleaned = next;
  }

  // 3. Simplify near-collinear GPS breadcrumbs (< 8 deg bend & < 0.8m offset) so fillets have full tangent room
  const simplifiedPoints: THREE.Vector3[] = [spikeCleaned[0].clone()];
  for (let i = 1; i < spikeCleaned.length - 1; i++) {
    const a = simplifiedPoints[simplifiedPoints.length - 1];
    const b = spikeCleaned[i];
    const c = spikeCleaned[i + 1];
    const v1x = b.x - a.x;
    const v1z = b.z - a.z;
    const v2x = c.x - b.x;
    const v2z = c.z - b.z;
    const l1 = Math.hypot(v1x, v1z);
    const l2 = Math.hypot(v2x, v2z);
    const lac = Math.hypot(c.x - a.x, c.z - a.z);
    if (l1 > 1e-3 && l2 > 1e-3 && lac > 1e-3) {
      const dot = THREE.MathUtils.clamp((v1x * v2x + v1z * v2z) / (l1 * l2), -1, 1);
      const angDeg = (Math.acos(dot) * 180) / Math.PI;
      const perp = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / lac;
      if (angDeg < 8.0 && perp < 0.8) {
        continue;
      }
    }
    simplifiedPoints.push(b.clone());
  }
  simplifiedPoints.push(spikeCleaned[spikeCleaned.length - 1].clone());

  // 4. 2D Circular Arc-Fillet Corner Rounding (R = 18m for turns > 22 deg, pinning Start and End)
  const filletTargetRadius = 18.0;
  const simpCount = simplifiedPoints.length;
  const isFilletCorner = new Array<boolean>(simpCount).fill(false);
  const cornerTurnRads = new Float64Array(simpCount);
  const edgeLengths = new Float64Array(Math.max(1, simpCount - 1));

  for (let i = 0; i < simpCount - 1; i++) {
    edgeLengths[i] = Math.hypot(
      simplifiedPoints[i + 1].x - simplifiedPoints[i].x,
      simplifiedPoints[i + 1].z - simplifiedPoints[i].z,
    );
  }
  for (let i = 1; i < simpCount - 1; i++) {
    const a = simplifiedPoints[i - 1];
    const b = simplifiedPoints[i];
    const c = simplifiedPoints[i + 1];
    const l1 = edgeLengths[i - 1];
    const l2 = edgeLengths[i];
    if (l1 < 1e-3 || l2 < 1e-3) continue;
    const dot = THREE.MathUtils.clamp(
      ((b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)) / (l1 * l2),
      -1,
      1,
    );
    const turnRad = Math.acos(dot);
    cornerTurnRads[i] = turnRad;
    if ((turnRad * 180) / Math.PI > 22.0) {
      isFilletCorner[i] = true;
    }
  }

  const filletedPoints: THREE.Vector3[] = [simplifiedPoints[0].clone()];
  for (let i = 1; i < simpCount - 1; i++) {
    const a = simplifiedPoints[i - 1];
    const b = simplifiedPoints[i];
    const c = simplifiedPoints[i + 1];
    if (!isFilletCorner[i]) {
      filletedPoints.push(b.clone());
      continue;
    }

    const l1 = edgeLengths[i - 1];
    const l2 = edgeLengths[i];
    const maxCut1 = isFilletCorner[i - 1] ? l1 * 0.45 : l1 * 0.85;
    const maxCut2 = isFilletCorner[i + 1] ? l2 * 0.45 : l2 * 0.85;
    const tanHalf = Math.tan(cornerTurnRads[i] * 0.5);
    const tanDist = Math.min(filletTargetRadius * tanHalf, maxCut1, maxCut2);
    const actualR = tanHalf > 1e-5 ? tanDist / tanHalf : filletTargetRadius;

    const n1x = (b.x - a.x) / l1;
    const n1z = (b.z - a.z) / l1;
    const n2x = (c.x - b.x) / l2;
    const n2z = (c.z - b.z) / l2;

    const pStart = new THREE.Vector3(
      b.x - n1x * tanDist,
      b.y - (b.y - a.y) * (tanDist / l1),
      b.z - n1z * tanDist,
    );
    const pEnd = new THREE.Vector3(
      b.x + n2x * tanDist,
      b.y + (c.y - b.y) * (tanDist / l2),
      b.z + n2z * tanDist,
    );

    const cross = n1x * n2z - n1z * n2x;
    const turnSign = cross >= 0 ? 1 : -1;
    const inNormalX = -n1z * turnSign;
    const inNormalZ = n1x * turnSign;
    const centerX = pStart.x + inNormalX * actualR;
    const centerZ = pStart.z + inNormalZ * actualR;

    const startAng = Math.atan2(pStart.z - centerZ, pStart.x - centerX);
    const endAng = Math.atan2(pEnd.z - centerZ, pEnd.x - centerX);
    let deltaAng = endAng - startAng;
    if (turnSign > 0 && deltaAng < 0) deltaAng += Math.PI * 2;
    if (turnSign < 0 && deltaAng > 0) deltaAng -= Math.PI * 2;

    const arcSteps = Math.max(4, Math.ceil((Math.abs(deltaAng) * actualR) / 2.5));
    for (let step = 0; step <= arcSteps; step++) {
      const frac = step / arcSteps;
      const ang = startAng + deltaAng * frac;
      filletedPoints.push(
        new THREE.Vector3(
          centerX + Math.cos(ang) * actualR,
          THREE.MathUtils.lerp(pStart.y, pEnd.y, frac),
          centerZ + Math.sin(ang) * actualR,
        ),
      );
    }
  }
  filletedPoints.push(simplifiedPoints[simpCount - 1].clone());

  // 5. Dense uniform 1.0m resampling along centripetal spline so corners sweep smoothly without chord kinks
  const baseCurve = new THREE.CatmullRomCurve3(filletedPoints, false, 'centripetal');
  baseCurve.arcLengthDivisions = 3000;
  const baseLength = baseCurve.getLength();
  const uniformSampleCount = Math.max(1000, Math.ceil(baseLength));
  const uniformPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= uniformSampleCount; i++) {
    uniformPoints.push(baseCurve.getPointAt(i / uniformSampleCount));
  }

  const trackCurve = new THREE.CatmullRomCurve3(uniformPoints, false, 'centripetal');
  trackCurve.arcLengthDivisions = 3000;
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
      leftBarrierValid: true,
      rightBarrierValid: true,
    });
  }

  // Pre-sample dense centerline points every 1.0m along trackCurve for cross-lane junction clearance
  const denseCount = Math.max(1000, Math.ceil(trackLengthMeters));
  const denseSampleX = new Float64Array(denseCount + 1);
  const denseSampleZ = new Float64Array(denseCount + 1);
  const denseSampleS = new Float64Array(denseCount + 1);
  const denseCellSize = 32;
  const denseGrid = new Map<string, number[]>();

  for (let i = 0; i <= denseCount; i++) {
    const u = i / denseCount;
    const p = trackCurve.getPointAt(u);
    denseSampleX[i] = p.x;
    denseSampleZ[i] = p.z;
    denseSampleS[i] = u * trackLengthMeters;
    const cx = Math.floor(p.x / denseCellSize);
    const cz = Math.floor(p.z / denseCellSize);
    const key = `${cx},${cz}`;
    let bucket = denseGrid.get(key);
    if (!bucket) {
      bucket = [];
      denseGrid.set(key, bucket);
    }
    bucket.push(i);
  }

  const clearanceDistSq = 7.2 * 7.2;
  const minSplineSepMeters = 35.0;
  const isPointInsideOtherLane = (vx: number, vz: number, sMeters: number): boolean => {
    const cx = Math.floor(vx / denseCellSize);
    const cz = Math.floor(vz / denseCellSize);
    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      for (let dzCell = -1; dzCell <= 1; dzCell++) {
        const bucket = denseGrid.get(`${cx + dxCell},${cz + dzCell}`);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          if (Math.abs(sMeters - denseSampleS[idx]) <= minSplineSepMeters) continue;
          const dx = vx - denseSampleX[idx];
          const dz = vz - denseSampleZ[idx];
          if (dx * dx + dz * dz < clearanceDistSq) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Compute left & right kerb/barrier validity masks using ONLY true cross-lane overlap (> 35m spline sep)
  // so every arc-filleted corner maintains 100% continuous unbroken inner and outer kerbs & guardrails.
  const { roadWidthMeters, kerbWidthMeters, barrierOffsetMeters } = SALATIGA_TRACK_CONFIG;
  const kerbCenterOffset = roadWidthMeters * 0.5 + kerbWidthMeters * 0.5; // 7.6m
  const leftValidMask: boolean[] = new Array(samples.length);
  const rightValidMask: boolean[] = new Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];

    const lxKerb = s.position.x - s.right.x * kerbCenterOffset;
    const lzKerb = s.position.z - s.right.z * kerbCenterOffset;
    const lxBar = s.position.x - s.right.x * barrierOffsetMeters;
    const lzBar = s.position.z - s.right.z * barrierOffsetMeters;
    const leftOk =
      !isPointInsideOtherLane(lxKerb, lzKerb, s.distanceMeters) &&
      !isPointInsideOtherLane(lxBar, lzBar, s.distanceMeters);

    const rxKerb = s.position.x + s.right.x * kerbCenterOffset;
    const rzKerb = s.position.z + s.right.z * kerbCenterOffset;
    const rxBar = s.position.x + s.right.x * barrierOffsetMeters;
    const rzBar = s.position.z + s.right.z * barrierOffsetMeters;
    const rightOk =
      !isPointInsideOtherLane(rxKerb, rzKerb, s.distanceMeters) &&
      !isPointInsideOtherLane(rxBar, rzBar, s.distanceMeters);

    leftValidMask[i] = leftOk;
    rightValidMask[i] = rightOk;
  }

  // Purge short orphan barrier/kerb stubs (< 8.0m) so isolated fragments never appear inside junctions
  const purgeShortBarrierRuns = (mask: boolean[]) => {
    let idx = 0;
    while (idx < mask.length) {
      if (!mask[idx]) {
        idx++;
        continue;
      }
      let endIdx = idx;
      while (endIdx + 1 < mask.length && mask[endIdx + 1]) {
        endIdx++;
      }
      const runLengthMeters = samples[endIdx].distanceMeters - samples[idx].distanceMeters;
      if (runLengthMeters < 8.0) {
        for (let k = idx; k <= endIdx; k++) {
          mask[k] = false;
        }
      }
      idx = endIdx + 1;
    }
  };
  purgeShortBarrierRuns(leftValidMask);
  purgeShortBarrierRuns(rightValidMask);

  for (let i = 0; i < samples.length; i++) {
    samples[i].leftBarrierValid = leftValidMask[i];
    samples[i].rightBarrierValid = rightValidMask[i];
  }

  // Deterministic vertical separation on overlapping road asphalt ribbons (eliminates z-fighting at Bundaran Tamansari & U-turns)
  const roadYBias = new Float32Array(samples.length);
  const rawSecondPassBias = new Float32Array(samples.length);
  const overlapRoadDistSq = 15.5 * 15.5;
  const overlapMinSplineSep = 12.0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.distanceMeters <= 24) {
      // Smoothly lift start straight +1.4cm above crossing roundabout ribbon
      const fade = s.distanceMeters <= 16 ? 1 : 1 - (s.distanceMeters - 16) / 8;
      roadYBias[i] = 0.014 * fade;
      continue;
    }

    // Check if this later pass overlaps an earlier non-adjacent centerline (s_other < s - 12m)
    const cx = Math.floor(s.position.x / denseCellSize);
    const cz = Math.floor(s.position.z / denseCellSize);
    let overlapsEarlier = false;
    for (let dxCell = -1; dxCell <= 1 && !overlapsEarlier; dxCell++) {
      for (let dzCell = -1; dzCell <= 1 && !overlapsEarlier; dzCell++) {
        const bucket = denseGrid.get(`${cx + dxCell},${cz + dzCell}`);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          if (denseSampleS[idx] >= s.distanceMeters - overlapMinSplineSep) continue;
          const dx = s.position.x - denseSampleX[idx];
          const dz = s.position.z - denseSampleZ[idx];
          if (dx * dx + dz * dz < overlapRoadDistSq) {
            overlapsEarlier = true;
            break;
          }
        }
      }
    }
    if (overlapsEarlier) {
      rawSecondPassBias[i] = -0.014;
    }
  }

  // Smooth the -0.014m overlap bias over +-4 samples (~8m) so transitions are completely seamless
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].distanceMeters <= 24) continue;
    let minNeighborBias = 0;
    for (let d = -4; d <= 4; d++) {
      const ni = i + d;
      if (ni >= 0 && ni < samples.length && rawSecondPassBias[ni] < 0) {
        const weight = 1 - Math.abs(d) / 5;
        const b = rawSecondPassBias[ni] * weight;
        if (b < minNeighborBias) minNeighborBias = b;
      }
    }
    roadYBias[i] = minNeighborBias;
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

  const roadHalf = roadWidthMeters * 0.5;

  // 1. Merged Dark Asphalt + Red/White FIA Kerbs + Concrete Shoulders (1 draw call)
  const roadAtlasTex = createRoadSurfaceAtlasTexture();
  const roadAtlasMat = new THREE.MeshStandardMaterial({
    map: roadAtlasTex,
    roughness: 0.76,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadGeo = buildHorizontalRibbonGeometry(
    samples,
    -roadHalf,
    roadHalf,
    0,
    0,
    16,
    undefined,
    roadYBias,
    0.02,
    0.68,
  );
  const leftKerbGeo = buildHorizontalRibbonGeometry(
    samples,
    -(roadHalf + kerbWidthMeters),
    -roadHalf,
    0.04,
    0.012,
    2.4,
    leftValidMask,
    roadYBias,
    0.76,
    0.88,
  );
  const rightKerbGeo = buildHorizontalRibbonGeometry(
    samples,
    roadHalf,
    roadHalf + kerbWidthMeters,
    0.012,
    0.04,
    2.4,
    rightValidMask,
    roadYBias,
    0.76,
    0.88,
  );
  const leftShoulderGeo = buildHorizontalRibbonGeometry(
    samples,
    -(roadHalf + kerbWidthMeters + 0.5),
    -(roadHalf + kerbWidthMeters),
    -0.38,
    0.04,
    8,
    leftValidMask,
    undefined,
    0.94,
    0.98,
  );
  const rightShoulderGeo = buildHorizontalRibbonGeometry(
    samples,
    roadHalf + kerbWidthMeters,
    roadHalf + kerbWidthMeters + 0.5,
    0.04,
    -0.38,
    8,
    rightValidMask,
    undefined,
    0.94,
    0.98,
  );
  const mergedRoadGeo = mergeGeometries(
    [roadGeo, leftKerbGeo, rightKerbGeo, leftShoulderGeo, rightShoulderGeo],
    false,
  )!;
  roadGeo.dispose();
  leftKerbGeo.dispose();
  rightKerbGeo.dispose();
  leftShoulderGeo.dispose();
  rightShoulderGeo.dispose();

  const roadMesh = new THREE.Mesh(mergedRoadGeo, roadAtlasMat);
  roadMesh.name = 'AsphaltKerbsShoulders';
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2. Feathered edge white lines & dashed center line merged into 1 draw call
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const edgeLinesGeo = buildFeatheredEdgeLinesGeometry(
    samples,
    roadHalf,
    leftValidMask,
    rightValidMask,
    roadYBias,
  );
  const centerDashGeo = buildFeatheredCenterDashGeometry(
    samples,
    leftValidMask,
    rightValidMask,
    roadYBias,
    trackLengthMeters,
  );
  const markingGeos = [edgeLinesGeo, centerDashGeo].filter(
    (g) => g.attributes.position.count > 0 && (g.index?.count ?? 0) > 0,
  );
  const mergedMarkingsGeo =
    markingGeos.length > 1
      ? mergeGeometries(markingGeos, false)!
      : markingGeos[0] ?? edgeLinesGeo;
  if (markingGeos.length > 1) {
    edgeLinesGeo.dispose();
    centerDashGeo.dispose();
  }
  const markingsMesh = new THREE.Mesh(mergedMarkingsGeo, lineMat);
  markingsMesh.name = 'FeatheredRoadMarkings';
  markingsMesh.receiveShadow = true;
  group.add(markingsMesh);

  // 3. Merged Metallic Armco Guardrails + Steel Posts + Terminal End-Caps (1 draw call)
  const leftBarrierGeo = buildArmcoBarrierGeometry(samples, -barrierOffsetMeters, leftValidMask);
  const rightBarrierGeo = buildArmcoBarrierGeometry(samples, barrierOffsetMeters, rightValidMask);
  stampVertexColorAndTransform(leftBarrierGeo, '#c2cbd4');
  stampVertexColorAndTransform(rightBarrierGeo, '#c2cbd4');

  const postStep = 2;
  const basePostGeo = new THREE.BoxGeometry(0.1, 0.96, 0.14);
  const baseCapGeo = new THREE.BoxGeometry(0.11, 0.45, 0.16);
  const barrierParts: THREE.BufferGeometry[] = [leftBarrierGeo, rightBarrierGeo];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const yaw = Math.atan2(s.horizForward.x, s.horizForward.z);

    if (leftValidMask[i]) {
      if (i % postStep === 0) {
        const off = -(barrierOffsetMeters + 0.11);
        barrierParts.push(
          stampVertexColorAndTransform(
            basePostGeo.clone(),
            '#6b7480',
            s.position.x + s.right.x * off,
            s.position.y + 0.34,
            s.position.z + s.right.z * off,
            yaw,
          ),
        );
      }
      if (i === 0 || !leftValidMask[i - 1] || i === samples.length - 1 || !leftValidMask[i + 1]) {
        const off = -(barrierOffsetMeters + 0.04);
        barrierParts.push(
          stampVertexColorAndTransform(
            baseCapGeo.clone(),
            '#aeb8c2',
            s.position.x + s.right.x * off,
            s.position.y + 0.56,
            s.position.z + s.right.z * off,
            yaw,
          ),
        );
      }
    }

    if (rightValidMask[i]) {
      if (i % postStep === 0) {
        const off = barrierOffsetMeters + 0.11;
        barrierParts.push(
          stampVertexColorAndTransform(
            basePostGeo.clone(),
            '#6b7480',
            s.position.x + s.right.x * off,
            s.position.y + 0.34,
            s.position.z + s.right.z * off,
            yaw,
          ),
        );
      }
      if (i === 0 || !rightValidMask[i - 1] || i === samples.length - 1 || !rightValidMask[i + 1]) {
        const off = barrierOffsetMeters + 0.04;
        barrierParts.push(
          stampVertexColorAndTransform(
            baseCapGeo.clone(),
            '#aeb8c2',
            s.position.x + s.right.x * off,
            s.position.y + 0.56,
            s.position.z + s.right.z * off,
            yaw,
          ),
        );
      }
    }
  }
  basePostGeo.dispose();
  baseCapGeo.dispose();

  const mergedBarrierGeo = mergeGeometries(barrierParts, false)!;
  barrierParts.forEach((g) => g.dispose());

  const armcoMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.72,
    roughness: 0.36,
  });
  const barrierMesh = new THREE.Mesh(mergedBarrierGeo, armcoMat);
  barrierMesh.name = 'ArmcoBarrierSystem';
  barrierMesh.castShadow = false;
  barrierMesh.receiveShadow = true;
  group.add(barrierMesh);

  // 4. Start/Finish Gantry Arch at Bundaran Tamansari (2 batched meshes)
  const gantry = buildStartFinishGantry(samples[0]);
  group.add(gantry);

  // 5. Continuous Highland Terrain & Mount Merbabu Backdrop (2 batched meshes)
  const terrainGroup = buildHighlandTerrain(samples, minX, maxX, minZ, maxZ);
  group.add(terrainGroup);

  // Build O(1) spatial hash grid over track segments for zero-GC runtime collision & leg-transition queries
  const segGridCellSize = 32;
  const segGrid = new Map<string, number[]>();
  const numTrackSegs = samples.length - 1;
  for (let i = 0; i < numTrackSegs; i++) {
    const a = samples[i].position;
    const b = samples[i + 1].position;
    const minCx = Math.floor(Math.min(a.x, b.x) / segGridCellSize);
    const maxCx = Math.floor(Math.max(a.x, b.x) / segGridCellSize);
    const minCz = Math.floor(Math.min(a.z, b.z) / segGridCellSize);
    const maxCz = Math.floor(Math.max(a.z, b.z) / segGridCellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx},${cz}`;
        let list = segGrid.get(key);
        if (!list) {
          list = [];
          segGrid.set(key, list);
        }
        list.push(i);
      }
    }
  }
  const queryStamp = new Int32Array(numTrackSegs);
  let queryStampId = 1;

  const queryClosestTrack = (
    px: number,
    pz: number,
    out?: TrackClosestQueryResult,
  ): TrackClosestQueryResult => {
    const res: TrackClosestQueryResult = out ?? {
      segIndex: 0,
      t: 0,
      distSq: Infinity,
      distanceMeters: 0,
      lateralOffset: 0,
      roadY: samples[0].position.y,
      projX: samples[0].position.x,
      projZ: samples[0].position.z,
      tangent: samples[0].tangent,
      right: samples[0].right,
    };

    const cx = Math.floor(px / segGridCellSize);
    const cz = Math.floor(pz / segGridCellSize);
    let bestIdx = 0;
    let bestT = 0;
    let bestDistSq = Infinity;
    let bestProjX = samples[0].position.x;
    let bestProjZ = samples[0].position.z;
    let bestRoadY = samples[0].position.y;
    queryStampId++;

    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      for (let dzCell = -1; dzCell <= 1; dzCell++) {
        const list = segGrid.get(`${cx + dxCell},${cz + dzCell}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k];
          if (queryStamp[idx] === queryStampId) continue;
          queryStamp[idx] = queryStampId;

          const a = samples[idx].position;
          const b = samples[idx + 1].position;
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const lenSq = abx * abx + abz * abz;
          let t = 0;
          if (lenSq > 1e-8) {
            t = ((px - a.x) * abx + (pz - a.z) * abz) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
          }
          const projX = a.x + abx * t;
          const projZ = a.z + abz * t;
          const dSq = (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestIdx = idx;
            bestT = t;
            bestProjX = projX;
            bestProjZ = projZ;
            bestRoadY = a.y + (b.y - a.y) * t;
          }
        }
      }
    }

    if (bestDistSq === Infinity) {
      for (let idx = 0; idx < numTrackSegs; idx++) {
        const a = samples[idx].position;
        const b = samples[idx + 1].position;
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const lenSq = abx * abx + abz * abz;
        let t = 0;
        if (lenSq > 1e-8) {
          t = ((px - a.x) * abx + (pz - a.z) * abz) / lenSq;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
        }
        const projX = a.x + abx * t;
        const projZ = a.z + abz * t;
        const dSq = (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
          bestT = t;
          bestProjX = projX;
          bestProjZ = projZ;
          bestRoadY = a.y + (b.y - a.y) * t;
        }
      }
    }

    const s0 = samples[bestIdx];
    const s1 = samples[bestIdx + 1];
    res.segIndex = bestIdx;
    res.t = bestT;
    res.distSq = bestDistSq;
    res.distanceMeters = THREE.MathUtils.lerp(s0.distanceMeters, s1.distanceMeters, bestT);
    res.roadY = bestRoadY;
    res.projX = bestProjX;
    res.projZ = bestProjZ;
    res.tangent = s0.tangent;
    res.right = s0.right;
    res.lateralOffset = (px - bestProjX) * s0.right.x + (pz - bestProjZ) * s0.right.z;
    return res;
  };

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
    queryClosestTrack,
    dispose,
  };
}
