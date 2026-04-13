import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../src/theme';

export default function Index() {
    const { isAuthenticated, user } = useAuthStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.DEFAULT }}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    // Role-based home routing
    switch (user?.currentRole || user?.role) {
        case 'CLINIC':
            return <Redirect href="/(app)/clinic-dashboard" />;
        case 'SEEKER':
            return <Redirect href="/(app)/jobs" />;
        case 'PATIENT':
        default:
            return <Redirect href="/(app)/home" />;
    }
}
