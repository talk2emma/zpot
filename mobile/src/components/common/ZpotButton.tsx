import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, sizes, typography, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'small' | 'dark';

export interface ZpotButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

export function ZpotButton({ label, onPress, variant = 'primary', icon, loading, disabled, style, testID,
  accessibilityHint }: ZpotButtonProps) {
  const { colors } = useTheme();
  const off = disabled || loading;
  const v = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: 'transparent', h: sizes.button },
    secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.text, border: colors.text, h: sizes.button },
    dark: { bg: palette.navy900, pressed: '#0B3A5C', fg: palette.white, border: 'transparent', h: sizes.button },
    tertiary: { bg: 'transparent', pressed: colors.surfaceMuted, fg: colors.link, border: 'transparent', h: sizes.touch },
    danger: { bg: palette.red600, pressed: '#93190F', fg: palette.white, border: 'transparent', h: sizes.button },
    small: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.text, border: colors.border, h: 40 },
  }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={variant === 'tertiary' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        { minHeight: v.h, backgroundColor: off && variant !== 'tertiary' ? colors.disabledBg : pressed ? v.pressed : v.bg,
          borderColor: off ? 'transparent' : v.border, borderWidth: variant === 'secondary' ? 1.5 : variant === 'small' ? 1.5 : 0,
          borderRadius: variant === 'small' ? radius.md : radius.lg, paddingHorizontal: variant === 'small' ? 12 : 16,
          alignSelf: variant === 'small' || variant === 'tertiary' ? 'flex-start' : 'stretch' },
        style,
      ]}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Icon name={icon} color={off ? colors.disabledText : v.fg} size={18} /> : null}
        <Text style={[variant === 'small' ? styles.smallLabel : variant === 'tertiary' ? styles.tertiaryLabel : styles.label,
          { color: off && variant !== 'tertiary' ? colors.disabledText : v.fg }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { ...typography.button, textAlign: 'center' },
  smallLabel: { fontSize: 14, fontWeight: '600' },
  tertiaryLabel: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
