import type { BodyJson } from '@/data/schema';
import { gmToInternal } from '@/data/constants';
import type { BodyDef, SystemState, Vec3 } from '@/physics/types';
import { perihelionState } from '@/physics/orbit';
import { createState, recenterToBarycenter } from '@/physics/system';

const files = import.meta.glob<BodyJson>('/src/data/bodies/*.json', {
  eager: true,
  import: 'default',
});

export interface SystemModel {
  ids: string[];
  names: string[];
  radiusKm: number[];
  colors: string[];
  state: SystemState; // barycentric, internal units
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];

export function buildDefs(list: readonly BodyJson[]): BodyDef[] {
  const byId = new Map(list.map((b) => [b.id, b]));
  const done = new Map<string, BodyDef>();

  const build = (b: BodyJson, stack: string[]): BodyDef => {
    const cached = done.get(b.id);
    if (cached) return cached;
    if (stack.includes(b.id)) throw new Error(`Parent cycle: ${[...stack, b.id].join(' > ')}`);

    const gm = gmToInternal(b.gmKm3S2);
    let def: BodyDef;
    if (b.initial.type === 'root') {
      def = {
        id: b.id,
        name: b.name,
        gm,
        radiusKm: b.radiusKm,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      };
    } else {
      const init = b.initial;
      const pj = byId.get(init.parent);
      if (!pj) throw new Error(`${b.id}: unknown parent "${init.parent}"`);
      const parent = build(pj, [...stack, b.id]);
      const rel = perihelionState(parent.gm + gm, init.aAu, init.e, (init.incDeg * Math.PI) / 180);
      def = {
        id: b.id,
        name: b.name,
        parent: init.parent,
        gm,
        radiusKm: b.radiusKm,
        position: add(parent.position, rel.pos),
        velocity: add(parent.velocity, rel.vel),
      };
    }
    done.set(b.id, def);
    return def;
  };

  return list.map((b) => build(b, [])).sort((a, b) => b.gm - a.gm); // heaviest (Sun) first
}

export function loadSystem(list: readonly BodyJson[] = Object.values(files)): SystemModel {
  const defs = buildDefs(list);
  const meta = new Map(list.map((b) => [b.id, b]));
  const state = createState(defs);
  recenterToBarycenter(state);
  return {
    ids: defs.map((d) => d.id),
    names: defs.map((d) => d.name),
    radiusKm: defs.map((d) => d.radiusKm),
    colors: defs.map((d) => meta.get(d.id)!.color),
    state,
  };
}
