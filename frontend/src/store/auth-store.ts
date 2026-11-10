import { create } from "zustand";
import { persist } from "zustand/middleware";

const API_URL = import.meta.env.VITE_API_URL || "http://backend:5000/api";

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  googleLogin: (googleToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      googleLogin: async (googleToken: string) => {
        try {
          const res = await fetch(`${API_URL}/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: googleToken }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Google login failed");

          if (typeof window !== "undefined") {
            window.localStorage.setItem("DEVV_CODE_SID", data.jwt);
          }
          set({ user: data.user, isAuthenticated: true });
          return true;
        } catch (err) {
          console.error("Google login error:", err);
          return false;
        }
      },

      logout: async () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("DEVV_CODE_SID");
        }
        set({ user: null, isAuthenticated: false });
      },

      checkAuth: () => {
        if (typeof window === "undefined") return false;  
        return !!window.localStorage.getItem("DEVV_CODE_SID");
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state,error) => {
        if (error) return;
        if (state?.user) {
          state.isAuthenticated = true;
        }
      },
    }
  )
);
