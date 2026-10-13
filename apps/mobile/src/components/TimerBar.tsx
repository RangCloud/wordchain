import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** 이 초 이하로 남으면 경고 상태 (기획서 2-5: 5초 이하 색 변경 + 진동 1회) */
const URGENT_SECONDS = 5;

interface TimerBarProps {
  secondsLeft: number;
  totalSeconds: number;
}

export function TimerBar({ secondsLeft, totalSeconds }: TimerBarProps) {
  const { colors } = useTheme();
  const ratio = totalSeconds > 0 ? Math.min(1, secondsLeft / totalSeconds) : 0;
  const urgent = secondsLeft <= URGENT_SECONDS;
  const color = urgent ? colors.danger : colors.accent;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`남은 시간 ${secondsLeft}초`}
    >
      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <AppText variant="body" bold numeric tone={urgent ? 'danger' : 'default'} style={styles.text}>
        {secondsLeft}초
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { flex: 1, height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  text: { width: 40, textAlign: 'right' },
});
