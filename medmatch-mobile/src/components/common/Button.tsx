import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
    TouchableOpacityProps,
} from 'react-native';
import { colors, spacing, borderRadii } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    style,
    textStyle,
    disabled,
    ...props
}) => {
    const getBackgroundColor = () => {
        if (disabled) return colors.background.disabled;
        switch (variant) {
            case 'primary':
                return colors.primary.DEFAULT;
            case 'secondary':
                return colors.secondary.DEFAULT;
            case 'outline':
            case 'ghost':
                return 'transparent';
            default:
                return colors.primary.DEFAULT;
        }
    };

    const getTextColor = () => {
        if (disabled && variant !== 'outline' && variant !== 'ghost') {
            return colors.text.inverse;
        }
        if (disabled) return colors.text.disabled;

        switch (variant) {
            case 'primary':
            case 'secondary':
                return colors.text.inverse;
            case 'outline':
            case 'ghost':
                return colors.primary.DEFAULT;
            default:
                return colors.text.inverse;
        }
    };

    const getHeight = () => {
        switch (size) {
            case 'sm':
                return 36;
            case 'md':
                return 48;
            case 'lg':
                return 56;
            default:
                return 48;
        }
    };

    const containerStyles = [
        styles.container,
        {
            backgroundColor: getBackgroundColor(),
            height: getHeight(),
            borderColor: disabled
                ? colors.border.DEFAULT
                : variant === 'outline'
                    ? colors.primary.DEFAULT
                    : 'transparent',
            borderWidth: variant === 'outline' ? 1 : 0,
            opacity: disabled && (variant === 'outline' || variant === 'ghost') ? 0.5 : 1,
        },
        style,
    ];

    return (
        <TouchableOpacity
            style={containerStyles}
            disabled={disabled || isLoading}
            activeOpacity={0.7}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {leftIcon}
                    <Text
                        style={[
                            styles.text,
                            { color: getTextColor(), fontSize: size === 'sm' ? 14 : 16 },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                    {rightIcon}
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadii.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    text: {
        fontWeight: '600',
        textAlign: 'center',
    },
});
