import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import type { IconName } from '@/lib/icons';
import { MIN_TOUCH, useTheme } from '@/theme';

interface IconButtonProps {
  icon: IconName;
  /** 아이콘만 있는 버튼은 화면 낭독기가 읽을 이름이 반드시 필요하다 */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}

export function IconButton({ icon, accessibilityLabel, onPress, disabled = false }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.base, pressed && { opacity: 0.6 }, disabled && { opacity: 0.3 }]}
    >
      <Ionicons name={icon} size={22} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
