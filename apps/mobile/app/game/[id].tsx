import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { LivesIndicator } from '@/components/LivesIndicator';
import { ManuscriptCells } from '@/components/ManuscriptCells';
import { Screen } from '@/components/Screen';
import { TimerBar } from '@/components/TimerBar';
import { WordBubble } from '@/components/WordBubble';
import { MOCK_GAME } from '@/features/game/mock';
import type { ChainWord } from '@/features/game/types';
import { useCountdown } from '@/features/game/useCountdown';
import { formatNumber } from '@/lib/format';
import { MIN_TOUCH, fontSize, radius, space, useTheme } from '@/theme';

/**
 * 게임 화면 (G-02 ~ G-06)
 *
 * 화면 구성: [나가기 · 목숨 · 점수] → [타이머] → [단어 체인] → [다음 글자 원고지 칸 + 입력]
 *
 * 지금은 임시 진행 상태(MOCK_GAME)를 보여주고, 제출하면 체인에 단어만 붙인다.
 * 2주차에 제출 → POST /v1/games/{id}/moves → 서버 판정 결과(OK/오류 코드) + AI 단어 표시로 바뀐다.
 * 앱은 '시작 글자'만 미리 확인(즉시 피드백)하고, 최종 판정은 항상 서버가 한다.
 */
export default function GameScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChainWord>>(null);

  const [chain, setChain] = useState<ChainWord[]>(MOCK_GAME.chain);
  const [input, setInput] = useState('');
  // 화면이 열린 순간 + 제한 시간 = 마감 시각 (2주차에는 서버가 준 deadline 사용)
  const [deadline] = useState(() => Date.now() + MOCK_GAME.turnSeconds * 1000);
  const secondsLeft = useCountdown(deadline);

  const { allowedStarts, lives, maxLives, score } = MOCK_GAME;
  const word = input.trim();
  // 첫 글자가 허용 글자가 아니면 서버에 보내기 전에 바로 알려준다
  const wrongStart = word.length > 0 && !allowedStarts.includes(word.charAt(0));
  const canSubmit = word.length > 0 && !wrongStart && secondsLeft > 0;
  const startsLabel = allowedStarts.map((c) => `'${c}'`).join(' 또는 ');

  const submit = () => {
    if (!canSubmit) return;
    setChain((prev) => [...prev, { turn: prev.length + 1, speaker: 'player', word }]);
    setInput('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        // iOS는 padding, Android는 windowSoftInputMode가 처리하므로 별도 동작 없음
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <IconButton
            icon="close"
            accessibilityLabel="기권하고 나가기"
            onPress={() => router.replace('/result/demo')}
          />
          <LivesIndicator lives={lives} max={maxLives} />
          <AppText variant="body" bold numeric style={styles.score} accessibilityLabel={`점수 ${score}점`}>
            {formatNumber(score)}점
          </AppText>
        </View>

        <View style={styles.timer}>
          <TimerBar secondsLeft={secondsLeft} totalSeconds={MOCK_GAME.turnSeconds} />
        </View>

        <FlatList
          ref={listRef}
          data={chain}
          keyExtractor={(item) => String(item.turn)}
          renderItem={({ item }) => <WordBubble item={item} />}
          contentContainerStyle={styles.chain}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={[styles.composer, { borderTopColor: colors.rule }]}>
          <View style={styles.hintRow}>
            <AppText variant="label" tone="muted">
              다음 글자
            </AppText>
            <ManuscriptCells
              chars={allowedStarts}
              size={40}
              separated
              // 두 번째 글자부터는 두음법칙으로 바뀐 글자임을 표시한다
              tags={allowedStarts.length > 1 ? { 1: '두음' } : {}}
              accessibilityLabel={`${startsLabel}(으)로 시작`}
            />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={submit}
              placeholder={`${allowedStarts.join(' / ')}(으)로 시작하는 단어`}
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel="단어 입력"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="send"
              maxLength={20}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  backgroundColor: colors.paperRaised,
                  borderColor: wrongStart ? colors.danger : colors.rule,
                  borderWidth: wrongStart ? 1.5 : 1,
                },
              ]}
            />
            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="단어 제출"
              accessibilityState={{ disabled: !canSubmit }}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: colors.accent },
                !canSubmit && { opacity: 0.35 },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.onAccent} />
            </Pressable>
          </View>

          {wrongStart ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <AppText variant="caption" tone="danger">
                {startsLabel}(으)로 시작해야 해요
              </AppText>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  score: { minWidth: 72, textAlign: 'right', paddingRight: space.sm, fontSize: fontSize.body + 1 },
  timer: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  chain: { padding: space.lg, gap: space.md },
  composer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: fontSize.body + 2,
  },
  send: {
    width: MIN_TOUCH + 4,
    height: MIN_TOUCH + 4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -space.xs },
});
