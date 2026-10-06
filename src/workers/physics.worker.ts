import { SimCore } from '@/sim/simCore';
import type { ToWorker } from '@/sim/protocol';

const core = new SimCore();

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const out = core.handle(e.data);
  if (out) {
    self.postMessage(out, {
      transfer: [
        out.pos.buffer,
        out.vel.buffer,
        out.pos0.buffer,
        out.vel0.buffer,
        out.samples.buffer,
        out.baryDist.buffer,
      ],
    });
  }
};
