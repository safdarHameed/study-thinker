import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { JourneyStep } from '@studythinker/shared';
import type { BuildCtx, Builder, Built } from './engine';
import {
  GROUP_COLORS,
  PALETTE,
  blob,
  cloud,
  label,
  mat,
  mesh,
  pine,
  rock,
  statusColor,
  tilt,
} from './kit';

/**
 * One builder per journey shape. Each makes a small, recognisable world:
 * the steps are the things you can click (fruit, stones, rungs, crystals…).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const isBoss = (s: JourneyStep) => s.kind === 'assessment' || s.kind === 'milestone';

function scatter(ctx: BuildCtx, root: THREE.Group, count: number, rMin: number, rMax: number) {
  for (let i = 0; i < count; i++) {
    const a = ctx.rng() * Math.PI * 2;
    const r = rMin + ctx.rng() * (rMax - rMin);
    const item = ctx.rng() < 0.75 ? pine(ctx.rng, ctx.dark) : rock(ctx.rng);
    item.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    root.add(item);
    ctx.appear(item, 0.2 + ctx.rng() * 0.6);
  }
}

// ───────────── Tree: a real tree; steps are blossoms that ripen into golden fruit ─────────────

/** A tube that narrows from r0 to r1 along a curve (a branch or trunk). */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  segs: number,
  radial: number,
  r0: number,
  r1: number,
) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, p);
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      n.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
      nor.push(n.x, n.y, n.z);
      pos.push(p.x + r * n.x, p.y + r * n.y, p.z + r * n.z);
    }
  }
  for (let i = 1; i <= segs; i++)
    for (let j = 1; j <= radial; j++) {
      const a = (radial + 1) * (i - 1) + (j - 1);
      const b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j;
      const d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const tree: Builder = (ctx) => {
  const root = new THREE.Group();
  const plant = new THREE.Group();
  root.add(plant);
  const rng = ctx.rng;
  const bark = mat(ctx.dark ? 0x6b4429 : 0x7a4e2d, { flatShading: false, roughness: 0.9 });
  const leafMats = (ctx.dark ? [0x2f9e52, 0x22803f] : [0x4cc35c, 0x34a853, 0x6fd46b]).map((c) =>
    mat(c, { flatShading: false, roughness: 0.7 }),
  );
  const leafGeo = new THREE.SphereGeometry(0.22, 10, 8);

  // The tree's shape *is* the journey: one main branch per part, one twig per step.
  const limbs =
    ctx.groups.length > 1
      ? ctx.groups
      : chunk(ctx.steps, Math.max(3, Math.ceil(ctx.steps.length / 4))).map((items) => ({
          name: '·',
          items,
        }));
  const G = limbs.length;

  const trunkH = 3.6 + Math.min(G, 6) * 0.25;
  const trunkCurve = new THREE.CatmullRomCurve3([
    V(0, 0, 0),
    V(0.1, trunkH * 0.35, 0),
    V(-0.08, trunkH * 0.7, 0),
    V(0, trunkH, 0),
  ]);
  const trunk = mesh(taperedTube(trunkCurve, 14, 14, 0.6, 0.34), bark);
  plant.add(trunk);
  ctx.appear(trunk, 0, 'grow');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const c = new THREE.QuadraticBezierCurve3(
      V(0, 0.6, 0),
      dir.clone().multiplyScalar(0.5).setY(0.12),
      dir.clone().multiplyScalar(1.3).setY(-0.05),
    );
    plant.add(mesh(taperedTube(c, 8, 8, 0.28, 0.05), bark));
  }

  const leafTuft = (at: THREE.Vector3, count: number, delay: number, spread = 0.32) => {
    const g = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const leaf = mesh(leafGeo, leafMats[i % leafMats.length]!);
      leaf.scale.set(1.5, 0.45, 0.9);
      const a = (i / count) * Math.PI * 2 + rng();
      leaf.position.set(Math.cos(a) * spread, 0.1 + rng() * 0.15, Math.sin(a) * spread);
      leaf.rotation.set(rng() * 0.6, -a, (rng() - 0.5) * 0.8);
      g.add(leaf);
    }
    g.position.copy(at);
    plant.add(g);
    ctx.appear(g, delay);
  };

  const stepAt = (s: JourneyStep, p: THREE.Vector3, delay: number) => {
    const g = new THREE.Group();
    if (s.status === 'todo') {
      const petal = mat(ctx.dark ? 0xf5b5e8 : 0xf9a8d4, { flatShading: false, roughness: 0.5 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const m = mesh(new THREE.SphereGeometry(0.2, 10, 8), petal);
        m.scale.set(1, 0.5, 1);
        m.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
        g.add(m);
      }
      g.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0xfacc15, { flatShading: false })));
      g.rotation.x = Math.PI / 2.4; // face the viewer
    } else {
      const ripe = s.status === 'done';
      const ball = mesh(
        isBoss(s) ? new THREE.OctahedronGeometry(0.5, 0) : new THREE.SphereGeometry(0.42, 20, 16),
        mat(ripe ? PALETTE.gold : 0xfb923c, {
          flatShading: false,
          roughness: 0.3,
          metalness: ripe ? 0.3 : 0,
        }),
      );
      g.add(ball);
    }
    g.position.copy(p);
    plant.add(g);
    ctx.node(s, g, 0.55);
    ctx.appear(g, delay);
  };

  let order = 0;
  limbs.forEach((limb, i) => {
    // Fan the main branches out towards the viewer so none hides another.
    const u = G === 1 ? 0 : i / (G - 1) - 0.5; // -0.5 … 0.5
    const lean = u * 2.3; // radians from straight up
    const startT = 0.55 + (0.5 - Math.abs(u)) * 0.8;
    const start = trunkCurve.getPoint(Math.min(startT, 1));
    const n = limb.items.length;
    const len = 2.8 + n * 0.55;
    const z = (i % 2 ? -1 : 1) * 0.6 * (G > 2 ? 1 : 0);
    const dir = V(Math.sin(lean), Math.cos(lean) * 0.9 + 0.25, z * 0.25).normalize();
    const end = start.clone().add(dir.clone().multiplyScalar(len));
    end.y += 0.6 + Math.abs(u) * 0.8; // branch tips reach up to the light
    end.z += z;
    const mid = start
      .clone()
      .lerp(end, 0.5)
      .add(V(0, -0.25 * Math.abs(u) * len * 0.3, 0));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const branch = mesh(taperedTube(curve, 14, 9, 0.3, 0.1), bark);
    plant.add(branch);
    ctx.appear(branch, 0.35 + i * 0.12);
    // the base of a branch sits inside the trunk; growing from there looks natural
    branch.geometry.translate(-start.x, -start.y, -start.z);
    branch.position.copy(start);

    // One twig per step, in order from the trunk outwards.
    limb.items.forEach((s, j) => {
      const t = 0.22 + (0.78 * (j + 1)) / (n + 0.4);
      const base = curve.getPoint(Math.min(t, 1));
      const tan = curve.getTangent(Math.min(t, 1));
      const side = j % 2 ? 1 : -1;
      const normal = V(-tan.y, tan.x, 0).normalize().multiplyScalar(side);
      const twigEnd = base
        .clone()
        .add(normal.multiplyScalar(0.85))
        .add(V(0, 0.15, (j % 3) - 1).multiplyScalar(0.35));
      const twig = mesh(taperedTube(new THREE.LineCurve3(base, twigEnd), 3, 6, 0.08, 0.04), bark);
      plant.add(twig);
      ctx.appear(twig, 0.9 + order * 0.05);
      leafTuft(twigEnd.clone().add(V(0, 0.18, -0.15)), 3, 1.0 + order * 0.05, 0.28);
      stepAt(s, twigEnd.clone().add(V(0, -0.38, 0.05)), 1.15 + order * 0.06);
      order++;
    });
    leafTuft(end, 5, 1.1 + i * 0.1, 0.4);
    if (limb.name !== '·') {
      const tag = label(limb.name, ctx.dark, 0.55);
      tag.position.copy(end).add(V(0, 0.95, 0));
      plant.add(tag);
    }
  });
  leafTuft(trunkCurve.getPoint(1).add(V(0, 0.2, 0)), 6, 1.0, 0.45);

  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const r = 2 + rng() * 6;
    const f = mesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      mat([0xfde047, 0xf9a8d4, 0xffffff, 0xc4b5fd][i % 4]!),
      false,
    );
    f.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
    root.add(f);
  }
  scatter(ctx, root, 5, 14, 24);
  return {
    root,
    env: 'meadow',
    view: [0, 0.18, 1],
    frame: plant,
    tick: (t) => {
      plant.rotation.z = Math.sin(t * 0.6) * 0.005;
    },
  };
};

