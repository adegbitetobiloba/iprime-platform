// Owner: Account 1. One short message at a time: useToast().show({ message, tone }).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../a11y';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { motion } from '../tokens';
import { useToneColors, type Tone } from './Badge';

export interface ToastOptions { message: string; tone?: Tone; durationMs?: number }
interface ToastApi { show: (t: ToastOptions) => void }
const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error('useToast must be used inside <ToastProvider> (see src/core/providers.tsx)');
  return t;
}

function ToastView({ toast }: { toast: ToastOptions }) {
  const { radius, spacing } = useTheme();
  const c = useToneColors(toast.tone ?? 'neutral');
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { opacity.setValue(1); return; }
    Animated.timing(opacity, { toValue: 1, duration: motion.base, useNativeDriver: true }).start();
  }, [opacity, reduce]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: Math.max(insets.bottom, spacing.lg) + spacing.lg, opacity }}
    >
      <View accessible accessibilityLabel={toast.message} style={{ backgroundColor: c.bg, borderColor: c.fg, borderWidth: 1, borderRadius: radius.control, padding: spacing.md }}>
        <AppText variant="label" style={{ color: c.fg }}>{toast.message}</AppText>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const show = useCallback((t: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    setToast({ ...t, id: counter.current });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(t.message);
    timer.current = setTimeout(() => setToast(null), t.durationMs ?? 3500);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}
