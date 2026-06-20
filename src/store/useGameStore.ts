import { create } from 'zustand';
import { loadKey, saveKey } from '../persistence/db';

// Cross-cutting app state: bankroll, profile/stats, settings, jackpot meters.
// Poker hand-state and slot spin-state live in their own engines; only
// summarized results are synced here.

export interface Stats {
  handsPlayed: number;
  biggestPot: number;
  tournamentsCashed: number;
  tournamentsWon: number;
  slotJackpots: number;
  biggestSlotWin: number;
  totalSpins: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface Profile {
  name: string;
  avatar: string;
}

const DAILY_BONUS = 5000;
const STARTING_BANKROLL = 25000;

interface PersistShape {
  bankroll: number;
  stats: Stats;
  settings: Settings;
  profile: Profile;
  jackpots: Record<string, number>; // machineId -> current meter
  lastDailyClaim: number; // epoch ms
}

interface GameState extends PersistShape {
  loaded: boolean;
  hydrate: () => Promise<void>;
  addToBankroll: (delta: number) => void;
  setBankroll: (v: number) => void;
  canClaimDaily: () => boolean;
  claimDaily: () => number; // returns amount claimed (0 if not eligible)
  bumpJackpot: (machineId: string, seed: number, amount: number) => void;
  resetJackpot: (machineId: string, seed: number) => number; // returns won meter
  recordStat: (patch: Partial<Stats>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
}

const defaultStats: Stats = {
  handsPlayed: 0,
  biggestPot: 0,
  tournamentsCashed: 0,
  tournamentsWon: 0,
  slotJackpots: 0,
  biggestSlotWin: 0,
  totalSpins: 0,
};

const PERSIST_KEY = 'core-v1';

function persist(get: () => GameState) {
  const s = get();
  const data: PersistShape = {
    bankroll: s.bankroll,
    stats: s.stats,
    settings: s.settings,
    profile: s.profile,
    jackpots: s.jackpots,
    lastDailyClaim: s.lastDailyClaim,
  };
  void saveKey(PERSIST_KEY, data);
}

export const useGameStore = create<GameState>((set, get) => ({
  loaded: false,
  bankroll: STARTING_BANKROLL,
  stats: { ...defaultStats },
  settings: { sound: true, haptics: true, reducedMotion: false },
  profile: { name: 'High Roller', avatar: 'player' },
  jackpots: {},
  lastDailyClaim: 0,

  hydrate: async () => {
    const saved = await loadKey<PersistShape>(PERSIST_KEY);
    if (saved) {
      set({
        bankroll: saved.bankroll ?? STARTING_BANKROLL,
        stats: { ...defaultStats, ...saved.stats },
        settings: { ...{ sound: true, haptics: true, reducedMotion: false }, ...saved.settings },
        profile: { ...{ name: 'High Roller', avatar: 'player' }, ...saved.profile },
        jackpots: saved.jackpots ?? {},
        lastDailyClaim: saved.lastDailyClaim ?? 0,
        loaded: true,
      });
    } else {
      set({ loaded: true });
      persist(get);
    }
  },

  addToBankroll: (delta) => {
    set((s) => ({ bankroll: Math.max(0, Math.round(s.bankroll + delta)) }));
    persist(get);
  },
  setBankroll: (v) => {
    set({ bankroll: Math.max(0, Math.round(v)) });
    persist(get);
  },

  canClaimDaily: () => {
    const last = get().lastDailyClaim;
    return Date.now() - last >= 20 * 60 * 60 * 1000; // 20h cooldown
  },
  claimDaily: () => {
    if (!get().canClaimDaily()) return 0;
    set((s) => ({ bankroll: s.bankroll + DAILY_BONUS, lastDailyClaim: Date.now() }));
    persist(get);
    return DAILY_BONUS;
  },

  bumpJackpot: (machineId, seed, amount) => {
    set((s) => ({
      jackpots: { ...s.jackpots, [machineId]: (s.jackpots[machineId] ?? seed) + amount },
    }));
    persist(get);
  },
  resetJackpot: (machineId, seed) => {
    const won = get().jackpots[machineId] ?? seed;
    set((s) => ({ jackpots: { ...s.jackpots, [machineId]: seed } }));
    persist(get);
    return won;
  },

  recordStat: (patch) => {
    set((s) => ({ stats: { ...s.stats, ...patch } }));
    persist(get);
  },
  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    persist(get);
  },
  updateProfile: (patch) => {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
    persist(get);
  },
}));

export const DAILY_BONUS_AMOUNT = DAILY_BONUS;
