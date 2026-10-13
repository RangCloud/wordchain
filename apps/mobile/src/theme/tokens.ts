/**
 * 디자인 토큰
 *
 * 화면 코드에서는 색 값을 직접 쓰지 않고 의미 이름으로만 참조한다.
 * 다크 모드·색 변경·대비 수정이 이 파일 한 곳에서 끝나게 하기 위해서다.
 *
 * 콘셉트: "원고지" — 미색 종이 위 초록 원고지 칸. 초록(grid)은 칸·구조선에,
 * 진한 초록(accent)은 '내 단어'와 주요 버튼에만 쓴다. 본문 대비는 4.5:1 이상.
 */

export interface ColorTokens {
  /** 화면 배경 (원고지 종이) */
  paper: string;
  /** 입력칸처럼 한 겹 올라온 면 */
  paperRaised: string;
  ink: string;
  inkMuted: string;
  /** 일반 구분선 · 입력 테두리 */
  rule: string;
  /** 타이머 바의 빈 부분 */
  track: string;
  /** 원고지 칸 선 */
  grid: string;
  /** 원고지 칸 안쪽 옅은 바탕 */
  gridSoft: string;
  /** 주요 동작 · 플레이어 말풍선 */
  accent: string;
  onAccent: string;
  /** AI 말풍선 */
  aiBubble: string;
  /** 오답 · 목숨 감소 · 시간 임박 */
  danger: string;
  /** 두음법칙 표시처럼 '주의해서 볼 것' */
  warn: string;
}

const light: ColorTokens = {
  paper: '#FBFAF5',
  paperRaised: '#FFFFFF',
  ink: '#18211C',
  inkMuted: '#5E6861',
  rule: '#D5DCD6',
  track: '#E3E8E3',
  grid: '#3C8C64',
  gridSoft: '#EEF6F0',
  accent: '#2B7A53',
  onAccent: '#FFFFFF',
  aiBubble: '#EDF1EE',
  danger: '#C2412D',
  warn: '#9A5B0B',
};

const dark: ColorTokens = {
  paper: '#0F1411',
  paperRaised: '#18201B',
  ink: '#E7EEE9',
  inkMuted: '#9AA7A0',
  rule: '#2A3530',
  track: '#24302A',
  grid: '#5DBB8C',
  gridSoft: '#16241C',
  accent: '#4DB083',
  onAccent: '#0B1A12',
  aiBubble: '#1C2520',
  danger: '#F07A63',
  warn: '#E3A548',
};

export const palette = { light, dark } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;

export const fontSize = {
  caption: 12,
  label: 13,
  body: 15,
  title: 22,
  display: 36,
} as const;

/** 터치 영역 최소 크기 (Android 48dp 기준) */
export const MIN_TOUCH = 48;
