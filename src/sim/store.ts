export type ScaleMode = 'true' | 'pixels' | 'exaggerated';

export interface AppState {
  playing: boolean;
  reversed: boolean;
  speed: number; // simulated days per real second (always positive)
  preset: string;
  trails: boolean;
  frame: string; // ReferenceFrame id
  focus: string; // 'barycenter' or a body id: what the camera follows
  trailDays: number; // how much history to draw
  scaleMode: ScaleMode;
  scaleExaggeration: number; // 1 to 500
  selected: string | null;
  compress: number; // along-track compression factor (1 = true scale, 0.05 = 1:20)
}

export function createStore<T extends object>(initial: T) {
  let state = { ...initial };
  const subs = new Set<(s: T, changed: keyof T) => void>();
  return {
    get: (): T => state,
    set<K extends keyof T>(key: K, value: T[K]): void {
      if (Object.is(state[key], value)) return;
      state = { ...state, [key]: value } as T;
      subs.forEach((f) => f(state, key));
    },
    subscribe(f: (s: T, changed: keyof T) => void): () => void {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
  };
}
export type AppStore = ReturnType<typeof createStore<AppState>>;
