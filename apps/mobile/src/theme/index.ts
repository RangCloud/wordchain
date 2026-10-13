import { useColorScheme } from 'react-native';

import { palette, type ColorTokens } from './tokens';

export * from './tokens';

/**
 * 현재 시스템 모드(라이트/다크)에 맞는 색 토큰을 돌려준다.
 * 컴포넌트는 이 훅만 쓰고 palette를 직접 import하지 않는다 → 나중에 '앱 내 테마 설정'을
 * 추가할 때도 이 함수만 바꾸면 된다.
 */
export function useTheme(): { colors: ColorTokens; isDark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? palette.dark : palette.light, isDark };
}
