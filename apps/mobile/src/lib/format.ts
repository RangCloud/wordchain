/**
 * 1340 → "1,340"
 * Intl/toLocaleString 대신 정규식을 쓰는 이유: Android Hermes의 Intl 지원 범위가
 * 빌드 설정에 따라 달라 기기마다 표시가 달라질 수 있기 때문이다.
 */
export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : '';
  return sign + Math.abs(Math.trunc(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
