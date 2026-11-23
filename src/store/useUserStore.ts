import { create } from 'zustand';

const LS_KEY = 'heat-rush-local-meta-v1';

interface LocalMeta {
  bestWave: number;
  bestScore: number;
  heatPoints: number;
  totalGames: number;
}

function loadLocal(): LocalMeta {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { bestWave: 0, bestScore: 0, heatPoints: 0, totalGames: 0 };
    const p = JSON.parse(raw) as Partial<LocalMeta>;
    return {
      bestWave: Number(p.bestWave) || 0,
      bestScore: Number(p.bestScore) || 0,
      heatPoints: Number(p.heatPoints) || 0,
      totalGames: Number(p.totalGames) || 0,
    };
  } catch {
    return { bestWave: 0, bestScore: 0, heatPoints: 0, totalGames: 0 };
  }
}

function saveLocal(meta: LocalMeta) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(meta));
  } catch {
    // private mode / quota — ignore
  }
}

const boot = loadLocal();

interface UserState {
  id: string | null;
  username: string;
  role: 'user' | 'admin';
  heatPoints: number;
  crystals: number;
  bestWave: number;
  bestScore: number;
  totalGames: number;
  upgrades: {
    startTemp: number;
    heatSpeed: number;
    coolingResist: number;
    fuelCap: number;
    blastRadius: number;
  };
  skins: string[];
  currentSkin: string;
  setUser: (data: Partial<UserState>) => void;
  addHeatPoints: (points: number) => void;
  addCrystals: (amount: number) => void;
  updateBest: (wave: number, score: number) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  id: null,
  username: '',
  role: 'user',
  heatPoints: boot.heatPoints,
  crystals: 0,
  bestWave: boot.bestWave,
  bestScore: boot.bestScore,
  totalGames: boot.totalGames,
  upgrades: {
    startTemp: 0,
    heatSpeed: 0,
    coolingResist: 0,
    fuelCap: 0,
    blastRadius: 0,
  },
  skins: ['default'],
  currentSkin: 'default',
  setUser: (data) => set((state) => ({ ...state, ...data })),
  addHeatPoints: (points) => {
    set((state) => {
      const heatPoints = state.heatPoints + points;
      const totalGames = state.totalGames + (points > 0 ? 0 : 0);
      saveLocal({
        bestWave: state.bestWave,
        bestScore: state.bestScore,
        heatPoints,
        totalGames: state.totalGames,
      });
      return { heatPoints };
    });
  },
  addCrystals: (amount) => set((state) => ({ crystals: state.crystals + amount })),
  updateBest: (wave, score) => {
    const state = get();
    const bestWave = Math.max(state.bestWave, wave);
    const bestScore = Math.max(state.bestScore, score);
    const totalGames = state.totalGames + 1;
    saveLocal({
      bestWave,
      bestScore,
      heatPoints: state.heatPoints,
      totalGames,
    });
    set({ bestWave, bestScore, totalGames });
  },
}));