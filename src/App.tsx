import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Camera, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import salatigaRouteRaw from './data/salatiga-route.geojson?raw';
import {
  buildSalatigaTrack,
  SalatigaGeoJson,
  TrackSample,
  worldToGps,
} from './game/salatigaTrack';
import { buildF1TestCar } from './game/f1TestCar';

type CameraMode = 'chase' | 'orbit';

interface TelemetrySnapshot {
  fps: number;
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

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    fps: 60,
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

    // Configure max texture anisotropy on track textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    trackBuild.group.traverse((obj) => {
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

    // Keyboard input handling
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keys[e.code] = true;

      if (e.code === 'KeyC') {
        toggleCameraMode();
      } else if (e.code === 'KeyR') {
        resetToNearestTrack();
      } else if (e.code === 'KeyH') {
        setControlsCollapsed((prev) => !prev);
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

      // 2. Track Surface Clamping & Armco Guardrail Containment
      const hit = findClosestOnTrack(
        trackBuild.samples,
        carState.x,
        carState.z,
        carState.lastSegIndex,
      );
      carState.lastSegIndex = hit.segIndex;
      carState.distanceMeters = hit.distanceMeters;

      if (Math.abs(hit.lateralOffset) > maxHalfLateral) {
        const clampedLat = Math.sign(hit.lateralOffset) * maxHalfLateral;
        carState.x = hit.projX + hit.right.x * clampedLat;
        carState.z = hit.projZ + hit.right.z * clampedLat;
        // Gently scrub speed on Armco wall rub while sliding along barrier tangent
        carState.speed *= 1 - Math.min(0.4, 2.2 * dt);
      }

      syncCarTransform(hit.tangent, hit.roadY);

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
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      orbitControls.dispose();
      carRig.dispose();
      trackBuild.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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
        className="pointer-events-none absolute top-4 left-4 z-10 w-72 rounded-lg border border-white/12 bg-zinc-950/82 px-4 py-3.5 text-zinc-100 shadow-lg"
      >
        <div className="flex items-baseline justify-between border-b border-white/10 pb-2 mb-2.5">
          <h1 className="font-display text-sm font-semibold tracking-tight text-white">
            Salatiga 5km Workbench
          </h1>
          <span className="font-telemetry text-xs font-medium text-amber-400">
            {telemetry.fps} FPS
          </span>
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

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-white/10 text-xs text-zinc-400 whitespace-nowrap">
              <span>WASD / Arrows Drive</span>
              <span aria-hidden="true">·</span>
              <span>Shift Boost</span>
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
