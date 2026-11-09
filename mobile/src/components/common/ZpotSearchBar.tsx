import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, shadows, useTheme } from '../../theme';
import { Icon } from './Icon';

/** Display variant (tap to open search) — used on the map. */
export function ZpotSearchBar({ title, subtitle, onPress, testID }:
  { title: string; subtitle?: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="search" accessibilityLabel={`${title}. ${subtitle ?? ''}`}
      style={[styles.bar, shadows.card, { backgroundColor: colors.surface }]}>
      <Icon name="search" color={colors.text} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Input variant — used on the search screen. */
export const ZpotSearchInput = forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { onClear?: () => void; clearLabel?: string }>(
  function ZpotSearchInput({ onClear, clearLabel, value, ...rest }, ref) {
    const { colors } = useTheme();
    return (
      <View style={[styles.input, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
        <TextInput ref={ref} value={value} style={[styles.field, { color: colors.text }]} placeholderTextColor={colors.textSubtle}
          returnKeyType="search" autoCorrect={false} {...rest} />
        {value ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={clearLabel} hitSlop={10} testID="search-clear">
            <Icon name="close" color={colors.text} />
          </Pressable>
        ) : null}
      </View>
    );
  });

const styles = StyleSheet.create({
  bar: { flex: 1, minHeight: 52, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  texts: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13 },
  input: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  field: { flex: 1, fontSize: 16 },
});
