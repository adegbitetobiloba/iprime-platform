// Owner: Account 1. Every piece of text in the app goes through this so size, font and colour stay consistent.
import { Text, type TextProps } from 'react-native';
import { useTheme } from './theme';
import { typeScale, type TextVariant, type ThemeColors } from './tokens';

export type TextTone = 'text' | 'muted' | 'ink' | 'link' | 'danger' | 'success' | 'onPrimary';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

export function AppText({ variant = 'body', tone = 'text', style, ...rest }: AppTextProps) {
  const { colors, textScale } = useTheme();
  const t = typeScale[variant];
  const size = Math.round(t.size * textScale);
  const color = colors[tone as keyof ThemeColors];
  return (
    <Text
      // The phone's own font scaling still applies; this cap stops layouts from breaking at the largest settings.
      maxFontSizeMultiplier={1.5}
      accessibilityRole={variant === 'display' || variant === 'title' ? 'header' : rest.accessibilityRole}
      {...rest}
      style={[{ fontFamily: t.font, fontSize: size, lineHeight: Math.round(size * 1.4), color }, style]}
    />
  );
}
