import type { InsightItem } from "@/lib/types";

function CategoryIcon({ category }: { category: string }) {
  const cls = "w-5 h-5";
  switch (category) {
    case "topic_trend":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3v18h18M7 16l4-4 4 4 5-5" />
        </svg>
      );
    case "goal_pattern":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" strokeWidth={1.5} /><circle cx="12" cy="12" r="6" strokeWidth={1.5} /><circle cx="12" cy="12" r="2" strokeWidth={1.5} />
        </svg>
      );
    case "activity_pattern":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7zM9 21h6" />
        </svg>
      );
  }
}

const categoryLabels: Record<string, string> = {
  topic_trend: "주제 트렌드",
  goal_pattern: "목표 패턴",
  activity_pattern: "활동 패턴",
  recommendation: "추천",
};

interface InsightCardProps {
  insight: InsightItem;
}

export default function InsightCard({ insight }: InsightCardProps) {
  return (
    <div className="flex gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800">
      <span className="text-sky-500 shrink-0">
        <CategoryIcon category={insight.category} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
            {categoryLabels[insight.category] || insight.category}
          </span>
          {insight.source_period && (
            <span className="text-xs text-gray-400">{insight.source_period}</span>
          )}
        </div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          {insight.title}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {insight.content}
        </p>
      </div>
    </div>
  );
}
