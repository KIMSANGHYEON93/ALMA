/**
 * 앱 내 커스텀 이벤트 — 페이지 간 상태 동기화
 */

export const GOALS_CHANGED = "alma:goals-changed";

export function emitGoalsChanged() {
  window.dispatchEvent(new Event(GOALS_CHANGED));
}

export function onGoalsChanged(callback: () => void) {
  window.addEventListener(GOALS_CHANGED, callback);
  return () => window.removeEventListener(GOALS_CHANGED, callback);
}
