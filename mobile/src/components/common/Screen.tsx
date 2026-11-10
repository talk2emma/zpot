import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography, useTheme } from '../../theme';
import { Icon } from './Icon';

export function ScreenHeader({ title, onBack, close, right, backLabel = 'Back' }: {
  title?: string; onBack?: () => void; close?: boolean; right?: React.ReactNode; backLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.hdr}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.ib} testID="header-back">
          <Icon name={close ? 'close' : 'chevronLeft'} color={colors.text} />
        </Pressable>
      ) : <View style={styles.spacer} />}
      {title ? <Text style={[typography.header, styles.title, { color: colors.text }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        : <View style={styles.titleFlex} />}
      {right}
    </View>
  );
}

/** Standard screen: safe-area aware, keyboard avoiding, scrollable content and a sticky footer. */
export function Screen({ children, header, footer, scroll = true, testID, padded = true }: {
  children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; testID?: string; padded?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  // iOS keyboard avoidance. Every Zpot screen (full screen or page sheet) is anchored to the bottom of the display,
  // so the overlap is the keyboard height. KeyboardAvoidingView and measureInWindow both mis-measure inside page
  // sheets (coordinates are relative to the sheet), which let the keyboard cover footer buttons (found by E2E-005).
  // Android relies on windowSoftInputMode=adjustResize.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const show = Keyboard.addListener('keyboardWillShow', e => setKb(Math.round(e.endCoordinates.height)));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingBottom: kb }]} testID={testID}>
      <View style={{ paddingTop: insets.top }}>{header}</View>
      <Body style={styles.flex} contentContainerStyle={scroll ? [padded && styles.content] : undefined}
        keyboardShouldPersistTaps="handled">
        {scroll ? children : <View style={[styles.flex, padded && styles.content]}>{children}</View>}
      </Body>
      {footer ? (
        <View style={[styles.foot, { borderTopColor: colors.divider, backgroundColor: colors.background, paddingBottom: kb ? 12 : Math.max(insets.bottom, 16) + 8 }]}>
          {footer}
        </View>
      ) : <View style={{ height: kb ? 0 : insets.bottom }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 6, minHeight: 56 },
  ib: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 8 },
  title: { flex: 1 },
  titleFlex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 12 },
  foot: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, gap: 10 },
});
