import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings';

/**
 * 설정 저장 (G-10)
 *
 * 설정 화면과 게임 화면이 같은 값을 봐야 하므로 모듈 안에 한 벌만 두고, 바뀌면 구독자에게 알린다.
 * 저장소를 못 읽거나 못 써도 게임은 기본값으로 계속할 수 있어야 한다.
 */
const KEY = 'wordchain.settings.v1';

let current: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

async function load(): Promise<Settings> {
  if (current) return current;
  try {
    current = parseSettings(await AsyncStorage.getItem(KEY));
  } catch {
    current = DEFAULT_SETTINGS;
  }
  return current;
}

async function update(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await load()), ...patch };
  current = next;
  listeners.forEach((fn) => fn(next));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장에 실패해도 이번 실행 동안은 바꾼 값을 쓴다
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(current ?? DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    void load().then((s) => {
      if (alive) setSettings(s);
    });
    listeners.add(setSettings);
    return () => {
      alive = false;
      listeners.delete(setSettings);
    };
  }, []);

  const change = useCallback((patch: Partial<Settings>) => void update(patch), []);
  return [settings, change];
}
