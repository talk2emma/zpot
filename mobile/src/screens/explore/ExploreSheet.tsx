import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { palette, radius, shadows, useTheme } from '../../theme';

export type SheetSnap = 'peek' | 'half' | 'full';

/** Draggable 3-position results sheet (prototype .sheet: peek / half / full). */
export function ExploreSheet({ snap, onSnap, heights, children, a11yLabel }: {
  snap: SheetSnap; onSnap: (s: SheetSnap) => void; heights: Record<SheetSnap, number>; children: React.ReactNode; a11yLabel: string;
}) {
  const { colors } = useTheme();
  const h = useRef(new Animated.Value(heights[snap])).current;
  const start = useRef(heights[snap]);
  useEffect(() => {
    Animated.spring(h, { toValue: heights[snap], useNativeDriver: false, bounciness: 0, speed: 18 }).start();
    start.current = heights[snap];
  }, [snap, heights, h]);
  const order: SheetSnap[] = ['peek', 'half', 'full'];
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => h.setValue(Math.max(heights.peek - 40, Math.min(heights.full, start.current - g.dy))),
    onPanResponderRelease: (_, g) => {
      const target = start.current - g.dy;
      const nearest = order.reduce((a, b) => (Math.abs(heights[b] - target) < Math.abs(heights[a] - target) ? b : a));
      const flick = Math.abs(g.vy) > 0.8 ? order[Math.max(0, Math.min(2, order.indexOf(snap) + (g.vy < 0 ? 1 : -1)))] : nearest;
      onSnap(flick);
      Animated.spring(h, { toValue: heights[flick], useNativeDriver: false, bounciness: 0 }).start();
      start.current = heights[flick];
    },
  }), [heights, onSnap, snap, h]); // eslint-disable-line react-hooks/exhaustive-deps
  const cycle = () => onSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
  return (
    <Animated.View style={[styles.sheet, shadows.sheet, { height: h, backgroundColor: colors.surface }]} testID="explore-sheet">
      <View {...pan.panHandlers}>
        <Pressable onPress={cycle} accessibilityRole="adjustable" accessibilityLabel={`${a11yLabel} (${snap})`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => onSnap(e.nativeEvent.actionName === 'increment'
            ? (snap === 'peek' ? 'half' : 'full') : (snap === 'full' ? 'half' : 'peek'))}
          style={styles.grabArea} testID="sheet-grabber">
          <View style={styles.grab} />
        </Pressable>
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, overflow: 'hidden' },
  grabArea: { height: 26, alignItems: 'center', justifyContent: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: palette.slate200 },
});
