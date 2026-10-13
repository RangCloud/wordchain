import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

interface LivesIndicatorProps {
  lives: number;
  max: number;
}

/** 목숨 표시. 남은 목숨은 채운 하트, 잃은 목숨은 빈 하트 — 색과 모양 둘 다로 구분한다 */
export function LivesIndicator({ lives, max }: LivesIndicatorProps) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`목숨 ${max}개 중 ${lives}개 남음`}
    >
      {Array.from({ length: max }, (_, i) => {
        const alive = i < lives;
        return (
          <Ionicons
            key={i}
            name={alive ? 'heart' : 'heart-outline'}
            size={22}
            color={alive ? colors.danger : colors.inkMuted}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
