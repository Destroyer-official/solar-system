import { SimCore } from '@/sim/simCore';
import type { ToWorker } from '@/sim/protocol';

const core = new SimCore();

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const out = core.handle(e.data);
  if (out) {
    self.postMessage(out, {
      transfer: [out.pos.buffer, out.vel.buffer, out.samples.buffer, out.baryDist.buffer],
    });
  }
};