// ───────────── Path: a winding road across a meadow; steps are stepping stones ─────────────

const path: Builder = (ctx) => {
  const root = new THREE.Group();
  const n = ctx.steps.length;
  const cols = Math.max(4, Math.min(7, Math.ceil(Math.sqrt(n * 1.6))));
  const pts = ctx.steps.map((_, i) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const u = row % 2 ? cols - 1 - c : c;
    return V((u - (cols - 1) / 2) * 3.4, 0.02, -row * 5 + Math.sin(i * 1.3) * 0.6);
  });
  const curve = new THREE.CatmullRomCurve3(
    pts.length > 1 ? pts : [pts[0]!, pts[0]!.clone().add(V(1))],
    false,
    'centripetal',
  );
  // flat ribbon road
  const samples = Math.max(40, n * 14);
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPoint(i / samples);
    const tg = curve.getTangent(i / samples);
    const side = V(-tg.z, 0, tg.x).normalize().multiplyScalar(1.15);
    pos.push(p.x + side.x, 0.03, p.z + side.z, p.x - side.x, 0.03, p.z - side.z);
    if (i < samples) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const road = mesh(g, mat(ctx.dark ? 0x5b5348 : PALETTE.sand, { side: THREE.DoubleSide }), false);
  root.add(road);

  let groupIdx = -1;
  let last = '';
  ctx.steps.forEach((s, i) => {
    const p = pts[i]!;
    const stone = new THREE.Group();
    const big = isBoss(s);
    const disc = mesh(
      new THREE.CylinderGeometry(big ? 1.05 : 0.8, big ? 1.15 : 0.9, 0.35, big ? 6 : 10),
      mat(statusColor(s.status, ctx.dark)),
    );
    disc.position.y = 0.17;
    stone.add(disc);
    if (big) {
      const star = mesh(
        new THREE.OctahedronGeometry(0.4, 0),
        mat(PALETTE.gold, { metalness: 0.3 }),
      );
      star.position.y = 0.85;
      stone.add(star);
    }
    stone.position.copy(p);
    root.add(stone);
    ctx.node(s, stone, 0.5);
    ctx.appear(stone, 0.1 + i * 0.06);
    if ((s.group ?? '') !== last) {
      last = s.group ?? '';
      groupIdx++;
      const flag = new THREE.Group();
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), mat(PALETTE.woodDark));
      pole.position.y = 1.1;
      const cloth = mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.04),
        mat(GROUP_COLORS[groupIdx % GROUP_COLORS.length]!),
      );
      cloth.position.set(0.48, 1.9, 0);
      flag.add(pole, cloth);
      flag.position.copy(p).add(V(-1.5, 0, 0.9));
      root.add(flag);
      ctx.appear(flag, 0.1 + i * 0.06);
    }
  });
  // trees along the way
  for (let k = 0; k < n * 1.4; k++) {
    const u = ctx.rng();
    const p = curve.getPoint(u);
    const tg = curve.getTangent(u);
    const side = V(-tg.z, 0, tg.x)
      .normalize()
      .multiplyScalar((ctx.rng() < 0.5 ? -1 : 1) * (2.6 + ctx.rng() * 3));
    const item = ctx.rng() < 0.8 ? pine(ctx.rng, ctx.dark) : rock(ctx.rng);
    item.position.copy(p).add(side).setY(0);
    if (pts.some((q) => q.distanceTo(item.position) < 2)) continue;
    root.add(item);
    ctx.appear(item, 0.3 + ctx.rng() * 0.8);
  }
  return { root, env: 'meadow', view: [0, 1.1, 1], zoom: 0.85 };
};

