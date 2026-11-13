import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  Vibration,
  View,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { IconButton } from '@/components/IconButton';
import { LoadState } from '@/components/LoadState';
import { LivesIndicator } from '@/components/LivesIndicator';
import { ManuscriptCells } from '@/components/ManuscriptCells';
import { Screen } from '@/components/Screen';
import { TimerBar, URGENT_SECONDS } from '@/components/TimerBar';
import { WordBubble } from '@/components/WordBubble';
import {
  isValidGameId,
  parseDifficulty,
  startsCorrectly,
  startsLabel as toStartsLabel,
} from '@/features/game/logic';
import type { ChainWord, GameState } from '@/features/game/types';
import { useCountdown } from '@/features/game/useCountdown';
import { useGameSession } from '@/features/game/useGameSession';
import { useSettings } from '@/features/settings/settingsStore';
import { formatNumber } from '@/lib/format';
import { MIN_TOUCH, fontSize, radius, space, useTheme } from '@/theme';

/**
 * 게임 화면 (G-02 ~ G-06)
 *
 * 화면 구성: [나가기 · 목숨 · 점수] → [타이머] → [단어 체인] → [다음 글자 원고지 칸 + 입력]
 *
 * 경로: /game/new?difficulty=normal → 새 게임, /game/<게임 ID> → 진행 중인 게임 이어 하기.
 * 앱은 '시작 글자'만 미리 확인(즉시 피드백)하고, 판정·목숨·점수·시간은 게임 엔진(gameClient) 결과를 따른다.
 */
export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; difficulty?: string }>();

  // URL은 누구나 만들 수 있으므로 형식이 맞는 값만 받는다. 잘못된 값이면 서버에 요청하지 않는다
  const start = useMemo(() => {
    if (params.id === 'new') {
      const difficulty = parseDifficulty(params.difficulty);
      return difficulty ? { kind: 'new' as const, difficulty } : null;
    }
    return isValidGameId(params.id) ? { kind: 'resume' as const, gameId: params.id } : null;
  }, [params.id, params.difficulty]);

  const session = useGameSession(start);
  const { game } = session;

  // 게임이 끝나면(승리·패배·기권) 결과 화면으로. 뒤로 가기로 끝난 게임에 돌아오지 않도록 replace
  useEffect(() => {
    if (game && game.status !== 'playing') router.replace(`/result/${game.gameId}`);
  }, [game, router]);

  if (!game || game.status !== 'playing') {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadState
          error={start === null ? '잘못된 게임 주소예요.' : session.loadError}
          loadingText="게임을 준비하고 있어요"
          onRetry={start === null ? undefined : session.retry}
          onHome={() => router.dismissTo('/')}
        />
      </Screen>
    );
  }

  return (
    <PlayingView
      game={game}
      submitting={session.submitting}
      feedback={session.feedback?.text ?? null}
      onSubmit={session.submit}
      onForfeit={session.forfeit}
    />
  );
}

interface PlayingViewProps {
  game: GameState;
  submitting: boolean;
  feedback: string | null;
  onSubmit: (word: string) => Promise<void>;
  onForfeit: () => Promise<void>;
}

