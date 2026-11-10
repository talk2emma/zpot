import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { toast } from '../common/Toast';
import { ListRow, Toggle } from '../common/Primitives';
import { ZpotButton } from '../common/ZpotButton';
import { ACCEPT_ALL, type ConsentChoices, REJECT_ALL, useConsentStore } from '../../store/consentStore';
import { radius, typography, useTheme } from '../../theme';

/**
 * The app's consent prompt (GDPR / ePrivacy). Accept all and Reject all have equal prominence; nothing optional is
 * pre-ticked; strictly necessary storage is explained but not switchable; there is no way to dismiss it without a
 * choice (closing ≠ consent). Reopened from Privacy & permissions to change choices at any time.
 */
export function ConsentSheet({ visible, version, onReadPolicy }: { visible: boolean; version: string; onReadPolicy: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const decision = useConsentStore(s => s.decision);
  const decide = useConsentStore(s => s.decide);
  const [custom, setCustom] = useState(false);
  const [choices, setChoices] = useState<ConsentChoices>(REJECT_ALL);
  const outdated = !!decision && decision.version !== version;

  useEffect(() => {
    if (!visible) return;
    // Reopened to change: start from the current choices; a first or re-prompt starts with everything off.
    setChoices(decision && !outdated ? { analytics: decision.analytics, personalisedAds: decision.personalisedAds, marketing: decision.marketing } : REJECT_ALL);
    setCustom(!!decision && !outdated);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (c: ConsentChoices) => { decide(c, version); toast(t('consent.saved')); };
  const set = (k: keyof ConsentChoices) => (v: boolean) => setChoices(c => ({ ...c, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          testID="consent-sheet" accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.body} bounces={false}>
            <Text style={[typography.h1, { color: colors.text }]} accessibilityRole="header">{t('consent.title')}</Text>
            {outdated ? <Text style={[typography.bodyStrong, { color: colors.text }]} testID="consent-updated">{t('consent.updated')}</Text> : null}
            <Text style={[typography.body, { color: colors.textBody }]}>{t('consent.intro')}</Text>
            {custom ? (
              <View testID="consent-custom">
                <Toggle value disabled label={t('consent.essentialTitle')} sub={t('consent.essentialBody')} onValueChange={() => undefined} testID="consent-essential" />
                <Toggle value={choices.analytics} onValueChange={set('analytics')} label={t('consent.analyticsTitle')} sub={t('consent.analyticsBody')} testID="consent-analytics" />
                <Toggle value={choices.personalisedAds} onValueChange={set('personalisedAds')} label={t('consent.adsTitle')} sub={t('consent.adsBody')} testID="consent-ads" />
                <Toggle value={choices.marketing} onValueChange={set('marketing')} label={t('consent.marketingTitle')} sub={t('consent.marketingBody')} testID="consent-marketing" />
              </View>
            ) : null}
            <Text style={[typography.meta, { color: colors.textMuted }]}>{t('consent.noSdk')}</Text>
            <ListRow icon="file" label={t('consent.readPolicy')} onPress={onReadPolicy} testID="consent-read-policy" />
          </ScrollView>
          <View style={styles.actions}>
            {custom ? <ZpotButton label={t('consent.save')} onPress={() => finish(choices)} testID="consent-save" /> : null}
            <View style={styles.row}>
              {/* Equal prominence for accepting and rejecting (EDPB guidance on consent). */}
              <ZpotButton style={styles.flex} variant="dark" label={t('consent.rejectAll')} onPress={() => finish(REJECT_ALL)} testID="consent-reject-all" />
              <ZpotButton style={styles.flex} variant="dark" label={t('consent.acceptAll')} onPress={() => finish(ACCEPT_ALL)} testID="consent-accept-all" />
            </View>
            {!custom ? <ZpotButton variant="tertiary" label={t('consent.customise')} onPress={() => setCustom(true)} testID="consent-customise" /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  body: { padding: 20, gap: 12 },
  actions: { paddingHorizontal: 20, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
