import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Building2, Camera, ChevronDown, ChevronUp, Eye, ImageUp, RotateCcw, X } from 'lucide-react';
import salatigaRouteRaw from './data/salatiga-route.geojson?raw';
import salatigaBuildingsRaw from './data/salatiga-buildings.geojson?raw';
import {
  buildSalatigaTrack,
  gpsToWorld,
  SalatigaGeoJson,
  TrackClosestQueryResult,
  TrackSample,
  worldToGps,
} from './game/salatigaTrack';
import {
  buildSalatigaCustomBuildings,
  SALATIGA_CUSTOM_BUILDINGS,
  SalatigaCustomBuilding,
} from './game/salatigaCustomBuildings';
import { buildF1TestCar } from './game/f1TestCar';

type CameraMode = 'chase' | 'orbit';

interface TelemetrySnapshot {
  fps: number;
  drawCalls: number;
  distanceMeters: number;
  trackLengthMeters: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  lon: number;
  lat: number;
  speedKmh: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Pre-allocated math helpers for zero-GC 60 FPS loop
const _carForward = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _chaseLookAt = new THREE.Vector3();
const _basisRight = new THREE.Vector3();
const _basisUp = new THREE.Vector3();
const _basisFwd = new THREE.Vector3();
const _basisMat = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface ClosestTrackHit {
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

function findClosestOnTrack(
  samples: TrackSample[],
  px: number,
  pz: number,
  hintSegIndex: number | null,
  windowRadius = 28,
): ClosestTrackHit {
  const numSegs = samples.length - 1;
  const startIdx =
    hintSegIndex !== null ? Math.max(0, hintSegIndex - windowRadius) : 0;
  const endIdx =
    hintSegIndex !== null ? Math.min(numSegs - 1, hintSegIndex + windowRadius) : numSegs - 1;

  let bestIdx = 0;
  let bestT = 0;
  let bestDistSq = Infinity;
  let bestProjX = samples[0].position.x;
  let bestProjZ = samples[0].position.z;
  let bestRoadY = samples[0].position.y;

  const scanRange = (from: number, to: number) => {
    for (let i = from; i <= to; i++) {
      const a = samples[i].position;
      const b = samples[i + 1].position;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      let t = 0;
      if (lenSq > 1e-8) {
        t = ((px - a.x) * abx + (pz - a.z) * abz) / lenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
      }
      const cx = a.x + abx * t;
      const cz = a.z + abz * t;
      const dSq = (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
        bestT = t;
        bestProjX = cx;
        bestProjZ = cz;
        bestRoadY = a.y + (b.y - a.y) * t;
      }
    }
  };

  scanRange(startIdx, endIdx);

  // If local window didn't find a close match (e.g. near finish/start crossover), do full scan
  if (hintSegIndex !== null && bestDistSq > 900) {
    scanRange(0, numSegs - 1);
  }

  const s0 = samples[bestIdx];
  const s1 = samples[bestIdx + 1];
  const distanceMeters = THREE.MathUtils.lerp(s0.distanceMeters, s1.distanceMeters, bestT);
  const right = s0.right;
  const tangent = s0.tangent;
  const lateralOffset = (px - bestProjX) * right.x + (pz - bestProjZ) * right.z;

  return {
    segIndex: bestIdx,
    t: bestT,
    distSq: bestDistSq,
    distanceMeters,
    lateralOffset,
    roadY: bestRoadY,
    projX: bestProjX,
    projZ: bestProjZ,
    tangent,
    right,
  };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraModeRef = useRef<CameraMode>('chase');
  const resetCarRef = useRef<(() => void) | null>(null);
  const toggleCameraRef = useRef<(() => void) | null>(null);
  const rebuildBuildingsRef = useRef<((nextBuildings: SalatigaCustomBuilding[]) => void) | null>(null);
  const focusBuildingRef = useRef<((b: SalatigaCustomBuilding) => void) | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [customBuildings, setCustomBuildings] = useState<SalatigaCustomBuilding[]>(() =>
    SALATIGA_CUSTOM_BUILDINGS.map((b) => ({ ...b })),
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    SALATIGA_CUSTOM_BUILDINGS[0].id,
  );
  const [contextLost, setContextLost] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    fps: 60,
    drawCalls: 0,
    distanceMeters: 0,
    trackLengthMeters: 5016,
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    lon: 110.504924,
    lat: -7.324859,
    speedKmh: 0,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Scene & Atmospheric Horizon Fog
    const skyColor = new THREE.Color(0xcde2f2);
    const scene = new THREE.Scene();
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 650, 8800);

    // Studio Environment Reflection for metallic Armco barriers and F1 car clearcoat
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Camera
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.25, 16000);

