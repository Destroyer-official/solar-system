import { barycentricFrame, bodyCenteredFrame } from './basic';
import { galacticFrame, cmbFrame } from './galactic';
import type { ReferenceFrame } from './types';

export function buildFrames(
  ids: readonly string[],
  names: readonly string[],
  lsrKms?: number,
): ReferenceFrame[] {
  return [
    barycentricFrame,
    ...ids.map((id, i) => bodyCenteredFrame(i, id, names[i]!)),
    galacticFrame(false, lsrKms),
    galacticFrame(true, lsrKms),
    cmbFrame(false),
    cmbFrame(true),
  ];
}
