/**
 * 설정 값 (G-10)
 *
 * 효과음은 소리 파일·재생 라이브러리가 없어 MVP에서 뺐다. 동작하지 않는 토글은 사용자를 속이고
 * App Store 심사(2.1 완성도)에서도 반려 사유가 된다 (QA DEF-003).
 */
export interface Settings {
  /** 남은 시간 5초 이하 진동 */
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = { haptics: true };

/** 기기 저장값은 믿지 않는다: 형식이 틀리면 기본값으로 되돌린다 */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
    const haptics = (data as Record<string, unknown>).haptics;
    return { haptics: typeof haptics === 'boolean' ? haptics : DEFAULT_SETTINGS.haptics };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