    // OrbitControls for Free Orbit Camera inspection
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = !isSoftwareGl;
    orbitControls.dampingFactor = 0.06;
    orbitControls.minDistance = 2.5;
    orbitControls.maxDistance = 2600;
    orbitControls.maxPolarAngle = Math.PI * 0.492;
    orbitControls.enabled = false;

    // Lighting: Directional Sunlight (with crisp shadows) + Hemisphere Sky Light
    const hemiLight = new THREE.HemisphereLight(0xa3d4f7, 0x425e34, 0.72);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const shadowHalfExtent = 75;
    sunLight.shadow.camera.left = -shadowHalfExtent;
    sunLight.shadow.camera.right = shadowHalfExtent;
    sunLight.shadow.camera.top = shadowHalfExtent;
    sunLight.shadow.camera.bottom = -shadowHalfExtent;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 360;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const sunOffset = new THREE.Vector3(95, 135, -75);

    // Build Salatiga 5km Track & Terrain from verbatim GeoJSON
    const routeGeoJson = JSON.parse(salatigaRouteRaw) as SalatigaGeoJson;
    const trackBuild = buildSalatigaTrack(routeGeoJson);
    scene.add(trackBuild.group);

    // Build Stage 2 Custom Salatiga Landmarks & 60 FPS Chunked OSM Corridor Buildings
    const buildingsGeoJson = JSON.parse(salatigaBuildingsRaw);
    let buildingsBuild = buildSalatigaCustomBuildings(
      trackBuild.trackCurve,
      buildingsGeoJson,
      customBuildings,
    );
    scene.add(buildingsBuild.group);

