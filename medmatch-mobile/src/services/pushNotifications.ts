import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Check whether push notification infrastructure is available.
 * Returns false in Expo Go (no projectId) or on simulators.
 */
function isPushAvailable(): boolean {
    if (!Device.isDevice) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
        ?? Constants.easConfig?.projectId;
    return !!projectId;
}

// Only configure notification handler when push is actually available
if (isPushAvailable()) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

/**
 * Request push notification permissions and get the Expo push token.
 * Sends the token to the backend via PATCH /auth/fcm-token.
 *
 * Safe to call in any environment — gracefully returns null when
 * push is not available (Expo Go, simulator, no EAS project).
 */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!isPushAvailable()) {
        if (__DEV__) console.log('[Push] Not available in this environment — skipping');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            if (__DEV__) console.log('[Push] Permission denied');
            return null;
        }

        const projectId = (Constants.expoConfig?.extra?.eas?.projectId
            ?? Constants.easConfig?.projectId)!;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        // Android requires a notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#2563EB',
            });
        }

        // Send token to backend
        await sendTokenToBackend(token);

        return token;
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
}

/**
 * Send the push token to the backend.
 */
async function sendTokenToBackend(token: string): Promise<void> {
    try {
        await api.patch('/auth/fcm-token', { fcm_token: token });
        console.log('FCM token registered successfully');
    } catch (error) {
        console.error('Failed to register FCM token:', error);
    }
}

/**
 * Add a listener for when a notification is received while app is foregrounded.
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
) {
    return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when user taps on a notification.
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the badge count (iOS).
 */
export async function getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count (iOS).
 */
export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
}
