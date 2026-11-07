// Owner: Account 1. Online/offline state for banners and for React Query.
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

let online = true;
let started = false;
const listeners = new Set<(v: boolean) => void>();

// isInternetReachable is null while unknown: treat that as online so we never show a false "offline".
const toOnline = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

export const isOnline = () => online;

/** Call once at app start (src/core/providers.tsx does). */
export function startNetworkMonitor(): void {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => {
    online = toOnline(s);
    listeners.forEach((l) => l(online));
  });
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(toOnline(s))));
  AppState.addEventListener('change', (st) => focusManager.setFocused(st === 'active'));
}

export function useOnline(): boolean {
  const [v, setV] = useState(online);
  useEffect(() => {
    setV(online);
    listeners.add(setV);
    return () => { listeners.delete(setV); };
  }, []);
  return v;
}
