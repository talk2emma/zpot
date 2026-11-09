import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, ZpotButton } from '../../components/common';
import { ParkingStatusBadge } from '../../components/parking/ParkingStatusBadge';
import { describeOption } from '../../features/parking/presentation';
import { typography, useTheme } from '../../theme';
import type { ParkingOption } from '../../types/api';

/** ParkingDetailsSheet: compact summary of the selected map item inside the results sheet. */
export function SelectedSpotPanel({ option, onClose }: { option: ParkingOption; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const d = describeOption(option, t, i18n.language);
  return (
    <View style={styles.box} testID="selected-spot">
      <View style={styles.row}>
        <ParkingStatusBadge category={option.category} label={d.badge} />
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10} testID="selected-close">
          <Icon name="close" color={colors.text} />
        </Pressable>
      </View>
      <Text style={[typography.h2, { color: colors.text }]}>{option.name}</Text>
      <Text style={[typography.body, { color: colors.textBody }]}>{d.headline}</Text>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{`${d.walkText} · ${d.costText} · ${d.freshText}`}</Text>
      <View style={styles.actions}>
        {option.category !== 'restricted' ? (
          <ZpotButton style={styles.flex} icon="navigation" label={t('explore.navigate')} testID="selected-navigate"
            onPress={() => navigation.navigate('NavigationPicker', { id: option.id, name: option.name,
              latitude: option.location.latitude, longitude: option.location.longitude })} />
        ) : null}
        <ZpotButton style={styles.flex} variant="secondary" label={t('explore.details')} testID="selected-details"
          onPress={() => navigation.navigate('ParkingDetails', { id: option.id })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 16, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex: { flex: 1 },
});
