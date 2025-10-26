import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authAPI } from "../services/api";

const useAuthStore = create(
  persist(
    (set, get) => ({
      // 状态
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      // 标记是否完成了初始化
      initialized: false,
      error: null,

      // 登录
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(credentials);
          const { user } = response;

          if (credentials?.remember) {
            localStorage.setItem("user", JSON.stringify(user));
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || "登录失败",
          });
          return { success: false, error: error.message || "登录失败" };
        }
      },

      // 注册
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.register(userData);
          set({ isLoading: false, error: null });
          return { success: true, data: response.data };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || "注册失败",
          });
          return { success: false, error: error.message || "注册失败" };
        }
      },

      // 登出
      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          // 清除本地存储
          localStorage.removeItem("user");
          try {
            sessionStorage.removeItem("auth-storage");
          } catch (e) {
            console.log(e);
          }
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      // 更新用户信息
      updateUser: (newUserData) => {
        set((state) => {
          const updatedUser = { ...state.user, ...newUserData };
          if (localStorage.getItem("user")) {
            localStorage.setItem("user", JSON.stringify(updatedUser));
          }
          return { user: updatedUser };
        });
      },

      // 获取当前用户信息
      getCurrentUser: async () => {
        set({ isLoading: true });
        try {
          const response = await authAPI.getCurrentUser();
          const user = response;

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return { success: true, user };
        } catch (error) {
          // 清理持久化和内存状态
          try {
            sessionStorage.removeItem("auth-storage");
          } catch (e) {}
          localStorage.removeItem("user");
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
          return { success: false, error: error.message };
        }
      },

      // 初始化认证状态
      initAuth: () => {
        // 优先从 localStorage 恢复否则从 sessionStorage 中的持久化状态恢复
        const userStr = localStorage.getItem("user");
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            set({ user, isAuthenticated: true, error: null });
            set({ initialized: true });
            return;
          } catch (error) {
            console.error("恢复用户信息失败: ", error);
            localStorage.removeItem("user");
          }
        }

        // 从 sessionStorage 中读取 zustand persist 的内容
        try {
          // 键名为 auth-storage
          const persisted = sessionStorage.getItem("auth-storage");
          if (persisted) {
            const parsed = JSON.parse(persisted);
            const restoredUser = parsed?.state?.user || null;
            const restoredAuth = parsed?.state?.isAuthenticated || false;
            if (restoredUser) {
              set({
                user: restoredUser,
                isAuthenticated: restoredAuth,
                error: null,
              });
            }
          }
        } catch (e) {
          console.log(e);
        }

        // 标记初始化完成
        set({ initialized: true, error: null });
      },

      // 清除错误
      clearError: () => set({ error: null }),

      // 检查是否为管理员
      isAdmin: () => {
        const { user } = get();
        return user?.isAdmin === true || user?.is_admin === true;
      },

      // 检查权限
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.isAdmin === true || user.is_admin === true) return true;
        return user.permissions?.includes(permission) || false;
      },
    }),
    {
      name: "auth-storage",
      // 默认使用 sessionStorage
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
