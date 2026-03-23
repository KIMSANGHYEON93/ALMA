import type { Goal } from "@/hooks/useGoals";

const categoryLabels: Record<string, string> = {
  personal: "개인",
  career: "커리어",
  health: "건강",
  learning: "학습",
  finance: "재정",
  other: "기타",
};

const categoryColors: Record<string, string> = {
  personal: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  career: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  health: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  learning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  finance: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const statusLabels: Record<string, string> = {
  active: "진행 중",
  completed: "완료",
  paused: "일시정지",
  abandoned: "포기",
};

interface GoalCardProps {
  goal: Goal;
  isActive: boolean;
  onClick: () => void;
}

export default function GoalCard({ goal, isActive, onClick }: GoalCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition hover:shadow-sm ${
        isActive
          ? "border-blue-500 bg-blue-50 dark:bg-gray-800 dark:border-blue-400"
          : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
          {goal.title}
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
            categoryColors[goal.category] || categoryColors.other
          }`}
        >
          {categoryLabels[goal.category] || goal.category}
        </span>
      </div>

      {goal.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2">
          {goal.description}
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              goal.progress === 100
                ? "bg-emerald-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">
          {goal.progress}%
        </span>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {goal.target_date && (
          <span className="text-xs text-gray-400">
            {goal.target_date}까지
          </span>
        )}
        {goal.status !== "active" && (
          <span className="text-xs text-gray-400">
            {statusLabels[goal.status]}
          </span>
        )}
      </div>
    </button>
  );
}
