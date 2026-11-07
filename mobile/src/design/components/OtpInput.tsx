// Owner: Account 1. One hidden text field drives the boxes, so paste and SMS autofill work.
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { MIN_TARGET } from '../tokens';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Number of digits. Default 6; confirm the real length against the backend in F3. */
  length?: number;
  error?: string;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
  testID?: string;
}

export function OtpInput({ value, onChange, length = 6, error, autoFocus, onComplete, testID }: OtpInputProps) {
  const { colors, radius, spacing } = useTheme();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Pressable onPress={() => ref.current?.focus()} accessible={false} style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[styles.box, { minHeight: MIN_TARGET + 8, borderRadius: radius.control, backgroundColor: colors.surface, borderColor: error ? colors.danger : active ? colors.primary : colors.lineStrong, borderWidth: active || error ? 2 : 1 }]}
            >
              <AppText variant="title" tone="ink">{value[i] ?? ''}</AppText>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={handle}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`Verification code, ${length} digits`}
        accessibilityHint={error}
        caretHidden
        style={styles.hidden}
      />
      {error ? <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: spacing.sm }}>{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Kept over the boxes (not display:none) so screen readers and the keyboard can still reach it.
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