// ───────────── Ladder: ladders climbing from platform to platform; steps are rungs ─────────────

const ladder: Builder = (ctx) => {
  const root = new THREE.Group();
  const wood = mat(ctx.dark ? 0x6b4a2b : PALETTE.wood);
  const stone = mat(ctx.dark ? 0x4b5563 : 0xd6d3d1);
  let y = 0;
  let x = 0;
  ctx.groups.forEach((g, gi) => {
    const h = g.items.length * 1.05 + 0.6;
    for (const side of [-1, 1]) {
      const rail = mesh(new THREE.BoxGeometry(0.2, h, 0.2), wood);
      rail.position.set(x + side * 1.2, y + h / 2, 0);
      root.add(rail);
      ctx.appear(rail, gi * 0.3, 'pop');
    }
    g.items.forEach((s, i) => {
      const rung = mesh(
        new THREE.BoxGeometry(2.4, 0.22, 0.42),
        mat(statusColor(s.status, ctx.dark), { roughness: 0.4 }),
      );
      rung.position.set(x, y + 0.6 + i * 1.05, 0);
      root.add(rung);
      ctx.node(s, rung, 0.35);
      ctx.appear(rung, gi * 0.3 + i * 0.05 + 0.2);
    });
    y += h;
    const plat = mesh(new RoundedBoxGeometry(4.2, 0.4, 2.6, 2, 0.12), stone);
    const nx = gi % 2 ? x - 2.2 : x + 2.2;
    plat.position.set((x + nx) / 2, y + 0.2, -0.6);
    root.add(plat);
    ctx.appear(plat, gi * 0.3 + 0.2);
    x = nx;
    y += 0.4;
  });
  const star = mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    mat(PALETTE.gold, { metalness: 0.4, emissive: PALETTE.gold, emissiveIntensity: 0.3 }),
  );
  star.position.set(x, y + 1.4, -0.6);
  root.add(star);
  ctx.appear(star, ctx.groups.length * 0.3 + 0.3);
  for (let i = 0; i < 4; i++) {
    const c = cloud(ctx.rng, 1.2);
    c.position.set((ctx.rng() - 0.5) * 14 + x / 2, y * (0.4 + ctx.rng() * 0.6), -7 - ctx.rng() * 4);
    root.add(c);
  }
  scatter(ctx, root, 6, 5, 10);
  return {
    root,
    env: 'meadow',
    view: [0.35, 0.2, 1],
    frame: star,
    tick: (t) => {
      star.rotation.y = t;
    },
  };
};

// ───────────── Clusters: floating islands; steps are crystals ─────────────

const clusters: Builder = (ctx) => {
  const root = new THREE.Group();
  const islands: { g: THREE.Group; base: number; i: number }[] = [];
  const count = ctx.groups.length;
  const R = count === 1 ? 0 : 5 + count * 1.3;
  ctx.groups.forEach((grp, i) => {
    const g = new THREE.Group();
    const size = 1.8 + Math.sqrt(grp.items.length) * 0.75;
    const tint = GROUP_COLORS[i % GROUP_COLORS.length]!;
    const top = mesh(
      new THREE.CylinderGeometry(size, size * 0.92, 0.5, 9),
      mat(ctx.dark ? 0x2f6b3f : 0x86d46b),
    );
    const under = mesh(
      new THREE.ConeGeometry(size * 0.92, size * 1.5, 9),
      mat(ctx.dark ? 0x4a3b30 : 0xa07a55),
    );
    under.rotation.x = Math.PI;
    under.position.y = -0.25 - size * 0.75;
    const rim = mesh(new THREE.TorusGeometry(size * 0.98, 0.08, 6, 40), mat(tint));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.26;
    g.add(top, under, rim);
    grp.items.forEach((s, j) => {
      const a = (j / grp.items.length) * Math.PI * 2 + i;
      const rr = grp.items.length === 1 ? 0 : size * (j % 2 ? 0.45 : 0.68);
      const crystal = mesh(
        new THREE.OctahedronGeometry(isBoss(s) ? 0.55 : 0.42, 0),
        mat(statusColor(s.status, ctx.dark), { roughness: 0.2, metalness: 0.1 }),
      );
      crystal.scale.y = 1.7;
      crystal.position.set(Math.cos(a) * rr, 0.95, Math.sin(a) * rr);
      g.add(crystal);
      ctx.node(s, crystal, 0.6);
      ctx.appear(crystal, 0.3 + i * 0.15 + j * 0.05);
    });
    if (grp.name !== '·') {
      const tag = label(grp.name, ctx.dark, 0.9);
      tag.position.y = 2.6;
      g.add(tag);
    }
    const a = (i / count) * Math.PI * 2;
    const base = Math.sin(i * 1.7) * 1.6;
    g.position.set(Math.cos(a) * R, base, Math.sin(a) * R);
    root.add(g);
    ctx.appear(g, i * 0.15);
    islands.push({ g, base, i });
  });
  for (let i = 0; i < 6; i++) {
    const c = cloud(ctx.rng, 1 + ctx.rng());
    const a = ctx.rng() * Math.PI * 2;
    c.position.set(Math.cos(a) * (R + 4), -3 + ctx.rng() * 6, Math.sin(a) * (R + 4));
    root.add(c);
  }
  return {
    root,
    env: 'sky',
    view: [0, 0.7, 1],
    tick: (t) => {
      for (const s of islands) s.g.position.y = s.base + Math.sin(t * 0.7 + s.i) * 0.25;
    },
  };
};

