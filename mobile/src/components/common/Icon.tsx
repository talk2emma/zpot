import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

/** Stroke icons matching the prototype's feather-style set (24 viewBox, 2px stroke, round joins). */
export type IconName =
  | 'search' | 'bell' | 'filter' | 'clock' | 'list' | 'map' | 'layers' | 'plus' | 'minus' | 'navigation'
  | 'flag' | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'chevronUp' | 'close' | 'check' | 'share' | 'bookmark' | 'user'
  | 'compass' | 'shield' | 'alert' | 'info' | 'globe' | 'mail' | 'crosshair' | 'star' | 'calendar' | 'pin'
  | 'settings' | 'help' | 'file' | 'logout' | 'trash' | 'offline' | 'euro' | 'walk' | 'eye' | 'eyeOff';

const P: Record<IconName, (c: string) => React.ReactNode> = {
  search: () => <><Circle cx="11" cy="11" r="7" /><Line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  bell: () => <><Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  filter: () => <><Line x1="4" y1="6" x2="20" y2="6" /><Line x1="7" y1="12" x2="17" y2="12" /><Line x1="10" y1="18" x2="14" y2="18" /></>,
  clock: () => <><Circle cx="12" cy="12" r="9" /><Polyline points="12 7 12 12 15 14" /></>,
  list: () => <><Line x1="9" y1="6" x2="20" y2="6" /><Line x1="9" y1="12" x2="20" y2="12" /><Line x1="9" y1="18" x2="20" y2="18" /><Circle cx="4.5" cy="6" r="0.6" /><Circle cx="4.5" cy="12" r="0.6" /><Circle cx="4.5" cy="18" r="0.6" /></>,
  map: () => <><Polyline points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><Line x1="8" y1="2" x2="8" y2="18" /><Line x1="16" y1="6" x2="16" y2="22" /></>,
  layers: () => <><Polyline points="12 2 2 7 12 12 22 7 12 2" /><Polyline points="2 17 12 22 22 17" /><Polyline points="2 12 12 17 22 12" /></>,
  plus: () => <><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: () => <Line x1="5" y1="12" x2="19" y2="12" />,
  navigation: () => <Polyline points="3 11 22 2 13 21 11 13 3 11" />,
  flag: () => <><Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><Line x1="4" y1="22" x2="4" y2="15" /></>,
  chevronLeft: () => <Polyline points="15 18 9 12 15 6" />,
  chevronRight: () => <Polyline points="9 18 15 12 9 6" />,
  chevronDown: () => <Polyline points="6 9 12 15 18 9" />,
  chevronUp: () => <Polyline points="18 15 12 9 6 15" />,
  close: () => <><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></>,
  check: () => <Polyline points="20 6 9 17 4 12" />,
  share: () => <><Circle cx="18" cy="5" r="3" /><Circle cx="6" cy="12" r="3" /><Circle cx="18" cy="19" r="3" /><Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>,
  bookmark: () => <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  user: () => <><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx="12" cy="7" r="4" /></>,
  compass: () => <><Circle cx="12" cy="12" r="9" /><Polyline points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>,
  shield: () => <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  alert: () => <><Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><Line x1="12" y1="9" x2="12" y2="13" /><Line x1="12" y1="17" x2="12.01" y2="17" /></>,
  info: () => <><Circle cx="12" cy="12" r="9" /><Line x1="12" y1="16" x2="12" y2="12" /><Line x1="12" y1="8" x2="12.01" y2="8" /></>,
  globe: () => <><Circle cx="12" cy="12" r="9" /><Line x1="3" y1="12" x2="21" y2="12" /><Path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z" /></>,
  mail: () => <><Rect x="3" y="5" width="18" height="14" rx="2" /><Polyline points="3 7 12 13 21 7" /></>,
  crosshair: () => <><Circle cx="12" cy="12" r="7" /><Circle cx="12" cy="12" r="2.5" /><Line x1="12" y1="1" x2="12" y2="5" /><Line x1="12" y1="19" x2="12" y2="23" /><Line x1="1" y1="12" x2="5" y2="12" /><Line x1="19" y1="12" x2="23" y2="12" /></>,
  star: () => <Polyline points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  calendar: () => <><Rect x="3" y="4" width="18" height="18" rx="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" /></>,
  pin: () => <><Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><Circle cx="12" cy="10" r="3" /></>,
  settings: () => <><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  help: () => <><Circle cx="12" cy="12" r="9" /><Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><Line x1="12" y1="17" x2="12.01" y2="17" /></>,
  file: () => <><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><Polyline points="14 2 14 8 20 8" /></>,
  logout: () => <><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1="21" y1="12" x2="9" y2="12" /></>,
  trash: () => <><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><Path d="M10 11v6M14 11v6M9 6V4h6v2" /></>,
  offline: () => <><Line x1="1" y1="1" x2="23" y2="23" /><Path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0" /><Line x1="12" y1="20" x2="12.01" y2="20" /></>,
  euro: () => <><Path d="M17 6.5A7 7 0 1 0 17 17.5" /><Line x1="4" y1="10" x2="13" y2="10" /><Line x1="4" y1="14" x2="13" y2="14" /></>,
  walk: () => <><Circle cx="13" cy="4" r="2" /><Path d="M9 21l2-6 3 2v4M7 12l2-4 4 1 2 3 3 1" /></>,
  eye: () => <><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><Circle cx="12" cy="12" r="3" /></>,
  eyeOff: () => <><Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><Line x1="1" y1="1" x2="23" y2="23" /></>,
};

export function Icon({ name, size = 20, color = '#00233D', strokeWidth = 2, fill = 'none' }:
  { name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {P[name](color)}
    </Svg>
  );
}
