import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** Wires NetInfo into React Query (pause/resume) and exposes an `online` flag for banners. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener(s => {
    const on = s.isConnected !== false && s.isInternetReachable !== false;
    setOnline(on);
    onlineManager.setOnline(on);
  }), []);
  return online;
}