// ───────────── Mind map: a glowing core with branches like neurons ─────────────

function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
  const mid = a
    .clone()
    .lerp(b, 0.5)
    .add(V(0, a.distanceTo(b) * 0.15, 0));
  return mesh(
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, r, 6),
    material,
    false,
  );
}

const mindmap: Builder = (ctx) => {
  const root = new THREE.Group();
  const keys = new Set(ctx.steps.map((s) => s.key));
  const center = ctx.steps.find((s) => !s.parentKey && s.kind === 'milestone') ?? ctx.steps[0]!;
  const rest = ctx.steps.filter((s) => s.id !== center.id);
  const roots = rest.filter(
    (s) => !s.parentKey || s.parentKey === center.key || !keys.has(s.parentKey),
  );
  const branches =
    roots.length === rest.length
      ? (() => {
          const gs = new Map<string, JourneyStep[]>();
          for (const s of rest) gs.set(s.group ?? '·', [...(gs.get(s.group ?? '·') ?? []), s]);
          return [...gs.values()].map((items) => ({ hub: null as JourneyStep | null, items }));
        })()
      : roots.map((r) => ({
          hub: r as JourneyStep | null,
          items: rest.filter((s) => s.parentKey === r.key),
        }));

  const core = mesh(
    new THREE.IcosahedronGeometry(1.5, 2),
    mat(PALETTE.primary, {
      flatShading: false,
      roughness: 0.25,
      emissive: PALETTE.primary,
      emissiveIntensity: 0.25,
    }),
  );
  root.add(core);
  ctx.node(center, core, 1.6);
  ctx.appear(core, 0);
  branches.forEach((b, i) => {
    const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
    const a = (i / branches.length) * Math.PI * 2;
    const hubPos = V(Math.cos(a) * 7, (i % 2 ? 1.8 : -1.4) + Math.sin(i) * 0.6, Math.sin(a) * 7);
    const nerve = mat(color, { emissive: color, emissiveIntensity: 0.25 });
    const t = tube(V(), hubPos, 0.13, nerve);
    root.add(t);
    ctx.appear(t, 0.2 + i * 0.1);
    const hub = mesh(
      new THREE.SphereGeometry(0.75, 20, 14),
      b.hub
        ? mat(statusColor(b.hub.status, ctx.dark), { flatShading: false })
        : mat(color, { flatShading: false }),
    );
    hub.position.copy(hubPos);
    root.add(hub);
    if (b.hub) ctx.node(b.hub, hub, 0.8);
    ctx.appear(hub, 0.4 + i * 0.1);
    const out = hubPos.clone().normalize();
    b.items.forEach((s, j) => {
      const spread = b.items.length === 1 ? 0 : (j / (b.items.length - 1) - 0.5) * 2.2;
      const dir = tilt(out, Math.abs(spread) * 0.6 + 0.15, spread >= 0 ? 0.6 + j : -0.6 - j);
      const p = hubPos.clone().add(dir.multiplyScalar(2.6 + (j % 2) * 0.9));
      root.add(tube(hubPos, p, 0.05, nerve));
      const leaf = mesh(
        isBoss(s) ? new THREE.OctahedronGeometry(0.45, 0) : new THREE.SphereGeometry(0.38, 16, 12),
        mat(statusColor(s.status, ctx.dark), { flatShading: false, roughness: 0.3 }),
      );
      leaf.position.copy(p);
      root.add(leaf);
      ctx.node(s, leaf, 0.45);
      ctx.appear(leaf, 0.6 + i * 0.1 + j * 0.05);
    });
  });
  return {
    root,
    env: 'space',
    view: [0, 0.65, 1],
    zoom: 0.85,
    tick: (t) => {
      core.scale.setScalar(core.scale.x > 0.99 ? 1 + Math.sin(t * 2) * 0.03 : core.scale.x);
    },
  };
};

// ───────────── Timeline: a rail through time with gates for each week ─────────────

