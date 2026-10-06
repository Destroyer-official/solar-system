import { barycentricFrame, bodyCenteredFrame } from './basic';
import { galacticFrame } from './galactic';
import type { ReferenceFrame } from './types';

export function buildFrames(ids: readonly string[], names: readonly string[]): ReferenceFrame[] {
  return [
    barycentricFrame,
    ...ids.map((id, i) => bodyCenteredFrame(i, id, names[i]!)),
    galacticFrame(false),
    galacticFrame(true),
  ];
}
