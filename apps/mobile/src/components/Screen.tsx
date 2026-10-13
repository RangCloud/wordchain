import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /**
   * 탭 화면은 아래쪽 안전 영역을 탭 바가 이미 처리하므로 기본값은 'top'만.
   * 모달처럼 탭 바가 없는 화면은 ['bottom']을 넘긴다.
   */
  edges?: Edge[];
}

/** 모든 화면의 바깥 틀: 안전 영역(노치·상태바) + 종이색 배경 */
export function Screen({ children, edges = ['top'] }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.paper }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
