import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, typography, useTheme } from '../../theme';
import { Icon } from './Icon';
import { ZpotButton } from './ZpotButton';

/** Modal bottom sheet with scrim; dismissible by scrim tap, close button or Android back. */
export function BottomSheet({ visible, onClose, title, children, testID, closeLabel = 'Close' }: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; testID?: string; closeLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose}
          accessibilityRole="button" accessibilityLabel={closeLabel} testID={testID ? `${testID}-scrim` : undefined} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 20) + 10 }]} testID={testID}
          accessibilityViewIsModal>
          <View style={styles.grab} />
          {title ? (
            <View style={styles.head}>
              <Text style={[typography.h2, styles.flex, { color: colors.text }]} accessibilityRole="header">{title}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={10}>
                <Icon name="close" color={colors.text} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.body} bounces={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const ZpotModal = BottomSheet;

export function ConfirmDialog({ visible, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, destructive, testID }: {
  visible: boolean; title: string; body?: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void;
  onCancel: () => void; destructive?: boolean; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onCancel} testID={testID} closeLabel={cancelLabel}>
      <Text style={[typography.h2, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      {body ? <Text style={[typography.body, { color: colors.textBody }]}>{body}</Text> : null}
      <ZpotButton label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} testID={testID && `${testID}-confirm`} />
      <ZpotButton label={cancelLabel} variant="secondary" onPress={onCancel} testID={testID && `${testID}-cancel`} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: 10, paddingHorizontal: 20, maxHeight: '88%' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: palette.slate200, alignSelf: 'center', marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  body: { gap: 12, paddingBottom: 6 },
});
