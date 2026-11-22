import * as THREE from 'three';

export interface F1TestCarRig {
  group: THREE.Group;
  frontWheelPivots: [THREE.Group, THREE.Group];
  wheelMeshes: THREE.Mesh[];
  brakeLightMaterial: THREE.MeshStandardMaterial;
  setWheelState: (steerAngleRad: number, wheelSpinDeltaRad: number, braking: boolean) => void;
  dispose: () => void;
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
 * Builds a single lightweight low-poly F1 test car (< 800 tris)
 * Grounded at y = 0 (bottom of tires), forward = +Z.
 */
export function buildF1TestCar(): F1TestCarRig {
  const group = new THREE.Group();
  group.name = 'F1TestCar';

  // Materials with varied roughness/metalness for crisp PBR definition
  const liveryRedMat = new THREE.MeshPhysicalMaterial({
    color: 0xd91c24,
    roughness: 0.24,
    metalness: 0.32,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const liveryWhiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.26,
    metalness: 0.15,
    clearcoat: 0.8,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e24,
    roughness: 0.62,
    metalness: 0.22,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16181c,
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.88,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    roughness: 0.18,
    metalness: 0.35,
    clearcoat: 1.0,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.9,
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

  // 2. Carbon-fiber Venturi floor & diffuser plank
  const floorGeo = new THREE.BoxGeometry(1.52, 0.06, 4.15);
  const floor = new THREE.Mesh(floorGeo, carbonMat);
  floor.position.set(0, 0.11, -0.08);
  floor.castShadow = true;
  floor.receiveShadow = true;
  group.add(floor);

  // 3. Primary monocoque chassis tub & tapered nose cone
  const chassisGeo = new THREE.BoxGeometry(0.68, 0.36, 2.35);
  const chassis = new THREE.Mesh(chassisGeo, liveryRedMat);
  chassis.position.set(0, 0.32, 0.05);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  const noseGeo = new THREE.BoxGeometry(0.42, 0.2, 1.35);
  const nose = new THREE.Mesh(noseGeo, liveryRedMat);
  nose.position.set(0, 0.24, 1.62);
  nose.rotation.x = 0.08;
  nose.castShadow = true;
  group.add(nose);

  const noseTipGeo = new THREE.BoxGeometry(0.28, 0.13, 0.55);
  const noseTip = new THREE.Mesh(noseTipGeo, liveryWhiteMat);
  noseTip.position.set(0, 0.18, 2.28);
  noseTip.castShadow = true;
  group.add(noseTip);

  // 4. Sculpted sidepods & engine cover / shark fin
  const sidepodGeo = new THREE.BoxGeometry(0.42, 0.32, 1.65);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(sidepodGeo, liveryRedMat);
    pod.position.set(side * 0.54, 0.29, -0.22);
    pod.castShadow = true;
    pod.receiveShadow = true;
    group.add(pod);
  }

  const airboxGeo = new THREE.BoxGeometry(0.38, 0.42, 1.15);
  const airbox = new THREE.Mesh(airboxGeo, liveryWhiteMat);
  airbox.position.set(0, 0.54, -0.62);
  airbox.castShadow = true;
  group.add(airbox);

  const finGeo = new THREE.BoxGeometry(0.04, 0.36, 1.1);
  const fin = new THREE.Mesh(finGeo, liveryRedMat);
  fin.position.set(0, 0.68, -1.18);
  fin.castShadow = true;
  group.add(fin);

  // 5. Front Wing Assembly + Endplates
  const frontWingGeo = new THREE.BoxGeometry(1.96, 0.05, 0.48);
  const frontWing = new THREE.Mesh(frontWingGeo, carbonMat);
  frontWing.position.set(0, 0.13, 2.25);
  frontWing.castShadow = true;
  group.add(frontWing);

  const frontFlapGeo = new THREE.BoxGeometry(1.88, 0.04, 0.22);
  const frontFlap = new THREE.Mesh(frontFlapGeo, liveryWhiteMat);
  frontFlap.position.set(0, 0.18, 2.08);
  frontFlap.rotation.x = -0.18;
  group.add(frontFlap);

  const fEndplateGeo = new THREE.BoxGeometry(0.04, 0.22, 0.54);
  for (const side of [-1, 1]) {
    const ep = new THREE.Mesh(fEndplateGeo, liveryRedMat);
    ep.position.set(side * 0.98, 0.2, 2.24);
    ep.castShadow = true;
    group.add(ep);
  }

  // 6. Rear Wing Assembly + DRS Flap + FIA Rain Light
  const rPylonGeo = new THREE.BoxGeometry(0.05, 0.52, 0.18);
  const rPylon = new THREE.Mesh(rPylonGeo, carbonMat);
  rPylon.position.set(0, 0.54, -1.86);
  group.add(rPylon);

  const rearMainGeo = new THREE.BoxGeometry(1.24, 0.06, 0.34);
  const rearMain = new THREE.Mesh(rearMainGeo, carbonMat);
  rearMain.position.set(0, 0.82, -1.94);
  rearMain.rotation.x = -0.15;
  rearMain.castShadow = true;
  group.add(rearMain);

  const rearDrsGeo = new THREE.BoxGeometry(1.22, 0.05, 0.22);
  const rearDrs = new THREE.Mesh(rearDrsGeo, liveryWhiteMat);
  rearDrs.position.set(0, 0.92, -2.02);
  rearDrs.rotation.x = -0.32;
  rearDrs.castShadow = true;
  group.add(rearDrs);

  const rEndplateGeo = new THREE.BoxGeometry(0.04, 0.56, 0.44);
  for (const side of [-1, 1]) {
    const ep = new THREE.Mesh(rEndplateGeo, liveryRedMat);
    ep.position.set(side * 0.62, 0.72, -1.95);
    ep.castShadow = true;
    group.add(ep);
  }

  const rainLightGeo = new THREE.BoxGeometry(0.1, 0.14, 0.06);
  const rainLight = new THREE.Mesh(rainLightGeo, brakeLightMaterial);
  rainLight.position.set(0, 0.26, -2.14);
  group.add(rainLight);

  // 7. Halo Cockpit & Driver Helmet
  const haloBarGeo = new THREE.TorusGeometry(0.24, 0.028, 6, 14, Math.PI);
  haloBarGeo.rotateX(Math.PI / 2);
  const halo = new THREE.Mesh(haloBarGeo, carbonMat);
  halo.position.set(0, 0.58, 0.34);
  group.add(halo);

  const haloStemGeo = new THREE.BoxGeometry(0.045, 0.18, 0.06);
  const haloStem = new THREE.Mesh(haloStemGeo, carbonMat);
  haloStem.position.set(0, 0.51, 0.57);
  haloStem.rotation.x = -0.35;
  group.add(haloStem);

  const helmetGeo = new THREE.SphereGeometry(0.145, 12, 10);
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.53, 0.18);
  helmet.castShadow = true;
  group.add(helmet);

  const visorGeo = new THREE.BoxGeometry(0.2, 0.065, 0.12);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.54, 0.27);
  group.add(visor);

