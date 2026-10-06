import type { BodyJson } from '@/data/schema';
import sun from './phase1/sun.json';
import jupiter from './phase1/jupiter.json';

/** Frozen Phase 1 system (Sun + Jupiter from orbital elements). */
export const PHASE1_BODIES = [sun, jupiter] as unknown as BodyJson[];
