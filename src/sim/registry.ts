import type { BodyJson, PhysicalJson } from '@/data/schema';
import { JD_J2000, gmToInternal } from '@/data/constants';
import type { BodyDef, SystemState, Vec3 } from '@/physics/types';
import { perihelionState } from '@/physics/orbit';
import { createState, recenterToBarycenter } from '@/physics/system';

const bodyFiles = import.meta.glob<BodyJson>('/src/data/bodies/*.json', {
  eager: true,
  import: 'default',
});

const physicalFiles = import.meta.glob<PhysicalJson>('/src/data/physical/*.json', {
  eager: true,
  import: 'default',
});

const physicalById = new Map<string, PhysicalJson>();
for (const [path, data] of Object.entries(physicalFiles)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match) physicalById.set(match[1]!, data);
}

export interface SystemModel {
  ids: string[];
  names: string[];
  radiusKm: number[];
  colors: string[];
  epochJd: number; // JD (TDB) at which state.t = 0
  state: SystemState; // internal units, barycentric
  physical: PhysicalJson[];
  physicalMap: Record<string, PhysicalJson>;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];

export function buildDefs(list: readonly BodyJson[]): BodyDef[] {
  const byId = new Map<string, BodyJson>();
  for (const b of list) {
    if (byId.has(b.id)) throw new Error(`Duplicate body id "${b.id}"`);
    byId.set(b.id, b);
  }
  const done = new Map<string, BodyDef>();

  const build = (b: BodyJson, stack: string[]): BodyDef => {
    const cached = done.get(b.id);
    if (cached) return cached;
    if (stack.includes(b.id)) throw new Error(`Parent cycle: ${[...stack, b.id].join(' > ')}`);

    const gm = gmToInternal(b.gmKm3S2);
    const base = { id: b.id, name: b.name, gm, radiusKm: b.radiusKm };
    let def: BodyDef;
    switch (b.initial.type) {
      case 'root':
        def = { ...base, position: [0, 0, 0], velocity: [0, 0, 0] };
        break;
      case 'vectors':
        def = { ...base, position: b.initial.position, velocity: b.initial.velocity };
        break;
      case 'elements': {
        const init = b.initial;
        const pj = byId.get(init.parent);
        if (!pj) throw new Error(`${b.id}: unknown parent "${init.parent}"`);
        const parent = build(pj, [...stack, b.id]);
        const rel = perihelionState(
          parent.gm + gm,
          init.aAu,
          init.e,
          (init.incDeg * Math.PI) / 180,
        );
        def = {
          ...base,
          parent: init.parent,
          position: add(parent.position, rel.pos),
          velocity: add(parent.velocity, rel.vel),
        };
        break;
      }
    }
    done.set(b.id, def);
    return def;
  };

  return list.map((b) => build(b, [])).sort((a, b) => b.gm - a.gm); // heaviest (Sun) first
}

export function loadSystem(list: readonly BodyJson[] = Object.values(bodyFiles)): SystemModel {
  const epochs = new Set<number>();
  for (const b of list) if (b.initial.type === 'vectors') epochs.add(b.initial.epochJd);
  if (epochs.size > 1) throw new Error(`Bodies have different epochs: ${[...epochs].join(', ')}`);

  const defs = buildDefs(list);
  const meta = new Map(list.map((b) => [b.id, b]));
  const state = createState(defs);
  // Real Horizons vectors are already in the true SSB frame (which includes Pluto and
  // asteroids missing from this system, ~3e-7 AU ≈ 45 km of offset): do not shift them.
  if (epochs.size === 0) recenterToBarycenter(state);

  return {
    ids: defs.map((d) => d.id),
    names: defs.map((d) => d.name),
    radiusKm: defs.map((d) => d.radiusKm),
    colors: defs.map((d) => meta.get(d.id)!.color),
    epochJd: epochs.size ? [...epochs][0]! : JD_J2000,
    state,
    physical: defs.map((d) => physicalById.get(d.id) ?? {}),
    physicalMap: Object.fromEntries(physicalById),
  };
}
