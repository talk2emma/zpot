import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, sizes, typography, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typography.label, { color: colors.textMuted, marginTop: 8 }]} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted, style, strong }: { children: React.ReactNode; muted?: boolean; strong?: boolean; style?: object }) {
  const { colors } = useTheme();
  return <Text style={[strong ? typography.bodyStrong : typography.body, { color: muted ? colors.textMuted : colors.textBody }, style]}>{children}</Text>;
}

export function Title({ children, size = 'h1' }: { children: React.ReactNode; size?: 'title' | 'h1' | 'h2' }) {
  const { colors } = useTheme();
  return <Text style={[typography[size], { color: colors.text }]} accessibilityRole="header">{children}</Text>;
}

type BannerTone = 'warn' | 'error' | 'info' | 'ok';
const TONES: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  warn: { bg: palette.amber50, fg: '#5C3600', icon: 'alert' },
  error: { bg: palette.red50, fg: '#7A1A12', icon: 'alert' },
  info: { bg: palette.blue100, fg: '#0B3A5C', icon: 'info' },
  ok: { bg: palette.green50, fg: '#174D06', icon: 'check' },
};

export function Banner({ tone = 'info', children, action, testID, icon }: {
  tone?: BannerTone; children: React.ReactNode; action?: { label: string; onPress: () => void }; testID?: string; icon?: IconName;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} testID={testID} accessibilityRole="alert">
      <Icon name={icon ?? t.icon} color={t.fg} size={18} />
      <Text style={[styles.bannerText, { color: t.fg }]}>{children}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.bannerAction}>
          <Text style={styles.bannerActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChip({ label, selected, onPress, icon, testID, badge }: {
  label: string; selected?: boolean; onPress: () => void; icon?: IconName; testID?: string; badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={[styles.chip, { backgroundColor: selected ? palette.navy900 : colors.surface, borderColor: selected ? palette.navy900 : colors.border }]}>
      {icon ? <Icon name={icon} size={16} color={selected ? palette.white : colors.text} /> : null}
      <Text style={[styles.chipText, { color: selected ? palette.white : colors.text }]}>{label}{badge ? ` · ${badge}` : ''}</Text>
    </Pressable>
  );
}

export function Toggle({ value, onValueChange, label, sub, testID, disabled }: {
  value: boolean; onValueChange: (v: boolean) => void; label: string; sub?: string; testID?: string; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => !disabled && onValueChange(!value)} accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }} accessibilityLabel={label} accessibilityHint={sub}
      style={[styles.toggleRow, { borderBottomColor: colors.divider }]}>
      <View style={styles.flex}>
        <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]}>{label}</Text>
        {sub ? <Text style={[typography.meta, { color: colors.textMuted }]}>{sub}</Text> : null}
      </View>
      <View style={[styles.sw, { backgroundColor: value ? palette.green700 : palette.slate200, opacity: disabled ? 0.5 : 1 }]}>
        <View style={[styles.knob, { left: value ? 23 : 3 }]} />
      </View>
    </Pressable>
  );
}

export function ListRow({ icon, label, sub, value, onPress, danger, testID, right }: {
  icon?: IconName; label: string; sub?: string; value?: string; onPress?: () => void; danger?: boolean; testID?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[label, sub, value].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.li, { borderBottomColor: colors.divider }, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {icon ? <Icon name={icon} color={danger ? colors.danger : colors.text} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.liLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
        {sub ? <Text style={[typography.meta, { color: colors.textMuted }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={[typography.meta, { color: colors.textMuted }]}>{value}</Text> : null}
      {right}
      {onPress ? <Icon name="chevronRight" color={colors.text} /> : null}
    </Pressable>
  );
}

export function Stepper({ value, onMinus, onPlus, minusLabel, plusLabel, testID }: {
  value: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.step, { borderColor: colors.border }]} testID={testID}>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={minusLabel} style={styles.stepBtn} testID={testID && `${testID}-minus`}>
        <Icon name="minus" color={colors.text} />
      </Pressable>
      <Text style={[styles.stepValue, { color: colors.text }]} accessibilityLiveRegion="polite">{value}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={plusLabel} style={styles.stepBtn} testID={testID && `${testID}-plus`}>
        <Icon name="plus" color={colors.text} />
      </Pressable>
    </View>
  );
}

export function SummaryRow({ k, v }: { k: string; v: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sum, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.sumK, { color: colors.textMuted }]}>{k}</Text>
      <Text style={[styles.sumV, { color: colors.text }]}>{v}</Text>
    </View>
  );
}

export function Row({ children, style, gap = 10 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Wrap({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.lg },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  bannerAction: { backgroundColor: palette.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  bannerActionText: { fontWeight: '700', color: palette.navy900, fontSize: 14 },
  chip: { minHeight: sizes.chip, borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: 1, paddingVertical: 8 },
  sw: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: palette.white },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1 },
  liLabel: { fontSize: 16 },
  step: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderRadius: radius.lg, padding: 4 },
  stepBtn: { width: sizes.touch, height: sizes.touch, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 17, fontWeight: '700' },
  sum: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  sumK: { fontSize: 15, flexShrink: 1 },
  sumV: { fontSize: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
});
