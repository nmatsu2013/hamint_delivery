import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Actor } from '../types/api';
import { setAuthToken } from '../lib/apiClient';

interface AuthState {
  token: string | null;
  actor: Actor | null;
  setSession: (token: string, actor: Actor | null) => void;
  setActor: (actor: Actor) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      actor: null,
      setSession: (token, actor) => {
        setAuthToken(token);
        set({ token, actor });
      },
      setActor: (actor) => set({ actor }),
      logout: () => {
        setAuthToken(null);
        set({ token: null, actor: null });
      },
    }),
    {
      name: 'hamint-auth',
      partialize: (state) => ({ token: state.token, actor: state.actor }),
    },
  ),
);
