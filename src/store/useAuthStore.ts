import { create } from "zustand";
import { RoleCode, User } from "@/types";

interface AuthState {
  currentUser: User | null;
  activeRole: RoleCode | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requirePasswordChange: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; requireChange?: boolean }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setRequirePasswordChange: (require: boolean) => void;
}

export const ROLE_DEFAULT_PATHS: Record<RoleCode, string> = {
  OWNER_ADMIN: "dashboard",
  MANAGER: "dashboard",
  CASHIER: "pos",
  STOCK_CHECKER: "stock-count",
  WAREHOUSE: "warehouse",
  PURCHASING: "purchasing",
  ACCOUNTING: "accounting",
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  activeRole: null,
  sessionToken: typeof window !== "undefined" ? localStorage.getItem("happymart_auth_token") : null,
  isAuthenticated: false,
  isLoading: true,
  requirePasswordChange: false,

  setRequirePasswordChange: (require) => set({ requirePasswordChange: require }),

  // Verify stored session token on app initialization
  checkAuth: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("happymart_auth_token") : null;
    if (!token) {
      set({ currentUser: null, activeRole: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          set({
            currentUser: data.user,
            activeRole: data.user.role_code,
            sessionToken: token,
            isAuthenticated: true,
            isLoading: false,
            requirePasswordChange: !!data.user.force_password_change,
          });
          return;
        }
      }
    } catch (err) {
      console.error("Auth check failed:", err);
    }

    // Invalid or expired token: clear local storage
    if (typeof window !== "undefined") {
      localStorage.removeItem("happymart_auth_token");
    }
    set({ currentUser: null, activeRole: null, sessionToken: null, isAuthenticated: false, isLoading: false });
  },

  // Real production login against Cloudflare Workers API
  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        set({ isLoading: false });
        return { success: false, error: data.error || "เข้าสู่ระบบไม่สำเร็จ" };
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("happymart_auth_token", data.token);
      }

      set({
        sessionToken: data.token,
        currentUser: data.user,
        activeRole: data.user.role_code,
        isAuthenticated: true,
        isLoading: false,
        requirePasswordChange: !!data.user.force_password_change,
      });

      return {
        success: true,
        requireChange: !!data.user.force_password_change,
      };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" };
    }
  },

  // Real logout revoking session in Cloudflare D1 Remote Database
  logout: async () => {
    const { sessionToken } = get();
    if (sessionToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sessionToken}`,
          },
        });
      } catch (err) {
        console.warn("Logout API call failed:", err);
      }
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("happymart_auth_token");
      sessionStorage.clear();
    }

    set({
      currentUser: null,
      activeRole: null,
      sessionToken: null,
      isAuthenticated: false,
      requirePasswordChange: false,
      isLoading: false,
    });
  },
}));