const timeline: Builder = (ctx) => {
  const root = new THREE.Group();
  const items: { s: JourneyStep; x: number }[] = [];
  const gates: { name: string; x: number; i: number }[] = [];
  let x = 0;
  ctx.groups.forEach((g, gi) => {
    gates.push({ name: g.name, x: x - 0.9, i: gi });
    for (const s of g.items) {
      items.push({ s, x });
      x += 1.9;
    }
    x += 1.6;
  });
  const total = x - 1.6;
  const z = (px: number) => Math.sin(px * 0.11) * 2.5;
  const railPts = Array.from({ length: 60 }, (_, i) => {
    const px = -2 + (i / 59) * (total + 2);
    return V(px, 0.1, z(px));
  });
  const rail = mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 120, 0.12, 6),
    mat(PALETTE.primary, { emissive: PALETTE.primary, emissiveIntensity: 0.35 }),
    false,
  );
  root.add(rail);
  items.forEach(({ s, x: px }, i) => {
    const h = 0.5 + Math.min(s.minutes, 60) / 30;
    const block = mesh(
      new RoundedBoxGeometry(1.2, h, 1.2, 3, 0.18),
      mat(statusColor(s.status, ctx.dark), { flatShading: false, roughness: 0.4 }),
    );
    block.position.set(px, h / 2 + 0.15, z(px));
    if (isBoss(s)) block.rotation.y = Math.PI / 4;
    root.add(block);
    ctx.node(s, block, h / 2 + 0.2);
    ctx.appear(block, 0.1 + i * 0.05);
  });
  for (const g of gates) {
    const color = GROUP_COLORS[g.i % GROUP_COLORS.length]!;
    const arch = mesh(new THREE.TorusGeometry(1.9, 0.12, 8, 30, Math.PI), mat(color));
    arch.position.set(g.x, 0, z(g.x));
    arch.rotation.y = Math.PI / 2 - Math.atan(Math.cos(g.x * 0.11) * 0.275);
    root.add(arch);
    ctx.appear(arch, 0.1 + g.i * 0.2);
    if (g.name !== '·') {
      const tag = label(g.name, ctx.dark, 0.55);
      tag.position.set(g.x, 2.5, z(g.x));
      root.add(tag);
    }
  }
  root.position.x = -total / 2;
  return { root, env: 'studio', view: [0.15, 0.55, 1], zoom: 0.8 };
};

// ───────────── Spiral: a staircase winding upward, tighter each round ─────────────

const spiral: Builder = (ctx) => {
  const root = new THREE.Group();
  const rounds =
    ctx.groups.length > 1 ? ctx.groups : chunk(ctx.steps, 8).map((items) => ({ name: '·', items }));
  const post = mat(ctx.dark ? 0x94a3b8 : 0xcbd5e1, { metalness: 0.3 });
  let order = 0;
  let topY = 1;
  rounds.forEach((r, ri) => {
    const color = GROUP_COLORS[ri % GROUP_COLORS.length]!;
    r.items.forEach((s, j) => {
      const u = ri + j / r.items.length;
      const ang = u * Math.PI * 2;
      const rad = Math.max(4.2 - ri * 0.7, 2.4);
      const y = u * 2.6 + 0.4;
      topY = y;
      const stair = new THREE.Group();
      const slab = mesh(
        new RoundedBoxGeometry(2.4, 0.32, 1.35, 2, 0.08),
        mat(statusColor(s.status, ctx.dark), { flatShading: false }),
      );
      slab.position.x = rad;
      const edge = mesh(new THREE.BoxGeometry(0.12, 0.34, 1.36), mat(color));
      edge.position.x = rad + 1.2;
      const arm = mesh(new THREE.CylinderGeometry(0.06, 0.06, rad - 0.8, 6), post);
      arm.rotation.z = Math.PI / 2;
      arm.position.x = (rad - 0.8) / 2 + 0.4;
      stair.add(slab, edge, arm);
      stair.position.y = y;
      stair.rotation.y = -ang;
      root.add(stair);
      ctx.node(s, slab, 0.3);
      ctx.appear(stair, 0.1 + order++ * 0.05);
    });
  });
  const height = topY + 1.2;
  const column = mesh(
    new THREE.CylinderGeometry(0.4, 0.55, height, 16),
    mat(ctx.dark ? 0x475569 : 0xe2e8f0, { flatShading: false, metalness: 0.2 }),
  );
  column.position.y = height / 2;
  root.add(column);
  ctx.appear(column, 0, 'grow');
  const base = mesh(
    new THREE.CylinderGeometry(5.2, 5.6, 0.3, 40),
    mat(ctx.dark ? 0x334155 : 0xf1f5f9),
  );
  base.position.y = 0.15;
  root.add(base);
  const gem = mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    mat(PALETTE.gold, { metalness: 0.4, emissive: PALETTE.gold, emissiveIntensity: 0.3 }),
  );
  gem.position.y = height + 0.9;
  root.add(gem);
  return {
    root,
    env: 'studio',
    view: [0.6, 0.45, 1],
    frame: gem,
    tick: (t) => {
      gem.rotation.y = t;
      gem.position.y = height + 0.9 + Math.sin(t * 1.5) * 0.15;
    },
  };
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ───────────── Quest: an island mountain; the trail climbs to a castle ─────────────

