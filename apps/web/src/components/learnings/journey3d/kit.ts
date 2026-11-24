import * as THREE from 'three';
import type { JourneyStep } from '@studythinker/shared';

/** Small building blocks shared by every journey scene. */

export type Status = JourneyStep['status'];

export const PALETTE = {
  primary: 0x6366f1,
  highlight: 0xec4899,
  done: 0x22c55e,
  doing: 0xf59e0b,
  gold: 0xfacc15,
  todoLight: 0xdfe3fb,
  todoDark: 0x7c84a8,
  wood: 0x9a6a3f,
  woodDark: 0x6b4423,
  rock: 0x9ca3af,
  sand: 0xe9d8a6,
};

export const GROUP_COLORS = [
  0x6366f1, 0x06b6d4, 0xf59e0b, 0xec4899, 0x10b981, 0x8b5cf6, 0xef4444, 0x14b8a6,
];

export function statusColor(status: Status, dark: boolean) {
  if (status === 'done') return PALETTE.done;
  if (status === 'in_progress') return PALETTE.doing;
  return dark ? PALETTE.todoDark : PALETTE.todoLight;
}

/** Deterministic random numbers so a learning's scene looks the same every visit. */
export function seeded(seedText: string) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, flatShading: true, ...opts });
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A tapered limb from `start` pointing along `dir`; its pivot is the base so it can "grow". */
export function limb(
  start: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  rBottom: number,
  rTop: number,
  material: THREE.Material,
  sides = 7,
) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, length, sides);
  geo.translate(0, length / 2, 0);
  const m = mesh(geo, material);
  m.position.copy(start);
  m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  return m;
}

/** A direction tilted away from `dir` by `angle`, turned around it by `azimuth`. */
export function tilt(dir: THREE.Vector3, angle: number, azimuth: number) {
  const d = dir.clone().normalize();
  const helper = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP;
  const a = new THREE.Vector3().crossVectors(d, helper).normalize();
  const b = new THREE.Vector3().crossVectors(d, a).normalize();
  const side = a.multiplyScalar(Math.cos(azimuth)).add(b.multiplyScalar(Math.sin(azimuth)));
  return d
    .multiplyScalar(Math.cos(angle))
    .add(side.multiplyScalar(Math.sin(angle)))
    .normalize();
}

/** Puffy low-poly blob (foliage, clouds, bushes). */
export function blob(radius: number, color: number, rng: () => number, puffs = 3, opts = {}) {
  const g = new THREE.Group();
  const material = mat(color, opts);
  for (let i = 0; i < puffs; i++) {
    const r = radius * (i === 0 ? 1 : 0.55 + rng() * 0.3);
    const m = mesh(new THREE.IcosahedronGeometry(r, 0), material);
    if (i > 0) {
      const a = rng() * Math.PI * 2;
      m.position.set(
        Math.cos(a) * radius * 0.75,
        (rng() - 0.3) * radius * 0.5,
        Math.sin(a) * radius * 0.75,
      );
    }
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    g.add(m);
  }
  return g;
}

export function cloud(rng: () => number, scale = 1) {
  const c = blob(1.1 * scale, 0xffffff, rng, 4, { roughness: 1, transparent: true, opacity: 0.95 });
  c.scale.y = 0.6;
  c.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  return c;
}

/** A small decorative low-poly tree. */
export function pine(rng: () => number, dark: boolean, scale = 1) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 5), mat(PALETTE.woodDark));
  trunk.position.y = 0.4;
  g.add(trunk);
  const green = dark ? 0x166534 : [0x4ade80, 0x22c55e, 0x16a34a][Math.floor(rng() * 3)]!;
  for (let i = 0; i < 2; i++) {
    const cone = mesh(new THREE.ConeGeometry(0.75 - i * 0.2, 1.1, 6), mat(green));
    cone.position.y = 1.05 + i * 0.55;
    cone.rotation.y = rng() * 3;
    g.add(cone);
  }
  g.scale.setScalar(scale * (0.8 + rng() * 0.5));
  return g;
}

export function rock(rng: () => number, scale = 1) {
  const r = mesh(new THREE.DodecahedronGeometry(0.5 * scale, 0), mat(PALETTE.rock));
  r.scale.set(1 + rng() * 0.6, 0.6 + rng() * 0.4, 1 + rng() * 0.4);
  r.rotation.y = rng() * 3;
  return r;
}

/** A crisp text label that always faces the camera. Used sparingly. */
export function label(text: string, dark: boolean, size = 0.7) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.font = font;
  const short = text.length > 28 ? `${text.slice(0, 27)}…` : text;
  const w = Math.ceil(ctx.measureText(short).width) + 64;
  const h = 104;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = dark ? 'rgba(17,24,39,0.82)' : 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, h - 4, 50);
  ctx.fill();
  ctx.fillStyle = dark ? '#e5e7eb' : '#1f2937';
  ctx.textBaseline = 'middle';
  ctx.fillText(short, 32, h / 2 + 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.set((w / h) * size, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Vertical gradient used as the sky behind a scene. */
export function gradientTexture(top: string, bottom: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function groupsOf(steps: JourneyStep[]) {
  const map = new Map<string, JourneyStep[]>();
  for (const s of steps) {
    const g = s.group?.trim() || '·';
    map.set(g, [...(map.get(g) ?? []), s]);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}
