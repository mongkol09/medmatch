import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

// EXPO_PUBLIC_API_URL is set in .env — change it there, no need to touch code
// Fallback chain: env var → Android emulator → localhost
const getServerOrigin = (): string => {
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
};

export const SERVER_ORIGIN = getServerOrigin();
const BASE_URL = `${SERVER_ORIGIN}/api/v1`;

/**
 * Resolve an image URL that may be:
 * - already absolute (http/https) → returned as-is
 * - relative (/uploads/...) → prefixed with server origin
 * - null/undefined → returns undefined
 */
export function resolveImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('file://')) return url;  // local device file from ImagePicker — pass through unchanged
    return `${SERVER_ORIGIN}${url}`;
}

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
    (config) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

/**
 * Upload a file via multipart/form-data.
 * Uses native fetch (not Axios) so the runtime sets the correct Content-Type boundary.
 *
 * @param endpoint    e.g. '/profile/upload-image?folder=profiles'
 * @param uri         local file URI from ImagePicker
 * @param fieldName   multipart field name for the file (default: 'file')
 * @param fileName    file name sent in the part headers (default: 'upload.jpg')
 * @param mimeType    MIME type (default: 'image/jpeg')
 * @param extraFields additional string fields to append to the FormData
 * @returns           server response parsed as JSON
 */
export async function uploadFile<T = { url: string }>(
    endpoint: string,
    uri: string,
    fieldName = 'file',
    fileName = 'upload.jpg',
    mimeType = 'image/jpeg',
    extraFields: Record<string, string> = {},
): Promise<T> {
    const { accessToken } = useAuthStore.getState();
    const formData = new FormData();
    formData.append(fieldName, { uri, name: fileName, type: mimeType } as any);
    for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            // Do NOT set Content-Type — let fetch set it with the correct multipart boundary
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData,
    });

    const json = await response.json();
    if (!response.ok) {
        const msg = Array.isArray(json?.message) ? json.message.join(', ') : (json?.message ?? 'Upload failed');
        throw Object.assign(new Error(msg), { response: { data: json, status: response.status } });
    }
    return json as T;
}

// Add a response interceptor to handle 401 Unauthorized errors (refresh token logic can go here)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Optional: Implement refresh token logic if 401
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            // const newAccessToken = await refreshAuthToken();
            // ...

            // For now, if 401 we just logout
            // useAuthStore.getState().logout();
        }

        return Promise.reject(error);
    }
);
