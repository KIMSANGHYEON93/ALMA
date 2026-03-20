import type { InsightItem } from "@/lib/types";

const categoryIcons: Record<string, string> = {
  topic_trend: "📊",
  goal_pattern: "🎯",
  activity_pattern: "📈",
  recommendation: "💡",
};

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
      <span className="text-xl shrink-0">
        {categoryIcons[insight.category] || "💡"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
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