const quest: Builder = (ctx) => {
  const root = new THREE.Group();
  const R = 12;
  const H = 8;
  const h = (r: number) => (r < R ? H * Math.pow(1 - r / R, 1.15) : 0);
  const profile: THREE.Vector2[] = [new THREE.Vector2(0, H + 0.01)];
  for (let i = 1; i <= 24; i++) {
    const r = (i / 24) * R;
    profile.push(new THREE.Vector2(r, h(r)));
  }
  profile.push(new THREE.Vector2(R + 2.5, -0.1), new THREE.Vector2(R + 3.5, -0.6));
  const land = mesh(
    new THREE.LatheGeometry(profile.reverse(), 28),
    mat(ctx.dark ? 0x2f5d3a : 0x7ccf6a),
    true,
  );
  root.add(land);
  const beach = mesh(
    new THREE.CylinderGeometry(R + 2.6, R + 3.4, 0.4, 28),
    mat(ctx.dark ? 0x6b6046 : PALETTE.sand),
    false,
  );
  beach.position.y = -0.3;
  root.add(beach);

  const n = ctx.steps.length;
  const last = ctx.steps[n - 1]!;
  const castle = isBoss(last);
  const trail: THREE.Vector3[] = [];
  ctx.steps.forEach((s, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const r = (R - 1.2) * (1 - t) + (castle ? 0 : 0.6) * t;
    const ang = t * Math.PI * 2 * 1.75 + 0.4;
    const p = V(Math.cos(ang) * r, h(r), Math.sin(ang) * r);
    trail.push(p.clone().setY(p.y + 0.3));
    if (castle && s.id === last.id) return;
    const flag = new THREE.Group();
    const base = mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.25, 8),
      mat(statusColor(s.status, ctx.dark)),
    );
    base.position.y = 0.12;
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), mat(0xf5f5f4));
    pole.position.y = 0.85;
    const shape = new THREE.Shape([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.75, -0.22),
      new THREE.Vector2(0, -0.45),
    ]);
    const cloth = mesh(
      new THREE.ShapeGeometry(shape),
      mat(
        s.status === 'done' ? PALETTE.done : s.status === 'in_progress' ? PALETTE.doing : 0xef4444,
        { side: THREE.DoubleSide },
      ),
    );
    cloth.position.set(0.04, 1.6, 0);
    flag.add(base, pole, cloth);
    flag.position.copy(p);
    root.add(flag);
    ctx.node(s, flag, 1.5);
    ctx.appear(flag, 0.2 + i * 0.06);
  });
  if (trail.length > 1) {
    const path = mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trail), trail.length * 10, 0.16, 5),
      mat(ctx.dark ? 0x8b7d5a : PALETTE.sand),
      false,
    );
    root.add(path);
  }
  if (castle) {
    const c = new THREE.Group();
    const wall = mat(ctx.dark ? 0x9ca3af : 0xe7e5e4);
    const roof = mat(
      statusColor(last.status, ctx.dark) === (ctx.dark ? PALETTE.todoDark : PALETTE.todoLight)
        ? 0xdc2626
        : statusColor(last.status, ctx.dark),
    );
    const keep = mesh(new THREE.BoxGeometry(1.8, 1.6, 1.8), wall);
    keep.position.y = 0.8;
    c.add(keep);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const tower = mesh(new THREE.CylinderGeometry(0.38, 0.42, 2.4, 8), wall);
      tower.position.set(dx * 1, 1.2, dz * 1);
      const cone = mesh(new THREE.ConeGeometry(0.55, 0.9, 8), roof);
      cone.position.set(dx * 1, 2.85, dz * 1);
      c.add(tower, cone);
    }
    c.position.set(0, H - 0.1, 0);
    root.add(c);
    ctx.node(last, c, 3.2);
    ctx.appear(c, 0.4 + n * 0.06);
  }
  for (let i = 0; i < 18; i++) {
    const a = ctx.rng() * Math.PI * 2;
    const r = 2.5 + ctx.rng() * (R - 2);
    const p = V(Math.cos(a) * r, h(r), Math.sin(a) * r);
    if (trail.some((q) => q.distanceTo(p) < 1.6)) continue;
    const tr = pine(ctx.rng, ctx.dark, 0.8);
    tr.position.copy(p);
    root.add(tr);
    ctx.appear(tr, 0.2 + ctx.rng() * 0.6);
  }
  return { root, env: 'sea', view: [0.4, 0.75, 1], zoom: 0.9 };
};

// ───────────── Project: a building going up, one floor per milestone ─────────────

