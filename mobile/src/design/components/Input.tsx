// Owner: Account 1.
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from '../Text';
import { useTheme } from '../theme';
import { MIN_TARGET, fonts } from '../tokens';

export interface InputProps
  extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing' | 'editable' | 'maxLength' | 'autoCorrect'> {
  label: string;
  error?: string;
  helper?: string;
  /** Shows a Show/Hide button. */
  secureTextEntry?: boolean;
  testID?: string;
}

export function Input({ label, error, helper, secureTextEntry, testID, ...rest }: InputProps) {
  const { colors, radius, spacing, textScale } = useTheme();
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const [focused, setFocused] = useState(false);
  const border = error ? colors.danger : focused ? colors.primary : colors.lineStrong;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AppText variant="label" tone="ink" style={{ marginBottom: spacing.xs }}>{label}</AppText>
      <View style={[styles.field, { borderColor: border, borderRadius: radius.control, backgroundColor: colors.surface, minHeight: MIN_TARGET, borderWidth: focused || error ? 2 : 1 }]}>
        <TextInput
          testID={testID}
          {...rest}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          secureTextEntry={secureTextEntry ? hidden : false}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, minHeight: MIN_TARGET - 4, paddingHorizontal: spacing.md, color: colors.text, fontFamily: fonts.body, fontSize: Math.round(16 * textScale) }}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}
          >
            <AppText variant="label" tone="link">{hidden ? 'Show' : 'Hide'}</AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite" style={{ marginTop: spacing.xs }}>{error}</AppText>
      ) : helper ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>{helper}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ field: { flexDirection: 'row', alignItems: 'center' } });
