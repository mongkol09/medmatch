import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

export default function RootLayout() {
    const router = useRouter();
    const notificationResponseListener = useRef<Notifications.EventSubscription>();

    useEffect(() => {
        // Handle notification tap → navigate to relevant screen
        notificationResponseListener.current =
            Notifications.addNotificationResponseReceivedListener((response) => {
                const data = response.notification.request.content.data;
                if (data?.screen) {
                    // e.g. data.screen = '/(app)/chat/[id]', data.params = { id: '...' }
                    router.push({ pathname: data.screen as any, params: data.params as any });
                } else if (data?.type === 'chat') {
                    router.push({ pathname: '/(app)/chat/[id]', params: { id: data.conversationId } } as any);
                } else if (data?.type === 'booking') {
                    router.push('/(app)/booking/my-bookings' as any);
                } else if (data?.type === 'JOB_ACCEPTED' || data?.type === 'JOB_REJECTED') {
                    router.push('/(app)/my-applications' as any);
                } else if (data?.type === 'JOB_MATCH') {
                    router.push('/(app)/jobs/my-jobs' as any);
                } else {
                    router.push('/(app)/notifications' as any);
                }
            });

        return () => {
            notificationResponseListener.current?.remove();
        };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
            </Stack>
            <StatusBar style="auto" />
        </GestureHandlerRootView>
    );
}