const project: Builder = (ctx) => {
  const root = new THREE.Group();
  const floorH = 2.2;
  let order = 0;
  ctx.groups.forEach((g, fi) => {
    const y = fi * floorH;
    const allTodo = g.items.every((s) => s.status === 'todo');
    const slab = mesh(
      new THREE.BoxGeometry(6.4, 0.25, 6.4),
      mat(ctx.dark ? 0x6b7280 : 0xd4d4d8, allTodo ? { transparent: true, opacity: 0.45 } : {}),
    );
    slab.position.y = y;
    root.add(slab);
    ctx.appear(slab, fi * 0.3);
    for (const [cx, cz] of [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ] as const) {
      const pillar = mesh(
        new THREE.BoxGeometry(0.3, floorH, 0.3),
        mat(ctx.dark ? 0x9ca3af : 0xe5e7eb, allTodo ? { transparent: true, opacity: 0.4 } : {}),
      );
      pillar.position.set(cx, y + floorH / 2, cz);
      root.add(pillar);
      ctx.appear(pillar, fi * 0.3 + 0.1, 'grow');
    }
    const per = g.items.length;
    g.items.forEach((s, j) => {
      // walk the square's edge
      const u = (j / per) * 4;
      const side = Math.floor(u);
      const f = (u - side) * 4.8 - 2.4;
      const [bx, bz] =
        side === 0 ? [f, -2.4] : side === 1 ? [2.4, f] : side === 2 ? [-f, 2.4] : [-2.4, -f];
      const solid = s.status !== 'todo';
      const block = mesh(
        new RoundedBoxGeometry(1.15, 1.7, 1.15, 2, 0.08),
        mat(
          s.status === 'done'
            ? 0xf97316
            : s.status === 'in_progress'
              ? PALETTE.doing
              : ctx.dark
                ? 0x93c5fd
                : 0x60a5fa,
          solid ? { flatShading: false } : { transparent: true, opacity: 0.35, flatShading: false },
        ),
      );
      block.position.set(bx, y + 0.98, bz);
      root.add(block);
      if (!solid) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(block.geometry, 30),
          new THREE.LineBasicMaterial({ color: ctx.dark ? 0x93c5fd : 0x2563eb }),
        );
        block.add(edges);
      }
      ctx.node(s, block, 0.9);
      ctx.appear(block, fi * 0.3 + 0.15 + (order++ % 12) * 0.03);
    });
  });
  const topY = ctx.groups.length * floorH;
  const roof = mesh(
    new THREE.BoxGeometry(6.4, 0.25, 6.4),
    mat(ctx.dark ? 0x6b7280 : 0xd4d4d8, { transparent: true, opacity: 0.25 }),
  );
  roof.position.y = topY;
  root.add(roof);
  // crane
  const steel = mat(0xfacc15, { metalness: 0.3 });
  const mast = mesh(new THREE.BoxGeometry(0.4, topY + 4, 0.4), steel);
  mast.position.set(5, (topY + 4) / 2, -4);
  const jib = new THREE.Group();
  const arm = mesh(new THREE.BoxGeometry(9, 0.35, 0.35), steel);
  arm.position.x = -2.5;
  const cable = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.5, 4), mat(0x374151));
  cable.position.set(-5.5, -1.25, 0);
  const hook = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0xf97316));
  hook.position.set(-5.5, -2.6, 0);
  jib.add(arm, cable, hook);
  jib.position.set(5, topY + 4, -4);
  root.add(mast, jib);
  ctx.appear(mast, 0, 'grow');
  ctx.appear(jib, 0.4);
  for (let i = 0; i < 5; i++) {
    const r = rock(ctx.rng, 1.2);
    r.position.set(-6 + ctx.rng() * 3, 0, 3 + ctx.rng() * 3);
    root.add(r);
  }
  return {
    root,
    env: 'meadow',
    view: [0.8, 0.55, 1],
    frame: roof,
    tick: (t) => {
      jib.rotation.y = Math.sin(t * 0.3) * 0.5;
    },
  };
};

// ───────────── Chapters: a bookshelf; each step is a book ─────────────

const chapters: Builder = (ctx) => {
  const root = new THREE.Group();
  const widest = Math.max(...ctx.groups.map((g) => g.items.length));
  const W = Math.max(widest * 0.62 + 1, 4);
  const shelfH = 2.3;
  const H = ctx.groups.length * shelfH + 0.4;
  const wood = mat(ctx.dark ? 0x5b3a22 : 0xb7835a);
  const back = mesh(new THREE.BoxGeometry(W + 0.5, H, 0.2), mat(ctx.dark ? 0x3b2616 : 0x8a5a3a));
  back.position.set(0, H / 2, -0.75);
  root.add(back);
  for (const sx of [-1, 1]) {
    const side = mesh(new THREE.BoxGeometry(0.25, H, 1.6), wood);
    side.position.set((sx * (W + 0.25)) / 2, H / 2, 0);
    root.add(side);
  }
  const hues = [0.62, 0.0, 0.33, 0.08, 0.75, 0.52, 0.92, 0.15];
  ctx.groups.forEach((g, gi) => {
    const y = H - 0.2 - (gi + 1) * shelfH;
    const plank = mesh(new THREE.BoxGeometry(W, 0.18, 1.5), wood);
    plank.position.set(0, y, 0);
    root.add(plank);
    let x = -W / 2 + 0.45;
    g.items.forEach((s, j) => {
      const bw = 0.42 + ctx.rng() * 0.16;
      const bh = 1.35 + ctx.rng() * 0.5;
      const hue = hues[gi % hues.length]!;
      const color = new THREE.Color().setHSL(
        hue,
        s.status === 'todo' ? 0.25 : 0.7,
        s.status === 'todo' ? (ctx.dark ? 0.45 : 0.78) : 0.5,
      );
      const book = mesh(
        new RoundedBoxGeometry(bw, bh, 1.05, 2, 0.04),
        mat(color.getHex(), { flatShading: false, roughness: 0.6 }),
      );
      book.position.set(x + bw / 2, y + 0.09 + bh / 2, s.status === 'in_progress' ? 0.3 : 0);
      if (s.status === 'done') {
        const band = mesh(
          new THREE.BoxGeometry(bw + 0.01, 0.1, 1.06),
          mat(PALETTE.gold, { metalness: 0.5 }),
        );
        band.position.y = bh / 2 - 0.25;
        book.add(band);
      }
      root.add(book);
      ctx.node(s, book, bh / 2 + 0.1);
      ctx.appear(book, 0.1 + gi * 0.2 + j * 0.04);
      x += bw + 0.05;
    });
  });
  const topPlank = mesh(new THREE.BoxGeometry(W + 0.5, 0.2, 1.6), wood);
  topPlank.position.y = H;
  root.add(topPlank);
  const plant = blob(0.6, ctx.dark ? 0x166534 : 0x22c55e, ctx.rng, 3);
  const pot = mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 10), mat(0xf97316));
  pot.position.set(W / 2 - 0.5, H + 0.4, 0);
  plant.position.set(W / 2 - 0.5, H + 1.0, 0);
  root.add(pot, plant);
  return { root, env: 'studio', view: [0.2, 0.15, 1], orbit: 'front', frame: topPlank };
};

