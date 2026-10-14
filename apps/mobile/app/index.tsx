import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ManuscriptCells } from '@/components/ManuscriptCells';
import { Screen } from '@/components/Screen';
import { DIFFICULTIES, type Difficulty } from '@/features/game/types';
import { formatNumber } from '@/lib/format';
import type { IconName } from '@/lib/icons';
import { MIN_TOUCH, space, useTheme } from '@/theme';

/**
 * 홈: 로고(원고지 칸) → 난이도 선택 → 게임 시작
 * 시작까지 탭 두 번(난이도, 시작)이면 되도록 설정·규칙은 아래쪽 보조 링크로 뺐다.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ManuscriptCells chars={['말', '꼬', '리']} size={64} accessibilityLabel="말꼬리" />
          <AppText variant="body" tone="muted" style={styles.tagline}>
            AI와 한 판 2분, 끝말잇기
          </AppText>
        </View>

        <AppText variant="label" tone="muted" accessibilityRole="header">
          난이도
        </AppText>
        <View accessibilityRole="radiogroup" style={[styles.options, { borderColor: colors.rule }]}>
          {DIFFICULTIES.map((d, i) => {
            const selected = d.id === difficulty;
            // 최고 기록(G-08)은 기기 저장소를 붙일 때 채운다. 가짜 기록을 보여 주지 않도록 비워 둔다
            const best: number | null = null;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDifficulty(d.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${d.name}, ${d.description}, 최고 기록 ${best ?? '없음'}`}
                style={({ pressed }) => [
                  styles.option,
                  i > 0 && {
                    borderTopColor: colors.rule,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                  // 선택 상태: 왼쪽 굵은 선 + 옅은 바탕 + 채운 라디오 (색에만 의존하지 않음)
                  selected && { backgroundColor: colors.gridSoft, borderLeftColor: colors.accent },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? colors.accent : colors.inkMuted}
                />
                <View style={styles.optionText}>
                  <AppText variant="body" bold={selected}>
                    {d.name}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {d.description}
                  </AppText>
                </View>
                <View style={styles.best}>
                  <AppText variant="caption" tone="muted">
                    최고
                  </AppText>
                  <AppText variant="label" bold numeric>
                    {best !== null ? `${formatNumber(best)}점` : '-'}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="게임 시작"
          icon="play"
          onPress={() => router.push(`/game/new?difficulty=${difficulty}`)}
        />
        <View style={styles.links}>
          <TextLink icon="book-outline" label="규칙" onPress={() => router.push('/rules')} />
          <TextLink icon="settings-outline" label="설정" onPress={() => router.push('/settings')} />
        </View>
      </View>
    </Screen>
  );
}

function TextLink({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={18} color={colors.inkMuted} />
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.sm },
  hero: { alignItems: 'center', paddingVertical: space.xxl * 1.5, gap: space.lg },
  tagline: { letterSpacing: 0.5 },
  options: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  option: {
    minHeight: MIN_TOUCH + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  optionText: { flex: 1, gap: 2 },
  best: { alignItems: 'flex-end' },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.xs },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  link: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
  },
});
