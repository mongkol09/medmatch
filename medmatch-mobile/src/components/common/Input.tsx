import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    TouchableOpacity,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, spacing, borderRadii } from '../../theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    isPassword?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    leftIcon,
    isPassword,
    style,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View
                style={[
                    styles.inputContainer,
                    isFocused && styles.inputContainerFocused,
                    error && styles.inputContainerError,
                    style,
                ]}
            >
                {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

                <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.text.disabled}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    secureTextEntry={isPassword && !isPasswordVisible}
                    {...props}
                />

                {isPassword && (
                    <TouchableOpacity
                        style={styles.rightIcon}
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    >
                        {isPasswordVisible ? (
                            <EyeOff size={20} color={colors.text.secondary} />
                        ) : (
                            <Eye size={20} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        borderRadius: borderRadii.md,
        backgroundColor: colors.background.paper,
        paddingHorizontal: spacing.md,
    },
    inputContainerFocused: {
        borderColor: colors.primary.DEFAULT,
    },
    inputContainerError: {
        borderColor: colors.semantic.error,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        paddingVertical: spacing.sm,
    },
    leftIcon: {
        marginRight: spacing.sm,
    },
    rightIcon: {
        marginLeft: spacing.sm,
    },
    errorText: {
        fontSize: 12,
        color: colors.semantic.error,
        marginTop: spacing.xs,
    },
});
