import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

interface LoadStateProps {
  /** null이면 불러오는 중, 문자열이면 오류 문구 */
  error: string | null;
  loadingText: string;
  onRetry?: () => void;
  onHome: () => void;
}

/**
 * 서버 응답을 기다리거나 실패했을 때의 화면 (게임·결과 공통).
 * 오류는 색만이 아니라 아이콘 + 문구로 함께 알리고, 다음 행동(다시 시도·홈)을 바로 준다.
 */
export function LoadState({ error, loadingText, onRetry, onHome }: LoadStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {error === null ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <AppText variant="body" tone="muted">
            {loadingText}
          </AppText>
        </View>
      ) : (
        <View style={styles.center} accessibilityLiveRegion="assertive">
          <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
          <AppText variant="body" style={styles.text}>
            {error}
          </AppText>
        </View>
      )}
      {error !== null ? (
        <View style={styles.actions}>
          {onRetry ? <Button label="다시 시도" icon="refresh" onPress={onRetry} /> : null}
          <Button label="홈으로" variant={onRetry ? 'secondary' : 'primary'} onPress={onHome} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  text: { textAlign: 'center' },
  actions: { gap: space.sm },
});