function PlayingView({ game, submitting, feedback, onSubmit, onForfeit }: PlayingViewProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChainWord>>(null);
  const [input, setInput] = useState('');
  const secondsLeft = useCountdown(game.deadlineAt);
  const [{ haptics }] = useSettings();
  // 진동은 턴(마감 시각)마다 한 번만. 무효 단어를 내도 마감이 그대로라 다시 울리지 않는다
  const buzzedFor = useRef<number | null>(null);

  // 기획서 2-5: 남은 시간이 5초 이하가 되면 색 변경과 함께 진동 1회 (설정에서 끌 수 있다)
  useEffect(() => {
    if (!haptics || secondsLeft === 0 || secondsLeft > URGENT_SECONDS) return;
    if (buzzedFor.current === game.deadlineAt) return;
    buzzedFor.current = game.deadlineAt;
    Vibration.vibrate(150);
  }, [haptics, secondsLeft, game.deadlineAt]);

  // 실수로 X를 눌러 판이 끝나지 않도록 한 번 묻는다 (QA DEF-004)
  const confirmForfeit = useCallback(() => {
    // react-native-web의 Alert는 버튼을 지원하지 않는다. 웹은 출시 대상이 아니므로 바로 기권한다
    if (Platform.OS === 'web') {
      void onForfeit();
      return;
    }
    Alert.alert('게임을 그만둘까요?', '이번 판은 패배로 기록돼요.', [
      { text: '계속하기', style: 'cancel' },
      { text: '그만두기', style: 'destructive', onPress: () => void onForfeit() },
    ]);
  }, [onForfeit]);

  // Android 뒤로 가기도 X 버튼과 같은 확인을 거친다. 그냥 나가면 판이 기기 안에서 계속 흐른다
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmForfeit();
      return true;
    });
    return () => sub.remove();
  }, [confirmForfeit]);

  const { allowedStarts, lives, maxLives, score, chain } = game;
  const isFirstTurn = allowedStarts.length === 0;
  // 엔진과 같게 NFC로 합친다: 자모가 분리된 채 붙여 넣은 단어도 시작 글자 검사를 통과해야 한다
  const word = input.normalize('NFC').trim();
  // 첫 글자가 허용 글자가 아니면 서버에 보내기 전에 바로 알려준다
  const wrongStart = word.length > 0 && !startsCorrectly(word, allowedStarts);
  const canSubmit = word.length > 0 && !wrongStart && secondsLeft > 0 && !submitting;
  const startsLabel = toStartsLabel(allowedStarts);
  // 서버 판정 문구는 다음 단어를 입력하기 시작하면 숨긴다(지난 단어에 대한 안내이므로)
  const errorText = wrongStart
    ? `${startsLabel}(으)로 시작해야 해요`
    : word.length === 0
      ? feedback
      : null;

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit(word);
    // 판정과 관계없이 입력 칸을 비운다. 무효 단어는 아래 문구로 이유를 알려 준다
    setInput('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        // 양쪽 모두 padding: SDK 54 Android는 edge-to-edge라 키보드가 떠도 창이 줄어들지 않는다.
        // behavior가 없으면 입력칸이 키보드 밑에 깔린다 (Expo 키보드 처리 가이드)
        behavior="padding"
      >
        <View style={styles.topBar}>
          <IconButton icon="close" accessibilityLabel="기권하고 나가기" onPress={confirmForfeit} />
          <LivesIndicator lives={lives} max={maxLives} />
          <AppText
            variant="body"
            bold
            numeric
            style={styles.score}
            accessibilityLabel={`점수 ${score}점`}
          >
            {formatNumber(score)}점
          </AppText>
        </View>

        <View style={styles.timer}>
          <TimerBar secondsLeft={secondsLeft} totalSeconds={game.turnSeconds} />
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
            {isFirstTurn ? (
              <AppText variant="body">아무 글자로나 시작하세요</AppText>
            ) : (
              <ManuscriptCells
                chars={allowedStarts}
                size={40}
                separated
                // 두 번째 글자부터는 두음법칙으로 바뀐 글자임을 표시한다
                tags={allowedStarts.length > 1 ? { 1: '두음' } : {}}
                accessibilityLabel={`${startsLabel}(으)로 시작`}
              />
            )}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void submit()}
              // 키보드 완료 키로 제출해도 키보드가 닫히지 않게 해 다음 단어를 바로 입력한다
              submitBehavior="submit"
              editable={!submitting}
              placeholder={
                isFirstTurn
                  ? '첫 단어를 입력하세요'
                  : `${allowedStarts.join(' / ')}(으)로 시작하는 단어`
              }
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
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="단어 제출"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
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

          {errorText ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <AppText variant="caption" tone="danger">
                {errorText}
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
