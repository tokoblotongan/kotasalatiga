import * as THREE from 'three';

export interface F1TestCarRig {
  group: THREE.Group;
  frontWheelPivots: [THREE.Group, THREE.Group];
  wheelMeshes: THREE.Mesh[];
  brakeLightMaterial: THREE.MeshStandardMaterial;
  setWheelState: (steerAngleRad: number, wheelSpinDeltaRad: number, braking: boolean) => void;
  dispose: () => void;
}

interface CarPartSpec {
  geo: THREE.BufferGeometry;
  hex: string;
  px?: number;
  py?: number;
  pz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const _pPos = new THREE.Vector3();
const _pQuat = new THREE.Quaternion();
const _pEuler = new THREE.Euler();
const _pScale = new THREE.Vector3(1, 1, 1);
const _pMat = new THREE.Matrix4();
const _pColor = new THREE.Color();

function mergeColoredParts(specs: CarPartSpec[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  let totalVerts = 0;
  let totalIdx = 0;

  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    const g = sp.geo;
    _pEuler.set(sp.rx ?? 0, sp.ry ?? 0, sp.rz ?? 0, 'XYZ');
    _pQuat.setFromEuler(_pEuler);
    _pPos.set(sp.px ?? 0, sp.py ?? 0, sp.pz ?? 0);
    _pScale.set(sp.sx ?? 1, sp.sy ?? 1, sp.sz ?? 1);
    _pMat.compose(_pPos, _pQuat, _pScale);
    g.applyMatrix4(_pMat);

    if (!g.index) {
      const cnt = g.attributes.position.count;
      const seq = new Array<number>(cnt);
      for (let k = 0; k < cnt; k++) seq[k] = k;
      g.setIndex(seq);
    }

    const vCount = g.attributes.position.count;
    const cols = new Float32Array(vCount * 3);
    _pColor.set(sp.hex);
    for (let v = 0; v < vCount; v++) {
      cols[v * 3] = _pColor.r;
      cols[v * 3 + 1] = _pColor.g;
      cols[v * 3 + 2] = _pColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    totalVerts += vCount;
    totalIdx += g.index!.count;
    prepared.push(g);
  }

  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const col = new Float32Array(totalVerts * 3);
  const idx = totalVerts > 65535 ? new Uint32Array(totalIdx) : new Uint16Array(totalIdx);

  let vo = 0;
  let io = 0;
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    const pPos = p.attributes.position.array as Float32Array;
    const pNorm = p.attributes.normal.array as Float32Array;
    const pCol = p.attributes.color.array as Float32Array;
    const pIdx = p.index!.array as ArrayLike<number>;

    pos.set(pPos, vo * 3);
    norm.set(pNorm, vo * 3);
    col.set(pCol, vo * 3);
    for (let k = 0; k < pIdx.length; k++) {
      idx[io + k] = pIdx[k] + vo;
    }

    vo += p.attributes.position.count;
    io += pIdx.length;
    p.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a single lightweight low-poly F1 test car (< 800 tris, 7 batched meshes)
 * Grounded at y = 0 (bottom of tires), forward = +Z.
 */
export function buildF1TestCar(): F1TestCarRig {
  const group = new THREE.Group();
  group.name = 'F1TestCar';

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.26,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.28,
  });

  const brakeLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  // 1. Soft contact shadow grounding plane
  const contactTex = createContactShadowTexture();
  const contactGeo = new THREE.PlaneGeometry(2.6, 5.4);
  contactGeo.rotateX(-Math.PI / 2);
  const contactMat = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const contactShadow = new THREE.Mesh(contactGeo, contactMat);
  contactShadow.position.set(0, 0.015, 0);
  group.add(contactShadow);

  // 2. Merged static F1 chassis, wings, floor, halo, suspension wishbones & driver helmet (1 draw call)
  const RED = '#d91c24';
  const WHITE = '#f1f5f9';
  const CARBON = '#1b1e24';
  const HELMET = '#f59e0b';
  const VISOR = '#0f172a';

  const bodyParts: CarPartSpec[] = [
    // Carbon-fiber Venturi floor & diffuser plank
    { geo: new THREE.BoxGeometry(1.52, 0.06, 4.15), hex: CARBON, py: 0.11, pz: -0.08 },
    // Primary monocoque chassis tub & tapered nose cone
    { geo: new THREE.BoxGeometry(0.68, 0.36, 2.35), hex: RED, py: 0.32, pz: 0.05 },
    { geo: new THREE.BoxGeometry(0.42, 0.2, 1.35), hex: RED, py: 0.24, pz: 1.62, rx: 0.08 },
    { geo: new THREE.BoxGeometry(0.28, 0.13, 0.55), hex: WHITE, py: 0.18, pz: 2.28 },
    // Sculpted sidepods & engine cover / shark fin
    { geo: new THREE.BoxGeometry(0.42, 0.32, 1.65), hex: RED, px: -0.54, py: 0.29, pz: -0.22 },
    { geo: new THREE.BoxGeometry(0.42, 0.32, 1.65), hex: RED, px: 0.54, py: 0.29, pz: -0.22 },
    { geo: new THREE.BoxGeometry(0.38, 0.42, 1.15), hex: WHITE, py: 0.54, pz: -0.62 },
    { geo: new THREE.BoxGeometry(0.04, 0.36, 1.1), hex: RED, py: 0.68, pz: -1.18 },
    // Front Wing Assembly + Endplates
    { geo: new THREE.BoxGeometry(1.96, 0.05, 0.48), hex: CARBON, py: 0.13, pz: 2.25 },
    { geo: new THREE.BoxGeometry(1.88, 0.04, 0.22), hex: WHITE, py: 0.18, pz: 2.08, rx: -0.18 },
    { geo: new THREE.BoxGeometry(0.04, 0.22, 0.54), hex: RED, px: -0.98, py: 0.2, pz: 2.24 },
    { geo: new THREE.BoxGeometry(0.04, 0.22, 0.54), hex: RED, px: 0.98, py: 0.2, pz: 2.24 },
    // Rear Wing Assembly + DRS Flap
    { geo: new THREE.BoxGeometry(0.05, 0.52, 0.18), hex: CARBON, py: 0.54, pz: -1.86 },
    { geo: new THREE.BoxGeometry(1.24, 0.06, 0.34), hex: CARBON, py: 0.82, pz: -1.94, rx: -0.15 },
    { geo: new THREE.BoxGeometry(1.22, 0.05, 0.22), hex: WHITE, py: 0.92, pz: -2.02, rx: -0.32 },
    { geo: new THREE.BoxGeometry(0.04, 0.56, 0.44), hex: RED, px: -0.62, py: 0.72, pz: -1.95 },
    { geo: new THREE.BoxGeometry(0.04, 0.56, 0.44), hex: RED, px: 0.62, py: 0.72, pz: -1.95 },
    // Halo Cockpit & Driver Helmet
    {
      geo: (() => {
        const g = new THREE.TorusGeometry(0.24, 0.028, 6, 14, Math.PI);
        g.rotateX(Math.PI / 2);
        return g;
      })(),
      hex: CARBON,
      py: 0.58,
      pz: 0.34,
    },
    { geo: new THREE.BoxGeometry(0.045, 0.18, 0.06), hex: CARBON, py: 0.51, pz: 0.57, rx: -0.35 },
    { geo: new THREE.SphereGeometry(0.145, 12, 10), hex: HELMET, py: 0.53, pz: 0.18 },
    { geo: new THREE.BoxGeometry(0.2, 0.065, 0.12), hex: VISOR, py: 0.54, pz: 0.27 },
    // Suspension wishbones
    { geo: new THREE.BoxGeometry(0.62, 0.03, 0.06), hex: CARBON, px: -0.52, py: 0.28, pz: 1.42 },
    { geo: new THREE.BoxGeometry(0.62, 0.03, 0.06), hex: CARBON, px: 0.52, py: 0.28, pz: 1.42 },
    { geo: new THREE.BoxGeometry(0.62, 0.03, 0.06), hex: CARBON, px: -0.52, py: 0.28, pz: -1.38 },
    { geo: new THREE.BoxGeometry(0.62, 0.03, 0.06), hex: CARBON, px: 0.52, py: 0.28, pz: -1.38 },
  ];

  const bodyMesh = new THREE.Mesh(mergeColoredParts(bodyParts), bodyMat);
  bodyMesh.name = 'F1CarBody';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 3. FIA Rain Light (separate mesh so brakeLightMaterial.emissiveIntensity animates dynamically)
  const rainLightGeo = new THREE.BoxGeometry(0.1, 0.14, 0.06);
  const rainLight = new THREE.Mesh(rainLightGeo, brakeLightMaterial);
  rainLight.position.set(0, 0.26, -2.14);
  group.add(rainLight);

  // 4. 4x Open-Wheel Tires & Metallic Rims merged per wheel (radius = 0.33m, bottom flush at y = 0)
  const wheelRadius = 0.33;
  const wheelWidthFront = 0.31;
  const wheelWidthRear = 0.38;

  const createWheelGeometry = (tireWidth: number, rimWidthScale: number): THREE.BufferGeometry => {
    const tire = new THREE.CylinderGeometry(wheelRadius, wheelRadius, tireWidth, 16);
    tire.rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.18, 0.18, 0.39 * rimWidthScale, 10);
    rim.rotateZ(Math.PI / 2);
    return mergeColoredParts([
      { geo: tire, hex: '#16181c' },
      { geo: rim, hex: '#cbd5e1' },
    ]);
  };