    // Configure max texture anisotropy on track and building textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const applyMaxAniso = (root: THREE.Object3D) => {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const map = (m as THREE.MeshStandardMaterial).map;
            if (map) {
              map.anisotropy = maxAniso;
              map.needsUpdate = true;
            }
          }
        }
      });
    };
    applyMaxAniso(trackBuild.group);
    applyMaxAniso(buildingsBuild.group);

    rebuildBuildingsRef.current = (nextBuildings: SalatigaCustomBuilding[]) => {
      scene.remove(buildingsBuild.group);
      buildingsBuild.dispose();
      buildingsBuild = buildSalatigaCustomBuildings(
        trackBuild.trackCurve,
        buildingsGeoJson,
        nextBuildings,
      );
      scene.add(buildingsBuild.group);
      applyMaxAniso(buildingsBuild.group);
    };

    // Spawn ONLY 1 lightweight low-poly F1 test car at Bundaran Tamansari start line (t = 0)
    const carRig = buildF1TestCar();
    scene.add(carRig.group);

    const startSample = trackBuild.samples[0];
    const carState = {
      x: startSample.position.x,
      y: startSample.position.y,
      z: startSample.position.z,
      yaw: Math.atan2(startSample.horizForward.x, startSample.horizForward.z),
      speed: 0,
      steerVisual: 0,
      lastSegIndex: 0,
      distanceMeters: 0,
    };

    const syncCarTransform = (tangent: THREE.Vector3, roadY: number) => {
      carState.y = roadY;
      carRig.group.position.set(carState.x, carState.y, carState.z);

      // Compute car pitch along road slope without introducing unnatural roll
      _carForward.set(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));
      const fwdDotTan = _carForward.x * tangent.x + _carForward.z * tangent.z;
      const slopeY = fwdDotTan * tangent.y;
      _basisFwd.set(_carForward.x, slopeY, _carForward.z).normalize();
      _basisRight.crossVectors(WORLD_UP, _basisFwd).normalize();
      _basisUp.crossVectors(_basisFwd, _basisRight).normalize();
      _basisMat.makeBasis(_basisRight, _basisUp, _basisFwd);
      _targetQuat.setFromRotationMatrix(_basisMat);
      carRig.group.quaternion.copy(_targetQuat);
    };

    syncCarTransform(startSample.tangent, startSample.position.y);

    // Initialize chase camera right behind start line
    _carForward.set(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));
    camera.position
      .copy(carRig.group.position)
      .addScaledVector(_carForward, -9.2)
      .addScaledVector(WORLD_UP, 3.5);
    _chaseLookAt.copy(carRig.group.position).addScaledVector(_carForward, 6.0).addScaledVector(WORLD_UP, 0.8);
    camera.lookAt(_chaseLookAt);

    // Pre-warm shaders on GPU devices
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Reset car to nearest track point (R key or HUD button)
    const resetToNearestTrack = () => {
      const hit = findClosestOnTrack(trackBuild.samples, carState.x, carState.z, null);
      carState.x = hit.projX;
      carState.z = hit.projZ;
      carState.y = hit.roadY;
      carState.yaw = Math.atan2(hit.tangent.x, hit.tangent.z);
      carState.speed = 0;
      carState.steerVisual = 0;
      carState.lastSegIndex = hit.segIndex;
      carState.distanceMeters = hit.distanceMeters;
      syncCarTransform(hit.tangent, hit.roadY);

      if (cameraModeRef.current === 'orbit') {
        orbitControls.target.set(carState.x, carState.y + 0.8, carState.z);
        orbitControls.update();
      }
    };
    resetCarRef.current = resetToNearestTrack;

    const toggleCameraMode = () => {
      const next: CameraMode = cameraModeRef.current === 'chase' ? 'orbit' : 'chase';
      cameraModeRef.current = next;
      setCameraMode(next);

      if (next === 'orbit') {
        orbitControls.enabled = true;
        orbitControls.target.set(carState.x, carState.y + 0.8, carState.z);
        _carForward.set(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));
        camera.position
          .set(carState.x, carState.y + 7.5, carState.z)
          .addScaledVector(_carForward, -13.5);
        orbitControls.update();
      } else {
        orbitControls.enabled = false;
        _chaseLookAt.set(carState.x, carState.y + 0.8, carState.z);
      }
    };
    toggleCameraRef.current = toggleCameraMode;

    focusBuildingRef.current = (b: SalatigaCustomBuilding) => {
      const wp = gpsToWorld(b.lon, b.lat);
      const hit = findClosestOnTrack(trackBuild.samples, wp.x, wp.z, null);
      const targetY = hit.roadY + Math.max(2.5, b.floors * (b.floorHeight ?? 3.6) * 0.45);
      cameraModeRef.current = 'orbit';
      setCameraMode('orbit');
      orbitControls.enabled = true;
      orbitControls.target.set(wp.x, targetY, wp.z);
      const yawRad = THREE.MathUtils.degToRad(180 - b.rotationDeg);
      const viewDist = Math.max(24, Math.max(b.widthMeters, b.depthMeters) * 1.45);
      camera.position.set(
        wp.x + Math.sin(yawRad) * viewDist,
        targetY + viewDist * 0.48,
        wp.z + Math.cos(yawRad) * viewDist,
      );
      orbitControls.update();
    };

    // Keyboard input handling
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.repeat) return;
      keys[e.code] = true;

      if (e.code === 'KeyC') {
        toggleCameraMode();
      } else if (e.code === 'KeyR') {
        resetToNearestTrack();
      } else if (e.code === 'KeyH') {
        setControlsCollapsed((prev) => !prev);
      } else if (e.code === 'KeyB') {
        setWorkbenchOpen((prev) => !prev);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize handling
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Frame timing & FPS measurement
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let fpsFrameCount = 0;
    let fpsWindowStart = lastTime;
    let currentFps = 60;
    let lastTelemetryCommit = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const maxHalfLateral = 7.15; // Car half-width ~0.95m inside ±8.2m Armco guardrails
    const maxJunctionHalfLateral = 7.6; // Unobstructed clearance to nearest valid centerline at open junctions
    const _globalHit: TrackClosestQueryResult = {
      segIndex: 0,
      t: 0,
      distSq: 0,
      distanceMeters: 0,
      lateralOffset: 0,
      roadY: startSample.position.y,
      projX: startSample.position.x,
      projZ: startSample.position.z,
      tangent: startSample.tangent,
      right: startSample.right,
    };

    const tick = (nowArg?: number) => {
      if (disposed) return;
      const now = typeof nowArg === 'number' ? nowArg : performance.now();
      const rawDt = (now - lastTime) * 0.001;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // FPS counter
      fpsFrameCount++;
      if (now - fpsWindowStart >= 400) {
        currentFps = Math.round((fpsFrameCount * 1000) / (now - fpsWindowStart));
        fpsFrameCount = 0;
        fpsWindowStart = now;
      }

      // 1. Vehicle Input & Physics
      const throttle = keys['KeyW'] || keys['ArrowUp'] ? 1 : 0;
      const brake = keys['KeyS'] || keys['ArrowDown'] ? 1 : 0;
      const steerLeft = keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0;
      const steerRight = keys['KeyD'] || keys['ArrowRight'] ? 1 : 0;
      const boost = keys['ShiftLeft'] || keys['ShiftRight'] ? 1 : 0;

      const steerInput = steerLeft - steerRight; // +1 = turn left (+yaw), -1 = turn right (-yaw)
      const maxForwardSpeed = boost ? 86 : 54;
      const accelRate = boost ? 46 : 28;
      const brakeRate = 48;
      const reverseMax = -14;

      if (throttle) {
        carState.speed += accelRate * dt;
      } else if (brake) {
        if (carState.speed > 0.5) {
          carState.speed -= brakeRate * dt;
        } else {
          carState.speed -= 16 * dt;
        }
      } else {
        // Aerodynamic drag + rolling resistance
        const drag = 0.42 * carState.speed + Math.sign(carState.speed) * 2.2;
        if (Math.abs(carState.speed) <= Math.abs(drag * dt)) {
          carState.speed = 0;
        } else {
          carState.speed -= drag * dt;
        }
      }

      carState.speed = THREE.MathUtils.clamp(carState.speed, reverseMax, maxForwardSpeed);

      // Speed-sensitive F1 steering
      const speedAbs = Math.abs(carState.speed);
      const steerAuthority =
        THREE.MathUtils.clamp(speedAbs / 5.5, 0, 1) *
        THREE.MathUtils.lerp(1.0, 0.42, THREE.MathUtils.clamp(speedAbs / 80, 0, 1));
      const dirSign = carState.speed >= -0.05 ? 1 : -1;
      const targetSteerAngle = steerInput * 0.42;
      carState.steerVisual = THREE.MathUtils.damp(carState.steerVisual, targetSteerAngle, 14, dt);

      carState.yaw += steerInput * 2.15 * steerAuthority * dirSign * dt;

      // Advance position
      carState.x += Math.sin(carState.yaw) * carState.speed * dt;
      carState.z += Math.cos(carState.yaw) * carState.speed * dt;

      // 2. Track Surface Clamping & Junction-Aware Armco Guardrail Containment
      const hit = findClosestOnTrack(
        trackBuild.samples,
        carState.x,
        carState.z,
        carState.lastSegIndex,
      );
      const globalHit = trackBuild.queryClosestTrack(carState.x, carState.z, _globalHit);

      const maxHalfLateralSq = maxHalfLateral * maxHalfLateral;
      let activeHit: ClosestTrackHit | TrackClosestQueryResult = hit;
      if (hit.distSq > maxHalfLateralSq && globalHit.distSq < hit.distSq * 0.85) {
        activeHit = globalHit;
      }

      carState.lastSegIndex = activeHit.segIndex;
      carState.distanceMeters = activeHit.distanceMeters;

      if (globalHit.distSq > maxHalfLateralSq) {
        const s0 = trackBuild.samples[globalHit.segIndex];
        const s1 = trackBuild.samples[globalHit.segIndex + 1];
        const hasActiveBarrier =
          globalHit.lateralOffset >= 0
            ? s0.rightBarrierValid && s1.rightBarrierValid
            : s0.leftBarrierValid && s1.leftBarrierValid;

        const effectiveLimit = hasActiveBarrier ? maxHalfLateral : maxJunctionHalfLateral;
        if (globalHit.distSq > effectiveLimit * effectiveLimit) {
          const clampedLat = Math.sign(globalHit.lateralOffset) * effectiveLimit;
          carState.x = globalHit.projX + globalHit.right.x * clampedLat;
          carState.z = globalHit.projZ + globalHit.right.z * clampedLat;
          if (hasActiveBarrier) {
            // Gently scrub speed on Armco wall rub while sliding along barrier tangent
            carState.speed *= 1 - Math.min(0.4, 2.2 * dt);
          }
          carState.lastSegIndex = globalHit.segIndex;
          carState.distanceMeters = globalHit.distanceMeters;
          activeHit = globalHit;
        }
      }

      syncCarTransform(activeHit.tangent, activeHit.roadY);

      // Wheel rotation & brake lights
      const wheelSpinDelta = (carState.speed * dt) / 0.33;
      carRig.setWheelState(carState.steerVisual, wheelSpinDelta, brake > 0 && carState.speed > 0.5);

      // 3. Camera Update
      if (cameraModeRef.current === 'chase') {
        _carForward.set(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));
        const speedNorm = THREE.MathUtils.clamp(speedAbs / 86, 0, 1);
        const chaseDist = 8.4 + speedNorm * 1.8;
        const chaseHeight = 3.25 + speedNorm * 0.45;

        _desiredCamPos
          .set(carState.x, carState.y + chaseHeight, carState.z)
          .addScaledVector(_carForward, -chaseDist);

        _desiredLookAt
          .set(carState.x, carState.y + 0.85, carState.z)
          .addScaledVector(_carForward, 6.5);

        const posLambda = isSoftwareGl ? 100 : 10;
        const lookLambda = isSoftwareGl ? 100 : 14;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, posLambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, posLambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, posLambda, dt);

        _chaseLookAt.x = THREE.MathUtils.damp(_chaseLookAt.x, _desiredLookAt.x, lookLambda, dt);
        _chaseLookAt.y = THREE.MathUtils.damp(_chaseLookAt.y, _desiredLookAt.y, lookLambda, dt);
        _chaseLookAt.z = THREE.MathUtils.damp(_chaseLookAt.z, _desiredLookAt.z, lookLambda, dt);
        camera.lookAt(_chaseLookAt);

        const targetFov = 60 + speedNorm * 8;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
          camera.updateProjectionMatrix();
        }
      } else {
        orbitControls.update();
      }

      // 4. Keep crisp directional shadow frustum centered around active focus (texel-snapped)
      const focusX = cameraModeRef.current === 'chase' ? carState.x : orbitControls.target.x;
      const focusY = cameraModeRef.current === 'chase' ? carState.y : orbitControls.target.y;
      const focusZ = cameraModeRef.current === 'chase' ? carState.z : orbitControls.target.z;
      const snap = 1.0;
      const sx = Math.round(focusX / snap) * snap;
      const sz = Math.round(focusZ / snap) * snap;
      sunLight.target.position.set(sx, focusY, sz);
      sunLight.position.set(sx + sunOffset.x, focusY + sunOffset.y, sz + sunOffset.z);

      // 5. Render
      renderer.render(scene, camera);

      // 6. Throttled React HUD telemetry commit (~15 Hz so React never bottlenecks 60 FPS WebGL)
      if (now - lastTelemetryCommit >= 65) {
        lastTelemetryCommit = now;
        const gps = worldToGps(carState.x, carState.z, carState.y);
        setTelemetry({
          fps: currentFps,
          drawCalls: renderer.info.render.calls,
          distanceMeters: carState.distanceMeters,
          trackLengthMeters: trackBuild.trackLengthMeters,
          worldX: carState.x,
          worldY: carState.y,
          worldZ: carState.z,
          lon: gps.lon,
          lat: gps.lat,
          speedKmh: Math.round(Math.abs(carState.speed) * 3.6),
        });
      }

      if (isSoftwareGl) {
        afterDraw(() => tick());
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      rebuildBuildingsRef.current = null;
      focusBuildingRef.current = null;
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();

      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      orbitControls.dispose();
      carRig.dispose();
      buildingsBuild.dispose();
      trackBuild.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const selectedBuilding =
    customBuildings.find((b) => b.id === selectedBuildingId) ?? customBuildings[0];

  const updateSelectedBuilding = (patch: Partial<SalatigaCustomBuilding>) => {
    const next = customBuildings.map((b) =>
      b.id === selectedBuilding.id ? { ...b, ...patch } : b,
    );
    setCustomBuildings(next);
    rebuildBuildingsRef.current?.(next);
  };

  const handleFacadePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const prevUrl = selectedBuilding.facadeTextureUrl;
    if (prevUrl && blobUrlsRef.current.has(prevUrl)) {
      URL.revokeObjectURL(prevUrl);
      blobUrlsRef.current.delete(prevUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    blobUrlsRef.current.add(objectUrl);
    updateSelectedBuilding({ facadeTextureUrl: objectUrl });
    e.target.value = '';
  };

  const handleResetBuildings = () => {
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current.clear();
    const defaults = SALATIGA_CUSTOM_BUILDINGS.map((b) => ({ ...b }));
    setCustomBuildings(defaults);
    rebuildBuildingsRef.current?.(defaults);
  };

  const totalTrackM = Math.round(telemetry.trackLengthMeters);
  const progressPct =
    telemetry.trackLengthMeters > 0
      ? Math.min(100, (telemetry.distanceMeters / telemetry.trackLengthMeters) * 100)
      : 0;

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Context Lost Recovery Notice */}
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/90 text-zinc-100">
          <div className="px-6 py-4 rounded-lg border border-zinc-800 bg-zinc-900 text-sm">
            WebGL rendering context interrupted. Restoring viewport...
          </div>
        </div>
      )}

      {/* Minimal Top-Left Telemetry HUD */}
      <aside
        aria-label="Track telemetry"
        className="pointer-events-none absolute top-4 left-4 z-10 w-80 rounded-lg border border-white/12 bg-zinc-950/82 px-4 py-3.5 text-zinc-100 shadow-lg"
      >
        <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
          <h1 className="font-display text-sm font-semibold tracking-tight text-white">
            Salatiga 5km Workbench
          </h1>
          <div className="flex items-center gap-1.5 font-telemetry text-xs whitespace-nowrap">
            <span className="font-medium text-amber-400">{telemetry.fps} FPS</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-300">{telemetry.drawCalls} calls</span>
          </div>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-400">Distance</dt>
            <dd className="font-telemetry text-zinc-100">
              {Math.round(telemetry.distanceMeters)} / {totalTrackM} m
            </dd>
          </div>

          <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-[width] duration-75"
              style={{ width: `${progressPct.toFixed(1)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <dt className="text-zinc-400">World (X, Y, Z)</dt>
            <dd className="font-telemetry text-zinc-100">
              {telemetry.worldX.toFixed(1)}, {telemetry.worldY.toFixed(1)},{' '}
              {telemetry.worldZ.toFixed(1)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-400">GPS (Lon, Lat)</dt>
            <dd className="font-telemetry text-zinc-100">
              {telemetry.lon.toFixed(6)}, {telemetry.lat.toFixed(6)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-white/10">
            <dt className="text-zinc-400">Speed · Camera</dt>
            <dd className="font-telemetry text-zinc-200">
              {telemetry.speedKmh} km/h · {cameraMode === 'chase' ? 'Chase' : 'Free Orbit'}
            </dd>
          </div>
        </dl>
      </aside>

      {/* Right-Side Building Workbench Drawer (B key) */}
      {workbenchOpen && selectedBuilding && (
        <aside
          aria-label="Building Workbench"
          className="absolute top-4 right-4 z-20 w-80 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-white/15 bg-zinc-950/90 p-4 text-xs text-zinc-100 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <h2 className="font-display text-sm font-semibold text-white">
                Building Workbench
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setWorkbenchOpen(false)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              aria-label="Close Workbench"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-zinc-400 mb-1">Landmark</label>
              <div className="flex gap-1.5">
                <select
                  value={selectedBuilding.id}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                  className="flex-1 rounded border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {customBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => focusBuildingRef.current?.(selectedBuilding)}
                  title="Focus Orbit Camera on Landmark"
                  className="inline-flex items-center gap-1 rounded border border-white/15 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 text-xs text-white cursor-pointer shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Focus
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1">Signboard Name</label>
              <input
                type="text"
                value={selectedBuilding.name}
                onChange={(e) => updateSelectedBuilding({ name: e.target.value })}
                className="w-full rounded border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1">Architectural Style</label>
              <select
                value={selectedBuilding.style}
                onChange={(e) =>
                  updateSelectedBuilding({
                    style: e.target.value as SalatigaCustomBuilding['style'],
                  })
                }
                className="w-full rounded border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="clock-roundabout">clock-roundabout</option>
                <option value="colonial-civic">colonial-civic</option>
                <option value="market-complex">market-complex</option>
                <option value="shophouse-row">shophouse-row</option>
                <option value="campus-gate">campus-gate</option>
                <option value="highland-cafe">highland-cafe</option>
                <option value="finish-gate">finish-gate</option>
                <option value="grand-hotel">grand-hotel</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="flex justify-between text-zinc-400 mb-1">
                  <span>Width</span>
                  <span className="font-telemetry text-zinc-200">
                    {selectedBuilding.widthMeters.toFixed(1)}m
                  </span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={56}
                  step={0.5}
                  value={selectedBuilding.widthMeters}
                  onChange={(e) =>
                    updateSelectedBuilding({ widthMeters: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="flex justify-between text-zinc-400 mb-1">
                  <span>Depth</span>
                  <span className="font-telemetry text-zinc-200">
                    {selectedBuilding.depthMeters.toFixed(1)}m
                  </span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={40}
                  step={0.5}
                  value={selectedBuilding.depthMeters}
                  onChange={(e) =>
                    updateSelectedBuilding({ depthMeters: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="flex justify-between text-zinc-400 mb-1">
                  <span>Floors</span>
                  <span className="font-telemetry text-zinc-200">{selectedBuilding.floors}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={selectedBuilding.floors}
                  onChange={(e) => updateSelectedBuilding({ floors: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="flex justify-between text-zinc-400 mb-1">
                  <span>Compass</span>
                  <span className="font-telemetry text-zinc-200">
                    {Math.round(selectedBuilding.rotationDeg)}°
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={selectedBuilding.rotationDeg}
                  onChange={(e) =>
                    updateSelectedBuilding({ rotationDeg: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-zinc-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step={0.00001}
                  value={selectedBuilding.lon}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val)) updateSelectedBuilding({ lon: val });
                  }}
                  className="w-full rounded border border-white/15 bg-zinc-900 px-2 py-1 font-telemetry text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step={0.00001}
                  value={selectedBuilding.lat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val)) updateSelectedBuilding({ lat: val });
                  }}
                  className="w-full rounded border border-white/15 bg-zinc-900 px-2 py-1 font-telemetry text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-medium text-amber-300 cursor-pointer">
                  <ImageUp className="w-3.5 h-3.5" />
                  <span>Test Facade Skin</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFacadePhotoUpload}
                    className="hidden"
                  />
                </label>
                {selectedBuilding.facadeTextureUrl && (
                  <button
                    type="button"
                    onClick={() => updateSelectedBuilding({ facadeTextureUrl: undefined })}
                    className="rounded border border-white/15 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetBuildings}
                className="w-full rounded border border-white/10 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 cursor-pointer"
              >
                Reset All Landmarks
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setControlsCollapsed((prev) => !prev)}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-zinc-950/85 px-3 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:border-white/25 transition-colors whitespace-nowrap"
        >
          {controlsCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!controlsCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-lg border border-white/12 bg-zinc-950/85 px-4 py-2.5 shadow-lg">
            <button
              type="button"
              onClick={() => toggleCameraRef.current?.()}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>{cameraMode === 'chase' ? 'Chase Camera' : 'Free Orbit'} (C)</span>
            </button>

            <button
              type="button"
              onClick={() => resetCarRef.current?.()}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>Reset to Track (R)</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkbenchOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workbenchOpen
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-white/10 text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Workbench (B)</span>
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/10 text-xs text-zinc-400 whitespace-nowrap">
              <span>WASD / Arrows Drive</span>
              <span aria-hidden="true">·</span>
              <span>Shift Boost</span>
              <span aria-hidden="true">·</span>
              <span>B Workbench</span>
              <span aria-hidden="true">·</span>
              <span>C Camera</span>
              <span aria-hidden="true">·</span>
              <span>R Reset</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
