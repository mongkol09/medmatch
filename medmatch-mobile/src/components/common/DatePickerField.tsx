import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { colors, spacing, borderRadii } from '../../theme';

interface DatePickerFieldProps {
    label: string;
    value: string;           // YYYY-MM-DD
    onChange: (date: string) => void;
    placeholder?: string;
    minDate?: string;
    maxDate?: string;
}

export function DatePickerField({
    label,
    value,
    onChange,
    placeholder = 'Select date',
    minDate,
    maxDate,
}: DatePickerFieldProps) {
    const [visible, setVisible] = useState(false);

    const formatDisplay = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('th-TH', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.field} onPress={() => setVisible(true)} activeOpacity={0.7}>
                <CalendarIcon size={18} color={value ? colors.primary.DEFAULT : colors.text.disabled} />
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
                        <Text style={styles.sheetTitle}>Select Date</Text>
                        <Calendar
                            current={value || undefined}
                            minDate={minDate}
                            maxDate={maxDate}
                            onDayPress={(day: DateData) => {
                                onChange(day.dateString);
                                setVisible(false);
                            }}
                            markedDates={value ? {
                                [value]: { selected: true, selectedColor: colors.primary.DEFAULT },
                            } : {}}
                            theme={{
                                todayTextColor: colors.primary.DEFAULT,
                                arrowColor: colors.primary.DEFAULT,
                                selectedDayBackgroundColor: colors.primary.DEFAULT,
                                textDayFontSize: 15,
                                textMonthFontSize: 16,
                                textMonthFontWeight: 'bold',
                            }}
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
        padding: spacing.md, overflow: 'hidden',
    },
    sheetTitle: {
        fontSize: 17, fontWeight: 'bold', color: colors.text.primary,
        textAlign: 'center', marginBottom: spacing.sm,
    },
    cancelBtn: {
        alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border.light,
    },
    cancelText: {
        fontSize: 15, fontWeight: '600', color: colors.text.secondary,
    },
});
