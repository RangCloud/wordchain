import { StyleSheet, Text, View } from 'react-native';

import type { ChainWord } from '@/features/game/types';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/**
 * 단어 체인의 말풍선. 메신저처럼 AI는 왼쪽, 나는 오른쪽.
 *
 * 마지막 글자를 굵게·밑줄로 강조한다 → 다음 사람이 이어야 할 글자가 눈에 바로 들어오고,
 * 체인이 '꼬리를 문다'는 게임의 핵심이 화면 모양으로 드러난다.
 */
export function WordBubble({ item }: { item: ChainWord }) {
  const { colors } = useTheme();
  const isPlayer = item.speaker === 'player';
  const head = item.word.slice(0, -1);
  const tail = item.word.slice(-1);
  const textColor = isPlayer ? colors.onAccent : colors.ink;

  return (
    <View
      style={[styles.row, isPlayer ? styles.right : styles.left]}
      accessible
      accessibilityLabel={`${item.turn}턴, ${isPlayer ? '나' : 'AI'}: ${item.word}`}
    >
      <AppText variant="caption" tone="muted" style={styles.who}>
        {isPlayer ? '나' : 'AI'} · {item.turn}턴
      </AppText>
      <View
        style={[
          styles.bubble,
          isPlayer
            ? { backgroundColor: colors.accent, borderBottomRightRadius: radius.sm }
            : { backgroundColor: colors.aiBubble, borderBottomLeftRadius: radius.sm },
        ]}
      >
        <Text style={[styles.word, { color: textColor }]}>
          {head}
          <Text
            style={[
              styles.tail,
              { color: isPlayer ? colors.onAccent : colors.grid, textDecorationColor: textColor },
            ]}
          >
            {tail}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { maxWidth: '75%', gap: 4 },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  who: { paddingHorizontal: space.xs },
  bubble: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  word: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: 1 },
  tail: { fontWeight: '800', textDecorationLine: 'underline' },
});
