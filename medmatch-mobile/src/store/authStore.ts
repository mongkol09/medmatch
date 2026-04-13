import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'SEEKER' | 'CLINIC' | 'PATIENT' | 'ADMIN';

export interface User {
    id: string;
    email: string;
    role: UserRole;
    currentRole: UserRole;
    profileId?: string; // id of SeekerProfile, ClinicProfile, or Patient
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    setAuth: (user: User, accessToken: string, refreshToken: string) => void;
    updateUser: (user: Partial<User>) => void;
    logout: () => void;
    setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,

            setAuth: (user, accessToken, refreshToken) =>
                set({ user, accessToken, refreshToken, isAuthenticated: true }),

            updateUser: (userData) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...userData } : null,
                })),

            logout: () =>
                set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