  // 8. 4x Open-Wheel Tires & Metallic Rims (radius = 0.33m, bottom flush at y = 0)
  const wheelRadius = 0.33;
  const wheelWidthFront = 0.31;
  const wheelWidthRear = 0.38;

  const frontTireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidthFront, 16);
  frontTireGeo.rotateZ(Math.PI / 2);
  const rearTireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidthRear, 16);
  rearTireGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.39, 10);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelMeshes: THREE.Mesh[] = [];
  const frontWheelPivots: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];

  // Front wheels (pivots at ±0.84, y=0.33, z=1.42)
  const frontSpecs: [number, THREE.Group][] = [
    [-0.84, frontWheelPivots[0]],
    [0.84, frontWheelPivots[1]],
  ];
  for (const [wx, pivot] of frontSpecs) {
    pivot.position.set(wx, wheelRadius, 1.42);
    const tire = new THREE.Mesh(frontTireGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.scale.y = 0.84;
    tire.add(rim);
    pivot.add(tire);
    wheelMeshes.push(tire);
    group.add(pivot);
  }

  // Rear wheels (±0.85, y=0.33, z=-1.38)
  for (const wx of [-0.85, 0.85]) {
    const tire = new THREE.Mesh(rearTireGeo, tireMat);
    tire.position.set(wx, wheelRadius, -1.38);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    tire.add(rim);
    wheelMeshes.push(tire);
    group.add(tire);
  }

  // Suspension wishbones (visual connection from chassis to wheels)
  const wishboneGeo = new THREE.BoxGeometry(0.62, 0.03, 0.06);
  for (const side of [-1, 1]) {
    const fWish = new THREE.Mesh(wishboneGeo, carbonMat);
    fWish.position.set(side * 0.52, 0.28, 1.42);
    group.add(fWish);
    const rWish = new THREE.Mesh(wishboneGeo, carbonMat);
    rWish.position.set(side * 0.52, 0.28, -1.38);
    group.add(rWish);
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
