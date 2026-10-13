import { StyleSheet, Text, type TextProps } from 'react-native';

import { fontSize, useTheme, type ColorTokens } from '@/theme';

type Variant = 'display' | 'title' | 'body' | 'label' | 'caption';
type Tone = 'default' | 'muted' | 'accent' | 'danger' | 'warn' | 'grid' | 'onAccent';

interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** 점수·초처럼 자릿수가 바뀌어도 흔들리지 않아야 하는 숫자 → 고정폭 숫자(tabular-nums) */
  numeric?: boolean;
  bold?: boolean;
}

const TONE_TO_COLOR: Record<Tone, keyof ColorTokens> = {
  default: 'ink',
  muted: 'inkMuted',
  accent: 'accent',
  danger: 'danger',
  warn: 'warn',
  grid: 'grid',
  onAccent: 'onAccent',
};

/**
 * 앱의 모든 글자는 이 컴포넌트로 그린다.
 * 화면마다 fontSize·color를 따로 적으면 금세 제각각이 되므로, 크기는 variant로 색은 tone으로만 고른다.
 */
export function AppText({
  variant = 'body',
  tone = 'default',
  numeric = false,
  bold = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles[variant],
        { color: colors[TONE_TO_COLOR[tone]] },
        numeric && styles.numeric,
        bold && styles.bold,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontSize: fontSize.display, lineHeight: 48, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: fontSize.title, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 },
  body: { fontSize: fontSize.body, lineHeight: 22 },
  label: { fontSize: fontSize.label, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: fontSize.caption, lineHeight: 16 },
  numeric: { fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
});
