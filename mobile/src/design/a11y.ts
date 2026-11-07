// Owner: Account 1. Accessibility helpers shared by all components.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the phone is set to reduce motion. Components then skip animation. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}
