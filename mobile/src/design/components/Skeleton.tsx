// Owner: Account 1. Grey placeholder shown while data loads. Pulses only when the phone allows motion.
import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue } from 'react-native';
import { useReduceMotion } from '../a11y';
import { useTheme } from '../theme';

export interface SkeletonProps { width?: DimensionValue; height?: number; radius?: number }

export function Skeleton({ width = '100%', height = 16, radius }: SkeletonProps) {
  const { colors, radius: r } = useTheme();
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { opacity.setValue(0.7); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduce]);
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={{ width, height, borderRadius: radius ?? r.control, backgroundColor: colors.line, opacity }}
    />
  );
}
