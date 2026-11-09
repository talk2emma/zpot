import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { pickPhoto } from '../../features/shared';
import type { DraftPhoto } from '../../store/reportDraftStore';
import { radius, typography, useTheme } from '../../theme';
import { Banner, Row, SectionLabel } from '../common/Primitives';
import { ZpotButton } from '../common/ZpotButton';

/** Camera / library photo field with size + type validation and the privacy notice (no auto-redaction is claimed). */
export function PhotoField({ value, onChange, label, testID = 'photo' }: {
  value: DraftPhoto | null; onChange: (p: DraftPhoto | null) => void; label: string; testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [err, setErr] = useState<string | null>(null);
  const pick = async (src: 'camera' | 'library') => {
    setErr(null);
    const r = await pickPhoto(src);
    if ('photo' in r) onChange(r.photo);
    else if (r.error === 'too_big') setErr(t('report.photoTooBig'));
    else if (r.error === 'type') setErr(t('report.photoType'));
    else if (r.error === 'failed') setErr(t('common.somethingWrong'));
  };
  return (
    <View style={styles.col} testID={testID}>
      <SectionLabel>{label}</SectionLabel>
      {value ? (
        <Row>
          <Image source={{ uri: value.uri }} style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} accessibilityIgnoresInvertColors
            accessible accessibilityLabel={value.name} testID={`${testID}-thumb`} />
          <View style={styles.col}>
            <ZpotButton variant="small" label={t('report.replacePhoto')} onPress={() => void pick('library')} testID={`${testID}-replace`} />
            <ZpotButton variant="small" icon="trash" label={t('report.removePhoto')} onPress={() => onChange(null)} testID={`${testID}-remove`} />
          </View>
        </Row>
      ) : (
        <Row>
          <ZpotButton variant="small" label={t('report.takePhoto')} onPress={() => void pick('camera')} testID={`${testID}-camera`} />
          <ZpotButton variant="small" label={t('report.fromLibrary')} onPress={() => void pick('library')} testID={`${testID}-library`} />
        </Row>
      )}
      <Text style={[typography.meta, { color: colors.textMuted }]}>{t('report.photoPrivacy')}</Text>
      {err ? <Banner tone="error" testID={`${testID}-error`}>{err}</Banner> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 8, flexShrink: 1 },
  thumb: { width: 96, height: 96, borderRadius: radius.lg },
});
