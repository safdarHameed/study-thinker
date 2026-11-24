import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { JourneyStep } from '@studythinker/shared';
import { PALETTE, gradientTexture, groupsOf, mat, mesh, seeded } from './kit';
import { SCENES } from './scenes';

/** Everything a scene builder needs. */
export interface BuildCtx {
  steps: JourneyStep[];
  groups: { name: string; items: JourneyStep[] }[];
  rng: () => number;
  dark: boolean;
  /** Register a clickable step. `lift` = how far above the object the marker floats. */
  node(step: JourneyStep, object: THREE.Object3D, lift?: number): void;
  /** Animate the object into view after `delay` seconds ('grow' scales along its own Y). */
  appear(object: THREE.Object3D, delay: number, mode?: 'pop' | 'grow'): void;
}

export type Env = 'meadow' | 'sky' | 'space' | 'studio' | 'sea';

export interface Built {
  root: THREE.Group;
  env: Env;
  /** Direction from the scene's centre towards the camera. */
  view: [number, number, number];
  /** Multiplies the framing distance (smaller = closer). */
  zoom?: number;
  /** 'front' scenes can only be turned a little (shelves, boards). */
  orbit?: 'free' | 'front';
  tick?: (t: number) => void;
  /** Extra object to keep in frame besides the steps (e.g. a tree's trunk). */
  frame?: THREE.Object3D;
}

export type Builder = (ctx: BuildCtx) => Built;

interface NodeRef {
  step: JourneyStep;
  object: THREE.Object3D;
  lift: number;
  meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
}

export interface EngineOptions {
  structure: string;
  steps: JourneyStep[];
  seed: string;
  dark: boolean;
  nextId: string | null;
  fresh: ReadonlySet<string>;
  /** Positioned by the engine every frame. */
  tipEl: HTMLElement;
  pinEl: HTMLElement;
  onHover(step: JourneyStep | null): void;
  onSelect(step: JourneyStep | null): void;
  onOpen(step: JourneyStep): void;
}

export interface Engine {
  zoom(factor: number): void;
  reset(): void;
  focus(stepId: string): void;
  dispose(): void;
}

const ENV: Record<
  Env,
  { light: [string, string]; dark: [string, string]; ground?: [number, number] }
> = {
  meadow: {
    light: ['#8ec5ff', '#eef7ff'],
    dark: ['#070b1f', '#1b2547'],
    ground: [0x9ad97a, 0x1d3a2a],
  },
  sky: { light: ['#7cb8ff', '#fdf4ff'], dark: ['#060a1c', '#2a1f4d'] },
  space: { light: ['#e0e7ff', '#faf5ff'], dark: ['#04040f', '#161236'] },
  studio: {
    light: ['#eef0fb', '#fbfaff'],
    dark: ['#0c0d16', '#1a1b2b'],
    ground: [0xf3f2fa, 0x1b1c29],
  },
  sea: {
    light: ['#7cc4ff', '#e6f6ff'],
    dark: ['#050a1c', '#10274a'],
    ground: [0x4aa8ef, 0x0f2f57],
  },
};

