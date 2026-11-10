import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { IconName } from '@/lib/icons';
import { MIN_TOUCH, space, useTheme } from '@/theme';

/**
 * 설정 (G-10)
 * 지금은 화면 안에서만 상태를 가진다. 3주차에 AsyncStorage에 저장해 앱을 다시 켜도 유지되게 한다.
 */
export default function SettingsScreen() {
  const { colors } = useTheme();
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const version = Constants.expoConfig?.version ?? '-';

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={styles.content}
    >
      <AppText variant="label" tone="muted" accessibilityRole="header">
        피드백
      </AppText>
      <ToggleRow icon="volume-medium-outline" label="효과음" value={sound} onChange={setSound} />
      <ToggleRow icon="phone-portrait-outline" label="진동" value={haptics} onChange={setHaptics} />

      <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.group}>
        정보
      </AppText>
      <InfoRow icon="library-outline" label="사전 출처" value="표준국어대사전" />
      <InfoRow icon="information-circle-outline" label="버전" value={version} />
      {/* CC BY-SA 2.0 KR 조건(저작자·변경 사실 표시). 문구는 README '표기 문구'와 같게 유지한다 */}
      <AppText variant="caption" tone="muted" style={styles.license}>
        이 앱의 단어는 국립국어원 표준국어대사전(https://stdict.korean.go.kr)의 자료를 가공하여
        사용했습니다. 해당 자료는 크리에이티브 커먼즈 저작자표시-동일조건변경허락 2.0 대한민국
        라이선스(https://creativecommons.org/licenses/by-sa/2.0/kr/)에 따라 이용할 수 있습니다. 이
        앱은 국립국어원과 관련이 없습니다.
      </AppText>
    </ScrollView>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.rule }]}>
      <Ionicons name={icon} size={20} color={colors.inkMuted} />
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.accent, false: colors.track }}
        thumbColor={colors.paperRaised}
      />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.rule }]} accessible accessibilityLabel={`${label}, ${value}`}>
      <Ionicons name={icon} size={20} color={colors.inkMuted} />
      <AppText variant="body" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="body" tone="muted">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xs },
  group: { marginTop: space.xl },
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  license: { marginTop: space.md },
});
