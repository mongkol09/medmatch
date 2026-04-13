import { Tabs, Redirect } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Briefcase, MessageCircle, User, LayoutDashboard, Calendar as CalendarIcon, ClipboardList } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { api } from '../../src/services/api';

/**
 * Role-aware tab layout.
 *
 * PATIENT  -> Home (map) | Bookings | Chat | Profile
 * SEEKER   -> Jobs (swipe) | Applications | Calendar | Chat | Profile
 * CLINIC   -> Dashboard | Jobs (my) | Chat | Profile
 *
 * IMPORTANT: Every screen file inside (app)/ MUST be listed here.
 * Any screen not explicitly listed will auto-generate as a visible tab
 * and break the tab bar layout.
 */
export default function AppLayout() {
    const { user, isAuthenticated } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [pendingOfferCount, setPendingOfferCount] = useState(0);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const role = user?.currentRole ?? 'PATIENT';

    // Fetch badge counts on mount and every 30 seconds
    const fetchBadges = useCallback(async () => {
        try {
            if (role === 'SEEKER') {
                const res = await api.get('/jobs/matches');
                const pending = (res.data || []).filter((m: any) => m.status === 'SEEKER_PENDING');
                setPendingOfferCount(pending.length);
            }
            const notifRes = await api.get('/notifications/unread-count');
            setUnreadNotifCount(notifRes.data?.count ?? 0);
        } catch {}
    }, [role]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchBadges();
        const interval = setInterval(fetchBadges, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchBadges]);

    if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

    const tabBarOptions = {
        headerShown: false,
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.disabled,
        tabBarStyle: {
            backgroundColor: colors.background.paper,
            borderTopColor: colors.border.light,
            borderTopWidth: 1,
            height: 54 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
    };

    // Helper: hide screen from tab bar (still navigable via router.push)
    const hide = { href: null as any };

    if (role === 'CLINIC') {
        return (
            <Tabs screenOptions={tabBarOptions}>
                {/* ===== Visible tabs ===== */}
                <Tabs.Screen
                    name="clinic-dashboard"
                    options={{
                        title: 'Dashboard',
                        tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="jobs/my-jobs"
                    options={{
                        title: 'My Jobs',
                        tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="chat"
                    options={{
                        title: 'Chat',
                        tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                        tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
                        tabBarBadgeStyle: { backgroundColor: colors.semantic.error, fontSize: 10 },
                    }}
                />

                {/* ===== Hidden: other role tabs ===== */}
                <Tabs.Screen name="home" options={hide} />
                <Tabs.Screen name="jobs/index" options={hide} />
                <Tabs.Screen name="calendar" options={hide} />
                <Tabs.Screen name="booking/my-bookings" options={hide} />

                {/* ===== Hidden: non-tab screens ===== */}
                <Tabs.Screen name="accounting" options={hide} />
                <Tabs.Screen name="notifications" options={hide} />
                <Tabs.Screen name="switch-role" options={hide} />
                <Tabs.Screen name="verification" options={hide} />
                <Tabs.Screen name="jobs/post" options={hide} />
                <Tabs.Screen name="jobs/[id]/applicants" options={hide} />
                <Tabs.Screen name="booking/clinic/[id]" options={hide} />
                <Tabs.Screen name="booking/clinic-today" options={hide} />
                <Tabs.Screen name="payment/[bookingId]" options={hide} />
                <Tabs.Screen name="review/[id]" options={hide} />
                <Tabs.Screen name="seeker-profile/edit" options={hide} />
                <Tabs.Screen name="clinic-profile/edit" options={hide} />
                <Tabs.Screen name="chat/[id]" options={hide} />
                <Tabs.Screen name="patient-profile/edit" options={hide} />
                <Tabs.Screen name="income" options={hide} />
                <Tabs.Screen name="patient-records" options={hide} />
                <Tabs.Screen name="treatment-history" options={hide} />
                <Tabs.Screen name="favorites" options={hide} />
                <Tabs.Screen name="seeker-profile/[id]" options={hide} />
                <Tabs.Screen name="clinic-profile/[id]" options={hide} />
                <Tabs.Screen name="settings" options={hide} />
                <Tabs.Screen name="jobs/[id]/edit" options={hide} />
                <Tabs.Screen name="my-applications" options={hide} />
            </Tabs>
        );
    }

    if (role === 'SEEKER') {
        return (
            <Tabs screenOptions={tabBarOptions}>
                {/* ===== Visible tabs ===== */}
                <Tabs.Screen
                    name="jobs/index"
                    options={{
                        title: 'Find Jobs',
                        tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="my-applications"
                    options={{
                        title: 'Applications',
                        tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
                        tabBarBadge: pendingOfferCount > 0 ? pendingOfferCount : undefined,
                        tabBarBadgeStyle: { backgroundColor: colors.semantic.error, fontSize: 10 },
                    }}
                />
                <Tabs.Screen
                    name="calendar"
                    options={{
                        title: 'Calendar',
                        tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="chat"
                    options={{
                        title: 'Chat',
                        tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                        tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
                        tabBarBadgeStyle: { backgroundColor: colors.semantic.error, fontSize: 10 },
                    }}
                />

                {/* ===== Hidden: other role tabs ===== */}
                <Tabs.Screen name="home" options={hide} />
                <Tabs.Screen name="clinic-dashboard" options={hide} />
                <Tabs.Screen name="jobs/my-jobs" options={hide} />
                <Tabs.Screen name="booking/my-bookings" options={hide} />

                {/* ===== Hidden: non-tab screens ===== */}
                <Tabs.Screen name="accounting" options={hide} />
                <Tabs.Screen name="notifications" options={hide} />
                <Tabs.Screen name="switch-role" options={hide} />
                <Tabs.Screen name="verification" options={hide} />
                <Tabs.Screen name="jobs/post" options={hide} />
                <Tabs.Screen name="jobs/[id]/applicants" options={hide} />
                <Tabs.Screen name="booking/clinic/[id]" options={hide} />
                <Tabs.Screen name="booking/clinic-today" options={hide} />
                <Tabs.Screen name="payment/[bookingId]" options={hide} />
                <Tabs.Screen name="review/[id]" options={hide} />
                <Tabs.Screen name="seeker-profile/edit" options={hide} />
                <Tabs.Screen name="clinic-profile/edit" options={hide} />
                <Tabs.Screen name="chat/[id]" options={hide} />
                <Tabs.Screen name="patient-profile/edit" options={hide} />
                <Tabs.Screen name="income" options={hide} />
                <Tabs.Screen name="patient-records" options={hide} />
                <Tabs.Screen name="treatment-history" options={hide} />
                <Tabs.Screen name="favorites" options={hide} />
                <Tabs.Screen name="seeker-profile/[id]" options={hide} />
                <Tabs.Screen name="clinic-profile/[id]" options={hide} />
                <Tabs.Screen name="settings" options={hide} />
                <Tabs.Screen name="jobs/[id]/edit" options={hide} />
            </Tabs>
        );
    }

    // Default: PATIENT
    return (
        <Tabs screenOptions={tabBarOptions}>
            {/* ===== Visible tabs ===== */}
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="booking/my-bookings"
                options={{
                    title: 'Bookings',
                    tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                }}
            />

            {/* ===== Hidden: other role tabs ===== */}
            <Tabs.Screen name="clinic-dashboard" options={hide} />
            <Tabs.Screen name="jobs/index" options={hide} />
            <Tabs.Screen name="jobs/my-jobs" options={hide} />
            <Tabs.Screen name="calendar" options={hide} />

            {/* ===== Hidden: non-tab screens ===== */}
            <Tabs.Screen name="accounting" options={hide} />
            <Tabs.Screen name="notifications" options={hide} />
            <Tabs.Screen name="switch-role" options={hide} />
            <Tabs.Screen name="verification" options={hide} />
            <Tabs.Screen name="jobs/post" options={hide} />
            <Tabs.Screen name="jobs/[id]/applicants" options={hide} />
            <Tabs.Screen name="booking/clinic/[id]" options={hide} />
                <Tabs.Screen name="booking/clinic-today" options={hide} />
            <Tabs.Screen name="seeker-profile/edit" options={hide} />
            <Tabs.Screen name="clinic-profile/edit" options={hide} />
            <Tabs.Screen name="chat/[id]" options={hide} />
            <Tabs.Screen name="patient-profile/edit" options={hide} />
            <Tabs.Screen name="income" options={hide} />
            <Tabs.Screen name="patient-records" options={hide} />
            <Tabs.Screen name="treatment-history" options={hide} />
            <Tabs.Screen name="favorites" options={hide} />
            <Tabs.Screen name="seeker-profile/[id]" options={hide} />
            <Tabs.Screen name="clinic-profile/[id]" options={hide} />
            <Tabs.Screen name="settings" options={hide} />
            <Tabs.Screen name="jobs/[id]/edit" options={hide} />
            <Tabs.Screen name="my-applications" options={hide} />
        </Tabs>
    );
}
