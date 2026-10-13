import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { useTheme } from '@/theme';

/**
 * 최상위 Stack.
 * 게임은 '홈 → 게임 → 결과'로 한 방향으로 흐르므로 탭 없이 Stack 하나로 구성한다.
 */
export default function RootLayout() {
  const { colors, isDark } = useTheme();

  // 네비게이션 기본 색을 토큰으로 덮어 화면 전환 때 흰 배경이 번쩍이지 않게 한다
  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.paper,
        card: colors.paper,
        text: colors.ink,
        border: colors.rule,
        primary: colors.accent,
      },
    };
  }, [colors, isDark]);

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* 게임 중에는 뒤로 가기 제스처로 실수로 나가지 않도록 막고, 나가기는 X 버튼(기권)으로만 */}
        <Stack.Screen name="game/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="result/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="rules" options={{ title: '규칙' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