export function mountJourney(el: HTMLElement, o: EngineOptions): Engine {
  const width = () => el.clientWidth || 600;
  const height = () => el.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width(), height());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 0.55;

  // ── Build the scene ──
  const nodes: NodeRef[] = [];
  const appearing: { o: THREE.Object3D; delay: number; mode: 'pop' | 'grow'; to: THREE.Vector3 }[] =
    [];
  const ctx: BuildCtx = {
    steps: o.steps,
    groups: groupsOf(o.steps),
    rng: seeded(`${o.seed}:${o.structure}`),
    dark: o.dark,
    node(step, object, lift = 1) {
      const meshes: NodeRef['meshes'] = [];
      object.traverse((c) => {
        if (c instanceof THREE.Mesh && c.material instanceof THREE.MeshStandardMaterial) {
          c.material = c.material.clone();
          c.userData.stepId = step.id;
          meshes.push(c as NodeRef['meshes'][number]);
        }
      });
      nodes.push({ step, object, lift, meshes });
    },
    appear(object, delay, mode = 'pop') {
      appearing.push({ o: object, delay, mode, to: object.scale.clone() });
    },
  };
  const build = (SCENES[o.structure] ?? SCENES.path!)(ctx);
  scene.add(build.root);

  // Frame the scene before shrinking anything for the entrance animation.
  build.root.updateMatrixWorld(true);
  // Frame the steps themselves (plus the ground under them), not the scenery around them.
  const box = new THREE.Box3();
  for (const n of nodes) box.expandByObject(n.object);
  if (build.frame) box.expandByObject(build.frame);
  if (box.isEmpty()) box.setFromObject(build.root);
  if (build.env !== 'space' && build.env !== 'sky')
    box.expandByPoint(box.getCenter(new THREE.Vector3()).setY(0));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  sphere.radius *= 1.12;
  const radius = Math.max(sphere.radius, 3);
  const center = sphere.center.clone();
  const fitDistance = () => {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitH = radius / Math.sin(fov / 2);
    const fitW = radius / Math.sin(Math.atan(Math.tan(fov / 2) * camera.aspect));
    return Math.max(fitH, fitW) * 0.92 * (build.zoom ?? 1);
  };
  const viewDir = new THREE.Vector3(...build.view).normalize();
  const home = () => ({
    pos: center.clone().add(viewDir.clone().multiplyScalar(fitDistance())),
    target: center.clone(),
  });

  // ── Environment ──
  const env = ENV[build.env];
  const [top, bottom] = o.dark ? env.dark : env.light;
  scene.background = gradientTexture(top, bottom);
  scene.fog = new THREE.Fog(new THREE.Color(bottom), radius * 3, radius * 9);
  const hemi = new THREE.HemisphereLight(
    o.dark ? 0x9fb4ff : 0xffffff,
    o.dark ? 0x1b1f33 : 0xcfd8c2,
    o.dark ? 1.1 : 1.15,
  );
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(o.dark ? 0xc7d2fe : 0xfff4e0, o.dark ? 1.3 : 2.0);
  sun.position.copy(center).add(new THREE.Vector3(radius * 0.8, radius * 1.6, radius * 1.0));
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -radius * 1.4;
  sc.right = sc.top = radius * 1.4;
  sc.near = 0.5;
  sc.far = radius * 6;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  if (env.ground) {
    const ground = mesh(
      new THREE.CircleGeometry(radius * 8, 48),
      mat(o.dark ? env.ground[1] : env.ground[0], { roughness: 1 }),
      false,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = build.env === 'sea' ? -0.35 : -0.01;
    scene.add(ground);
  }
  if (build.env === 'space' || (o.dark && build.env !== 'studio')) {
    const pts = new Float32Array(900);
    const rng = seeded('stars');
    for (let i = 0; i < 300; i++) {
      const v = new THREE.Vector3(rng() - 0.5, rng() * 0.8 - 0.1, rng() - 0.5)
        .normalize()
        .multiplyScalar(radius * (3 + rng() * 2));
      pts.set([v.x + center.x, v.y + center.y, v.z + center.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    scene.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: o.dark ? 0xffffff : 0xa5b4fc,
          size: radius * 0.02,
          transparent: true,
          opacity: o.dark ? 0.85 : 0.6,
          fog: false,
        }),
      ),
    );
  }

  // ── Markers: "you are here" pin and "just changed" rings ──
  const pin = new THREE.Group();
  const pinMat = mat(PALETTE.primary, { emissive: PALETTE.primary, emissiveIntensity: 0.5 });
  const head = mesh(new THREE.SphereGeometry(0.32, 20, 14), pinMat);
  head.position.y = 0.55;
  const tip = mesh(new THREE.ConeGeometry(0.22, 0.55, 16), pinMat);
  tip.rotation.x = Math.PI;
  tip.position.y = 0.2;
  pin.add(head, tip);
  const nextNode = nodes.find((n) => n.step.id === o.nextId) ?? null;
  if (nextNode) scene.add(pin);
  const rings = nodes
    .filter((n) => o.fresh.has(n.step.id))
    .map((n) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.07, 8, 40),
        new THREE.MeshBasicMaterial({ color: PALETTE.highlight, transparent: true }),
      );
      scene.add(ring);
      return { ring, n };
    });

  // ── Entrance animation ──
  for (const a of appearing) {
    if (a.mode === 'grow') a.o.scale.set(a.to.x, 0.0001, a.to.z);
    else a.o.scale.setScalar(0.0001);
  }
  const intro = home();
  camera.position.copy(
    intro.pos
      .clone()
      .add(viewDir.clone().multiplyScalar(fitDistance() * 0.6))
      .setY(intro.pos.y * 1.5 + 2),
  );
  controls.target.copy(intro.target);
  controls.maxDistance = fitDistance() * 2.4;
  controls.minDistance = Math.max(1.5, radius * 0.12);
  if (build.env !== 'space' && build.env !== 'sky') controls.maxPolarAngle = Math.PI * 0.49;
  if (build.orbit === 'front') {
    controls.minAzimuthAngle = -0.9;
    controls.maxAzimuthAngle = 0.9;
  }

  // Camera moves (fly-to, zoom, reset)
  let flight: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    tFrom: THREE.Vector3;
    tTo: THREE.Vector3;
    start: number;
    dur: number;
  } | null = null;
  const flyTo = (pos: THREE.Vector3, target: THREE.Vector3, dur = 0.9) => {
    flight = {
      from: camera.position.clone(),
      to: pos,
      tFrom: controls.target.clone(),
      tTo: target,
      start: clock.getElapsedTime(),
      dur,
    };
  };
  let userMoved = false;
  const stopAuto = () => {
    userMoved = true;
    controls.autoRotate = false;
  };
  controls.addEventListener('start', () => {
    flight = null;
    stopAuto();
  });

  // ── Picking ──
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickables = nodes.flatMap((n) => n.meshes);
  const byId = new Map(nodes.map((n) => [n.step.id, n]));
  let hovered: NodeRef | null = null;
  let selected: NodeRef | null = null;
  const pick = (ev: PointerEvent | MouseEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? (byId.get(hit.object.userData.stepId as string) ?? null) : null;
  };
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse') return;
    const n = pick(ev);
    if (n !== hovered) {
      hovered = n;
      renderer.domElement.style.cursor = n ? 'pointer' : 'grab';
      o.onHover(n?.step ?? null);
    }
  };
  let down: { x: number; y: number } | null = null;
  const onDown = (ev: PointerEvent) => {
    down = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (ev: PointerEvent) => {
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) return;
    down = null;
    const n = pick(ev);
    select(n);
  };
  const onDbl = (ev: MouseEvent) => {
    const n = pick(ev);
    if (n) o.onOpen(n.step);
  };
  const onLeave = () => {
    hovered = null;
    o.onHover(null);
  };
  const canvas = renderer.domElement;
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('dblclick', onDbl);
  canvas.addEventListener('pointerleave', onLeave);

  const anchorOf = (n: NodeRef, out = new THREE.Vector3()) =>
    n.object.getWorldPosition(out).add(new THREE.Vector3(0, n.lift, 0));

  function select(n: NodeRef | null) {
    selected = n;
    o.onSelect(n?.step ?? null);
    if (!n) return;
    stopAuto();
    const target = anchorOf(n).sub(new THREE.Vector3(0, n.lift * 0.6, 0));
    const offset = camera.position.clone().sub(controls.target);
    const dist = Math.min(offset.length(), Math.max(radius * 0.55, 6));
    flyTo(target.clone().add(offset.normalize().multiplyScalar(dist)), target);
  }

  // ── Loop ──
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  const place = (elx: HTMLElement, world: THREE.Vector3, show: boolean) => {
    v.copy(world).project(camera);
    const visible = show && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    elx.style.opacity = visible ? '1' : '0';
    if (visible) {
      const x = ((v.x + 1) / 2) * width();
      const y = ((1 - v.y) / 2) * height();
      elx.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
  };
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();

    for (const a of appearing) {
      const k = THREE.MathUtils.clamp((t - 0.15 - a.delay) / 0.55, 0, 1);
      const e = k === 1 ? 1 : 1 - Math.pow(1 - k, 3) * Math.cos(k * 4.2); // soft overshoot
      if (a.mode === 'grow') a.o.scale.set(a.to.x, Math.max(a.to.y * e, 0.0001), a.to.z);
      else a.o.scale.copy(a.to).multiplyScalar(Math.max(e, 0.0001));
    }
    build.tick?.(t);

    // intro glide, then explicit flights
    if (!userMoved && !flight && t < 2.2) {
      const k = THREE.MathUtils.smoothstep(t / 2.2, 0, 1);
      const h = home();
      camera.position.lerp(h.pos, 0.02 + k * 0.08);
      if (t > 2.1) controls.autoRotate = build.orbit !== 'front';
    }
    if (flight) {
      const k = THREE.MathUtils.clamp((t - flight.start) / flight.dur, 0, 1);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(flight.from, flight.to, e);
      controls.target.lerpVectors(flight.tFrom, flight.tTo, e);
      if (k === 1) flight = null;
    }

    for (const n of nodes) {
      const isHover = n === hovered || n === selected;
      const isNext = n === nextNode;
      for (const m of n.meshes) {
        m.material.emissive.setHex(m.material.color.getHex());
        m.material.emissiveIntensity = isHover
          ? 0.55
          : isNext
            ? 0.2 + Math.sin(t * 3) * 0.15
            : o.dark
              ? 0.18
              : 0.04;
      }
    }
    if (nextNode) {
      anchorOf(nextNode, pin.position);
      pin.position.y += 0.35 + Math.sin(t * 2.4) * 0.18;
      pin.rotation.y = t * 1.5;
      place(o.pinEl, v.copy(pin.position).add(new THREE.Vector3(0, 1, 0)), true);
    } else o.pinEl.style.opacity = '0';
    for (const { ring, n } of rings) {
      anchorOf(n, ring.position);
      ring.position.y -= n.lift * 0.6;
      ring.lookAt(camera.position);
      const p = (t * 0.8) % 1;
      ring.scale.setScalar(0.8 + p * 1.4);
      ring.material.opacity = 1 - p;
    }
    const tipFor = hovered ?? selected;
    if (tipFor) place(o.tipEl, anchorOf(tipFor, new THREE.Vector3()), true);
    else o.tipEl.style.opacity = '0';

    controls.update();
    renderer.render(scene, camera);
  };
  loop();

  const resize = () => {
    camera.aspect = width() / height();
    camera.updateProjectionMatrix();
    renderer.setSize(width(), height());
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return {
    zoom(factor) {
      stopAuto();
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      const len = THREE.MathUtils.clamp(
        offset.length(),
        controls.minDistance,
        controls.maxDistance,
      );
      flyTo(controls.target.clone().add(offset.setLength(len)), controls.target.clone(), 0.45);
    },
    reset() {
      const h = home();
      selected = null;
      o.onSelect(null);
      flyTo(h.pos, h.target);
    },
    focus(stepId) {
      const n = byId.get(stepId);
      if (n) select(n);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('dblclick', onDbl);
      canvas.removeEventListener('pointerleave', onLeave);
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Points ||
          obj instanceof THREE.Sprite
        ) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
      (scene.background as THREE.Texture | null)?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
