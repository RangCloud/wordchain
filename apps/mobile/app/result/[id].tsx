import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { ManuscriptCells } from '@/components/ManuscriptCells';
import { Screen } from '@/components/Screen';
import { gameApi, type ServerResult } from '@/features/game/api';
import { errorMessage, isValidGameId } from '@/features/game/logic';
import { DIFFICULTIES, REASON_LABELS, type ResultWord } from '@/features/game/types';
import { formatNumber } from '@/lib/format';
import { MIN_TOUCH, space, useTheme } from '@/theme';

/**
 * 결과 (G-07, G-08)
 * 승패 → 점수·기록 → 이번 판에 나온 단어와 뜻(탭해서 펼침) → 다시 하기
 * 뜻풀이를 보여주는 이유: 게임이 끝난 뒤에도 '모르던 단어를 배웠다'는 가치를 남기기 위해서다.
 */
export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const validId = isValidGameId(id);
  const [result, setResult] = useState<ServerResult | null>(null);
  const [error, setError] = useState<string | null>(validId ? null : '잘못된 결과 주소예요.');

  const load = useCallback(async () => {
    if (!isValidGameId(id)) return;
    setError(null);
    try {
      setResult(await gameApi.getResult(id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!result) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadState
          error={error}
          loadingText="결과를 불러오고 있어요"
          onRetry={validId ? load : undefined}
          onHome={() => router.dismissTo('/')}
        />
      </Screen>
    );
  }
  return <ResultView result={result} />;
}

function ResultView({ result }: { result: ServerResult }) {
  const router = useRouter();
  const { colors } = useTheme();
  // 최고 기록(G-08)은 기기 저장소가 필요해 아직 연결하지 않았다
  const isNewBest = false;
  const won = result.outcome === 'won';
  const difficultyName = DIFFICULTIES.find((d) => d.id === result.difficulty)?.name ?? '';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ManuscriptCells chars={won ? ['승', '리'] : ['패', '배']} size={56} />
          <AppText variant="body" tone="muted">
            {REASON_LABELS[result.reason]}
          </AppText>
        </View>

        <View style={[styles.scoreBox, { borderColor: colors.rule }]}>
          <AppText variant="label" tone="muted">
            {difficultyName} · 최종 점수
          </AppText>
          <AppText variant="display" numeric>
            {formatNumber(result.score)}
            <AppText variant="title" tone="muted">
              {' '}
              점
            </AppText>
          </AppText>
          {isNewBest ? (
            <View style={styles.best}>
              <Ionicons name="trophy" size={16} color={colors.warn} />
              <AppText variant="label" tone="warn" bold>
                최고 기록 갱신
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText
          variant="label"
          tone="muted"
          accessibilityRole="header"
          style={styles.sectionTitle}
        >
          이번 판의 단어 {result.words.length}개
        </AppText>
        <View>
          {result.words.map((w) => (
            <WordRow key={w.turn} item={w} />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="다시 하기"
          icon="refresh"
          onPress={() => router.replace(`/game/new?difficulty=${result.difficulty}`)}
        />
        <Button label="홈으로" variant="secondary" onPress={() => router.dismissTo('/')} />
      </View>
    </Screen>
  );
}

/** 단어 한 줄. 탭하면 뜻풀이가 펼쳐진다 */
function WordRow({ item }: { item: ResultWord }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const isPlayer = item.speaker === 'player';

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${item.word}, ${isPlayer ? '내 단어' : 'AI 단어'}, 뜻 ${open ? '접기' : '보기'}`}
      style={({ pressed }) => [
        styles.wordRow,
        { borderBottomColor: colors.rule },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.wordMain}>
        <AppText variant="caption" tone="muted" numeric style={styles.turn}>
          {item.turn}
        </AppText>
        <AppText variant="body" bold style={styles.word}>
          {item.word}
        </AppText>
        <AppText variant="caption" tone={isPlayer ? 'accent' : 'muted'} bold={isPlayer}>
          {isPlayer ? '나' : 'AI'}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkMuted} />
      </View>
      {open ? (
        <AppText variant="label" tone="muted" style={styles.definition}>
          {item.definition}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.xxl, paddingBottom: space.xl },
  scoreBox: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  best: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sectionTitle: { marginTop: space.xl, marginBottom: space.xs },
  wordRow: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wordMain: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  turn: { width: 20, textAlign: 'right' },
  word: { flex: 1 },
  definition: { paddingLeft: 20 + space.md, paddingTop: space.xs },
  footer: { padding: space.lg, paddingTop: space.sm, gap: space.sm },
});
