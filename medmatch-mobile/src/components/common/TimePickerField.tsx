import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, FlatList,
} from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, spacing, borderRadii } from '../../theme';

interface TimePickerFieldProps {
    label: string;
    value: string;           // HH:MM
    onChange: (time: string) => void;
    placeholder?: string;
    interval?: number;       // minutes between slots, default 30
}

// Generate time slots from 00:00 to 23:30 (or other interval)
function generateTimeSlots(interval: number): string[] {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += interval) {
            slots.push(
                `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
            );
        }
    }
    return slots;
}

const ITEM_HEIGHT = 48;

export function TimePickerField({
    label,
    value,
    onChange,
    placeholder = 'Select time',
    interval = 30,
}: TimePickerFieldProps) {
    const [visible, setVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const slots = generateTimeSlots(interval);

    useEffect(() => {
        if (visible && value) {
            const idx = slots.indexOf(value);
            if (idx >= 0) {
                // Small delay to let the modal render
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index: Math.max(0, idx - 2), animated: false });
                }, 100);
            }
        }
    }, [visible]);

    const formatDisplay = (time: string): string => {
        if (!time) return '';
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.field} onPress={() => setVisible(true)} activeOpacity={0.7}>
                <Clock size={18} color={value ? colors.primary.DEFAULT : colors.text.disabled} />
                <Text style={[styles.fieldText, !value && styles.placeholder]}>
                    {value ? formatDisplay(value) : placeholder}
                </Text>
            </TouchableOpacity>

            <Modal visible={visible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setVisible(false)}
                >
                    <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                        <Text style={styles.sheetTitle}>Select Time</Text>
                        <FlatList
                            ref={flatListRef}
                            data={slots}
                            keyExtractor={(item) => item}
                            style={styles.list}
                            getItemLayout={(_, index) => ({
                                length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index,
                            })}
                            renderItem={({ item }) => {
                                const isSelected = item === value;
                                return (
                                    <TouchableOpacity
                                        style={[styles.timeItem, isSelected && styles.timeItemSelected]}
                                        onPress={() => {
                                            onChange(item);
                                            setVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                                            {formatDisplay(item)}
                                        </Text>
                                        <Text style={[styles.time24, isSelected && styles.timeTextSelected]}>
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                            onScrollToIndexFailed={() => {}}
                        />
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    label: {
        fontSize: 14, fontWeight: '600', color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    field: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.background.paper, borderRadius: borderRadii.md,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        borderWidth: 1, borderColor: colors.border.DEFAULT,
        marginBottom: spacing.sm,
    },
    fieldText: {
        fontSize: 15, color: colors.text.primary, flex: 1,
    },
    placeholder: {
        color: colors.text.disabled,
    },
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', paddingHorizontal: spacing.md,
    },
    sheet: {
        backgroundColor: colors.background.paper, borderRadius: borderRadii.xl,
        padding: spacing.md, maxHeight: '60%', overflow: 'hidden',
    },
    sheetTitle: {
        fontSize: 17, fontWeight: 'bold', color: colors.text.primary,
        textAlign: 'center', marginBottom: spacing.sm,
    },
    list: {
        flexGrow: 0,
    },
    timeItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        height: ITEM_HEIGHT, paddingHorizontal: spacing.lg,
        borderRadius: borderRadii.md,
    },
    timeItemSelected: {
        backgroundColor: colors.primary.transparent,
    },
    timeText: {
        fontSize: 16, color: colors.text.primary,
    },
    time24: {
        fontSize: 13, color: colors.text.disabled,
    },
    timeTextSelected: {
        color: colors.primary.DEFAULT, fontWeight: '700',
    },
    cancelBtn: {
        alignItems: 'center', paddingVertical: spacing.md,
        borderTopWidth: 1, borderTopColor: colors.border.light, marginTop: spacing.xs,
    },
    cancelText: {
        fontSize: 15, fontWeight: '600', color: colors.text.secondary,
    },
});