// ───────────── Board: three whiteboards with sticky notes ─────────────

const board: Builder = (ctx) => {
  const root = new THREE.Group();
  const cols = [
    { status: 'todo' as const, name: 'To learn' },
    { status: 'in_progress' as const, name: 'Learning' },
    { status: 'done' as const, name: 'Done' },
  ];
  const tallest = Math.max(
    1,
    ...cols.map((c) => ctx.steps.filter((s) => s.status === c.status).length),
  );
  const rows = Math.ceil(tallest / 2);
  const BH = Math.max(rows * 1.25 + 0.8, 3.5);
  cols.forEach((c, ci) => {
    const x = (ci - 1) * 5;
    const boardMesh = mesh(
      new RoundedBoxGeometry(4.4, BH, 0.18, 2, 0.06),
      mat(ctx.dark ? 0x1f2937 : 0xffffff, { flatShading: false }),
    );
    boardMesh.position.set(x, 1.4 + BH / 2, 0);
    root.add(boardMesh);
    for (const lx of [-1.8, 1.8]) {
      const leg = mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.6 + BH / 2, 6),
        mat(0x9ca3af, { metalness: 0.5 }),
      );
      leg.position.set(x + lx, (1.6 + BH / 2) / 2, -0.15);
      root.add(leg);
    }
    const tag = label(c.name, ctx.dark, 0.6);
    tag.position.set(x, 1.4 + BH + 0.55, 0.1);
    root.add(tag);
    ctx.appear(boardMesh, ci * 0.15);
    ctx.steps
      .filter((s) => s.status === c.status)
      .forEach((s, j) => {
        const note = mesh(
          new THREE.BoxGeometry(1.7, 1.05, 0.06),
          mat(c.status === 'done' ? 0x86efac : c.status === 'in_progress' ? 0xfde047 : 0xc7d2fe, {
            roughness: 0.9,
          }),
        );
        note.position.set(
          x + (j % 2 ? 0.95 : -0.95),
          1.4 + BH - 0.75 - Math.floor(j / 2) * 1.25,
          0.14,
        );
        note.rotation.z = (ctx.rng() - 0.5) * 0.12;
        root.add(note);
        ctx.node(s, note, 0.45);
        ctx.appear(note, 0.3 + ci * 0.15 + j * 0.04);
      });
  });
  return { root, env: 'studio', view: [0, 0.25, 1], orbit: 'front' };
};

// ───────────── Concept web: a floating network of ideas ─────────────

/** Evenly spread points on a sphere. */
function fibonacci(i: number, n: number, radius: number) {
  const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996;
  return V(Math.cos(a) * r * radius, y * radius * 0.75, Math.sin(a) * r * radius);
}

const web: Builder = (ctx) => {
  const root = new THREE.Group();
  const idx = new Map(ctx.steps.map((s, i) => [s.key, i]));
  const edges = new Set<string>();
  const link = (a: number, b: number) => a !== b && edges.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  ctx.steps.forEach((s, i) => {
    for (const d of s.dependsOn) {
      const j = idx.get(d);
      if (j !== undefined) link(j, i);
    }
  });
  // Ideas in the same group are related; neighbouring groups touch.
  const pos: THREE.Vector3[] = [];
  const groupOf: number[] = [];
  const G = ctx.groups.length;
  ctx.groups.forEach((g, gi) => {
    const c = G === 1 ? V() : fibonacci(gi, G, 3.2 + G * 0.9);
    g.items.forEach((s, j) => {
      const i = idx.get(s.key)!;
      pos[i] = c.clone().add(fibonacci(j, g.items.length, 1.2 + Math.sqrt(g.items.length) * 0.7));
      groupOf[i] = gi;
      if (j > 0) link(idx.get(g.items[j - 1]!.key)!, i);
    });
    if (gi > 0) link(idx.get(ctx.groups[gi - 1]!.items.at(-1)!.key)!, idx.get(g.items[0]!.key)!);
  });
  for (const e of edges) {
    const [a, b] = e.split('-').map(Number) as [number, number];
    const color =
      groupOf[a] === groupOf[b] ? GROUP_COLORS[groupOf[a]! % GROUP_COLORS.length]! : 0x94a3b8;
    root.add(
      tube(pos[a]!, pos[b]!, 0.045, mat(color, { emissive: color, emissiveIntensity: 0.3 })),
    );
  }
  ctx.steps.forEach((s, i) => {
    const color = statusColor(s.status, ctx.dark);
    const ball = mesh(
      isBoss(s) ? new THREE.OctahedronGeometry(0.6, 0) : new THREE.SphereGeometry(0.45, 20, 16),
      mat(color, { flatShading: false, roughness: 0.3 }),
    );
    const halo = mesh(
      new THREE.TorusGeometry(0.66, 0.05, 6, 32),
      mat(GROUP_COLORS[groupOf[i]! % GROUP_COLORS.length]!),
    );
    halo.rotation.x = Math.PI / 2;
    ball.add(halo);
    ball.position.copy(pos[i]!);
    root.add(ball);
    ctx.node(s, ball, 0.55);
    ctx.appear(ball, 0.1 + i * 0.04);
  });
  return { root, env: 'space', view: [0.2, 0.45, 1] };
};

export const SCENES: Record<string, Builder> = {
  path,
  ladder,
  tree,
  clusters,
  mindmap,
  timeline,
  spiral,
  quest,
  project,
  chapters,
  board,
  web,
};

export type { Built };
