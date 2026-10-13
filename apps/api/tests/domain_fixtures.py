from app.domain.dictionary import InMemoryDictionary

# 규칙 엔진·AI 테스트가 함께 쓰는 작은 사전.
# "기쁨"은 "쁨"으로 시작하는 단어가 없어 한방단어, "술"은 1글자라 사전에서 걸러진다
WORDS = [
    "역량", "양말", "말미", "미술", "술래", "내일", "일기",
    "기름", "기쁨", "기차", "기상예보", "보리", "차례", "예술",
    "사과", "과자", "자리", "이름", "늠름", "술",
]  # fmt: skip


def make_dictionary() -> InMemoryDictionary:
    return InMemoryDictionary(WORDS)
