import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const SOURCES = {
  full: require('../../assets/branding/zpot-logo-full.png'),
  wordmark: require('../../assets/branding/zpot-logo-wordmark.png'),
  mark: require('../../assets/branding/zpot-mark.png'),
};
const RATIO = { full: 766 / 836, wordmark: 696 / 753, mark: 394 / 503 };

/** The official Zpot logo (never redrawn). */
export function Logo({ variant = 'full', height = 120, style }: { variant?: keyof typeof SOURCES; height?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={SOURCES[variant]} style={[{ height, width: height * RATIO[variant] }, style]} resizeMode="contain"
    accessibilityRole="image" accessibilityLabel="Zpot — Park smarter. Spend less." />;
}