  const frontWheelGeo = createWheelGeometry(wheelWidthFront, 0.84);
  const rearWheelGeo = createWheelGeometry(wheelWidthRear, 1.0);

  const wheelMeshes: THREE.Mesh[] = [];
  const frontWheelPivots: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];

  const frontSpecs: [number, THREE.Group][] = [
    [-0.84, frontWheelPivots[0]],
    [0.84, frontWheelPivots[1]],
  ];
  for (const [wx, pivot] of frontSpecs) {
    pivot.position.set(wx, wheelRadius, 1.42);
    const wheel = new THREE.Mesh(frontWheelGeo, wheelMat);
    pivot.add(wheel);
    wheelMeshes.push(wheel);
    group.add(pivot);
  }

  for (const wx of [-0.85, 0.85]) {
    const wheel = new THREE.Mesh(rearWheelGeo, wheelMat);
    wheel.position.set(wx, wheelRadius, -1.38);
    wheelMeshes.push(wheel);
    group.add(wheel);
  }

  const setWheelState = (steerAngleRad: number, wheelSpinDeltaRad: number, braking: boolean) => {
    frontWheelPivots[0].rotation.y = steerAngleRad;
    frontWheelPivots[1].rotation.y = steerAngleRad;
    for (let i = 0; i < wheelMeshes.length; i++) {
      wheelMeshes[i].rotation.x += wheelSpinDeltaRad;
    }
    brakeLightMaterial.emissiveIntensity = braking ? 3.2 : 0.7;
  };

  const dispose = () => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m && materials.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    contactTex.dispose();
    materials.forEach((m) => m.dispose());
  };

  return {
    group,
    frontWheelPivots,
    wheelMeshes,
    brakeLightMaterial,
    setWheelState,
    dispose,
  };
}
