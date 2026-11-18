/**
 * 화면이 쓰는 게임 진행 창구.
 *
 * 앱 단독 출시: 기기 안의 엔진(localGame)을 쓴다. 서버 클라이언트(api.ts)는 나중에 랭킹 서버를 붙일 때
 * 이 파일에서만 바꿔 끼우면 되도록 남겨 둔다.
 * 단어 목록 JSON은 scripts/export_word_list.py로 만든다(국립국어원 표준국어대사전 가공, CC BY-SA 2.0 KR).
 */
import { WordList } from './engine';
import { createLocalGame, type LocalResult } from './localGame';

export type GameResultData = LocalResult;

export const gameApi = createLocalGame({
  // require를 함수 안에 두어 21만 단어 목록을 첫 게임을 만들 때 읽는다(앱 시작을 늦추지 않으려고)
  loadDictionary: () => {
    const data = require('./data/words.json') as { words: string };
    return new WordList(data.words.split('\n'));
  },
});
