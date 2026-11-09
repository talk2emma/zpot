import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../services/api/errors';
import { palette, radius, typography, useTheme } from '../../theme';
import { Icon, type IconName } from './Icon';
import { ZpotButton } from './ZpotButton';

export function LoadingState({ label, skeleton = 0, testID = 'loading-state' }: { label?: string; skeleton?: number; testID?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.box} testID={testID} accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')}>
      {skeleton ? Array.from({ length: skeleton }).map((_, i) => (
        <View key={i} style={[styles.skel, { backgroundColor: colors.surfaceMuted }]} />
      )) : <ActivityIndicator color={palette.green700} />}
      {!skeleton && label ? <Text style={[typography.meta, { color: colors.textMuted }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = 'search', title, body, children, testID = 'empty-state' }: {
  icon?: IconName; title: string; body?: string; children?: React.ReactNode; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.border }]} testID={testID}>
      <Icon name={icon} color={colors.textMuted} size={22} />
      <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[typography.meta, { color: colors.textMuted }]}>{body}</Text> : null}
      {children}
    </View>
  );
}

export function errorMessage(err: unknown, t: (k: string) => string): string {
  if (err instanceof ApiError) {
    if (err.kind === 'network') return t('errors.network');
    if (err.kind === 'timeout') return t('errors.timeout');
    if (err.status && err.status >= 500) return t('errors.server');
    return err.message;
  }
  return t('errors.server');
}

export function ErrorState({ error, title, onRetry, testID = 'error-state' }: {
  error?: unknown; title?: string; onRetry?: () => void; testID?: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const offline = error instanceof ApiError && error.isOffline;
  return (
    <View style={[styles.card, { borderColor: colors.border }]} testID={testID} accessibilityRole="alert">
      <Icon name={offline ? 'offline' : 'alert'} color={colors.danger} size={22} />
      <Text style={[typography.h2, { color: colors.text }]}>{title ?? t('common.somethingWrong')}</Text>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{errorMessage(error, t)}</Text>
      {onRetry ? <ZpotButton variant="small" label={t('common.retry')} onPress={onRetry} testID={`${testID}-retry`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16, gap: 10, alignItems: 'stretch' },
  skel: { height: 88, borderRadius: radius.xl },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: 16, gap: 8 },
});
