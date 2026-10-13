import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '@/lib/icons';
import { MIN_TOUCH, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 주요 버튼. primary는 화면당 하나만 쓴다(무엇을 해야 하는지 한눈에 보이도록).
 * 높이 52로 터치 최소 기준(48dp)을 넉넉히 넘긴다.
 */
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const fg = isPrimary ? colors.onAccent : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? { backgroundColor: colors.accent }
          : { borderColor: colors.ink, borderWidth: 1.5 },
        // 누른 순간 바로 반응이 보여야 '먹혔다'고 느낀다
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
        <AppText variant="body" bold style={{ color: fg }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
