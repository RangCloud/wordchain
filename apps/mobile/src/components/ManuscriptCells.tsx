import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface ManuscriptCellsProps {
  /** 칸에 넣을 글자들 (한 칸 = 한 글자) */
  chars: string[];
  /** 칸 한 변의 길이 */
  size?: number;
  /** 칸 아래 작은 꼬리표. 인덱스 → 문구 (예: { 1: '두음' }) */
  tags?: Partial<Record<number, string>>;
  /** 칸 사이를 띄울지(선택지 나열) 붙일지(한 단어) */
  separated?: boolean;
  accessibilityLabel?: string;
}

const BORDER = 1.5;

/**
 * 원고지 칸. 앱 로고, 다음 시작 글자, 결과 제목에 함께 쓰는 이 앱만의 시각 요소다.
 *
 * 한 단어일 때는 칸을 붙여(테두리를 겹쳐) 실제 원고지처럼 보이게 하고,
 * '량 / 양'처럼 선택지를 나열할 때는 separated로 띄워 서로 다른 답임을 보여준다.
 */
export function ManuscriptCells({
  chars,
  size = 48,
  tags = {},
  separated = false,
  accessibilityLabel,
}: ManuscriptCellsProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.row, separated && { gap: size * 0.25 }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? chars.join('')}
    >
      {chars.map((ch, i) => (
        <View key={`${ch}-${i}`} style={styles.col}>
          <View
            style={[
              styles.cell,
              {
                width: size,
                height: size,
                borderColor: colors.grid,
                backgroundColor: colors.gridSoft,
                // 붙은 칸은 왼쪽 테두리를 겹쳐 선 두께가 두 배로 보이지 않게 한다
                marginLeft: !separated && i > 0 ? -BORDER : 0,
              },
            ]}
          >
            <AppText
              style={{ fontSize: size * 0.52, lineHeight: size * 0.7, color: colors.ink }}
              bold
            >
              {ch}
            </AppText>
          </View>
          {tags[i] ? (
            <AppText variant="caption" tone="warn" bold style={styles.tag}>
              {tags[i]}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  col: { alignItems: 'center' },
  cell: { borderWidth: BORDER, alignItems: 'center', justifyContent: 'center' },
  tag: { marginTop: 4 },
});
