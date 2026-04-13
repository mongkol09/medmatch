export const colors = {
    primary: {
        DEFAULT: '#2563EB', // A vibrant, trustworthy blue
        light: '#60A5FA',
        dark: '#1D4ED8',
        transparent: 'rgba(37, 99, 235, 0.15)',
    },
    secondary: {
        DEFAULT: '#10B981', // Medical green
        light: '#34D399',
        dark: '#059669',
    },
    background: {
        DEFAULT: '#F8FAFC',
        paper: '#FFFFFF',
        dark: '#0F172A',
    },
    text: {
        primary: '#0F172A',
        secondary: '#475569',
        inverse: '#FFFFFF',
        disabled: '#94A3B8',
    },
    border: {
        DEFAULT: '#E2E8F0',
        light: '#F1F5F9',
    },
    semantic: {
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
        info: '#3B82F6',
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
};

export const borderRadii = {
    sm: 6,
    md: 12,
    lg: 20,
    xl: 30,
    full: 9999,
};

// Common shadow definitions
export const shadows = {
    sm: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
    },
};
