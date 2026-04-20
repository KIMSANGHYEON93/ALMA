/**
 * 차트 데이터 → 스크린 리더 요약 텍스트 생성 유틸.
 */

import type { TrendDay, CompletionHabit, CorrelationPair } from "./types";

export interface HeatmapSummary {
  totalDays: number;
  recordedDays: number;
  totalCompletions: number;
  maxStreak: number;
  mostActiveCount: number;
}

export function summarizeHeatmap(dates: Record<string, number>, year: number): HeatmapSummary {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  let totalDays = 0;
  let recordedDays = 0;
  let totalCompletions = 0;
  let maxStreak = 0;
  let curStreak = 0;
  let mostActiveCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalDays += 1;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const count = dates[key] || 0;
    if (count > 0) {
      recordedDays += 1;
      totalCompletions += count;
      curStreak += 1;
      if (curStreak > maxStreak) maxStreak = curStreak;
      if (count > mostActiveCount) mostActiveCount = count;
    } else {
      curStreak = 0;
    }
  }

  return { totalDays, recordedDays, totalCompletions, maxStreak, mostActiveCount };
}

export function formatHeatmapSummary(s: HeatmapSummary, year: number): string {
  return `${year}년 연간 습관 히트맵. 총 ${s.totalDays}일 중 ${s.recordedDays}일에 습관을 완료했습니다. 전체 완료 횟수 ${s.totalCompletions}회, 최장 연속 ${s.maxStreak}일. 하루 최대 완료 습관 수 ${s.mostActiveCount}개.`;
}

// TrendDay.rate는 0~100 사이의 퍼센트 값
export function formatTrendSummary(daily: TrendDay[]): string {
  if (daily.length === 0) return "트렌드 데이터 없음.";
  const rates = daily.map((d) => d.rate);
  const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  const max = Math.round(Math.max(...rates));
  const min = Math.round(Math.min(...rates));
  const first = daily[0].date;
  const last = daily[daily.length - 1].date;
  const trend = rates[rates.length - 1] - rates[0];
  const direction = trend > 5 ? "상승" : trend < -5 ? "하락" : "보합";
  return `${first}부터 ${last}까지 ${daily.length}일간 완료율 트렌드. 평균 ${avg}%, 최고 ${max}%, 최저 ${min}%. 기간 전반 추세 ${direction}.`;
}

// CompletionHabit.rate는 0~100 사이의 퍼센트 값
export function formatCompletionSummary(habits: CompletionHabit[]): string {
  if (habits.length === 0) return "완료율 데이터 없음.";
  if (habits.length === 1) {
    const h = habits[0];
    return `습관 1개 완료율. ${h.title} ${Math.round(h.rate)}%.`;
  }
  const sorted = [...habits].sort((a, b) => b.rate - a.rate);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const avg = Math.round(habits.reduce((acc, h) => acc + h.rate, 0) / habits.length);
  return `습관 ${habits.length}개 완료율. 평균 ${avg}%. 최고: ${top.title} ${Math.round(top.rate)}%, 최저: ${bottom.title} ${Math.round(bottom.rate)}%.`;
}

export function formatCorrelationSummary(pairs: CorrelationPair[]): string {
  if (pairs.length === 0) return "상관관계 데이터 부족.";
  const strong = pairs.filter((p) => Math.abs(p.correlation) >= 0.5);
  const moderate = pairs.filter(
    (p) => Math.abs(p.correlation) >= 0.2 && Math.abs(p.correlation) < 0.5
  );
  const positives = strong.filter((p) => p.correlation > 0).length;
  const negatives = strong.filter((p) => p.correlation < 0).length;
  return `습관 쌍 ${pairs.length}개 상관관계 분석. 강한 양의 상관 ${positives}쌍, 강한 음의 상관 ${negatives}쌍, 중간 상관 ${moderate.length}쌍.`;
}

// ─── Ontology Graph ───

import type { GraphNodeData, GraphLinkData } from "./types";

export interface GraphCategorySummary {
  category: string;
  count: number;
}

export function summarizeGraph(
  nodes: GraphNodeData[],
  links: GraphLinkData[]
): { total: string; categories: GraphCategorySummary[] } {
  const byCat: Record<string, number> = {};
  nodes.forEach((n) => {
    const c = n.parentCategory || "기타";
    byCat[c] = (byCat[c] || 0) + 1;
  });
  const categories = Object.entries(byCat)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  return {
    total: `온톨로지 그래프: 노드 ${nodes.length}개, 링크 ${links.length}개.`,
    categories,
  };
}

export function formatGraphSummary(nodes: GraphNodeData[], links: GraphLinkData[]): string {
  const s = summarizeGraph(nodes, links);
  if (s.categories.length === 0) return s.total;
  const catText = s.categories.slice(0, 5).map((c) => `${c.category} ${c.count}개`).join(", ");
  return `${s.total} 주요 카테고리: ${catText}.`;
}
