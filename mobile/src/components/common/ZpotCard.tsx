import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, useTheme } from '../../theme';

export function ZpotCard({ children, onPress, style, highlight, muted, testID, accessibilityLabel }: {
  children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; highlight?: string; muted?: boolean;
  testID?: string; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: muted ? colors.surfaceMuted : colors.surface,
    borderColor: highlight ?? (muted ? 'transparent' : colors.border), borderWidth: highlight ? 2 : 1 }, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: radius.xl, padding: 14 } });
