import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ManuscriptCells } from '@/components/ManuscriptCells';
import { Screen } from '@/components/Screen';
import { space, useTheme } from '@/theme';

/** 기획서 2-1 게임 규칙과 문구를 맞춘다. 규칙이 바뀌면 기획서와 이 배열을 함께 고친다 */
const RULES = [
  '사전에 있는 2글자 이상의 명사만 쓸 수 있어요.',
  '앞 단어의 마지막 글자로 시작해야 해요. 두음법칙도 인정돼요.',
  '한 판에서 이미 나온 단어는 다시 쓸 수 없어요.',
  '한 턴은 15초예요. 어려움 난이도는 10초예요.',
  '첫 턴에는 이어갈 단어가 없는 한방단어를 쓸 수 없어요.',
  '목숨은 3개예요. 틀리면 하나를 잃고 다시 입력할 수 있어요.',
  'AI가 이어갈 단어를 찾지 못하면 내가 이겨요.',
] as const;

/** 두음법칙 예시: [끝 글자, 바뀐 글자, 예시 단어 흐름] */
const DUEUM_EXAMPLES = [
  { from: '력', to: '역', example: '실력 → 역량' },
  { from: '량', to: '양', example: '역량 → 양말' },
  { from: '녀', to: '여', example: '소녀 → 여름' },
] as const;

export default function RulesScreen() {
  const { colors } = useTheme();
  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.rules}>
          {RULES.map((rule, i) => (
            <View key={rule} style={styles.rule}>
              <AppText variant="body" tone="grid" bold numeric style={styles.num}>
                {i + 1}
              </AppText>
              <AppText variant="body" style={styles.ruleText}>
                {rule}
              </AppText>
            </View>
          ))}
        </View>

        <View style={[styles.dueum, { borderColor: colors.rule }]}>
          <AppText variant="body" bold accessibilityRole="header">
            두음법칙이란?
          </AppText>
          <AppText variant="label" tone="muted">
            단어 첫머리의 ㄹ·ㄴ이 ㅇ·ㄴ으로 바뀌는 규칙이에요. 끝 글자가 바뀐 글자로 시작해도 정답이에요.
          </AppText>
          {DUEUM_EXAMPLES.map((ex) => (
            <View key={ex.from} style={styles.example}>
              <ManuscriptCells chars={[ex.from]} size={36} />
              <AppText variant="body" tone="muted">
                →
              </AppText>
              <ManuscriptCells chars={[ex.to]} size={36} />
              <AppText variant="label" tone="muted" style={styles.exampleText}>
                {ex.example}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl },
  rules: { gap: space.md },
  rule: { flexDirection: 'row', gap: space.md },
  num: { width: 18 },
  ruleText: { flex: 1 },
  dueum: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xl, gap: space.md },
  example: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exampleText: { marginLeft: space.sm },
});
