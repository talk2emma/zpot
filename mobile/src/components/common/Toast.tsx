import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { palette, radius } from '../../theme';

interface ToastState { message: string | null; show(m: string): void; hide(): void }
export const useToast = create<ToastState>(set => ({
  message: null,
  show: message => set({ message }),
  hide: () => set({ message: null }),
}));
export const toast = (m: string) => useToast.getState().show(m);

export function ToastHost() {
  const { message, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(hide, 2800);
    return () => clearTimeout(id);
  }, [message, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert" testID="toast">
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: { backgroundColor: palette.navy900, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 420 },
  text: { color: palette.white, fontSize: 14, fontWeight: '600' },
});
