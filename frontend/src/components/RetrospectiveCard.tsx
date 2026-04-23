import type { Retrospective } from "@/lib/types";

interface RetrospectiveCardProps {
  retro: Retrospective;
}

export default function RetrospectiveCard({ retro }: RetrospectiveCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          {retro.period_start} ~ {retro.period_end}
        </h3>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>대화 {retro.conversation_count}건</span>
          <span>메시지 {retro.message_count}건</span>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        {retro.summary}
      </p>

      {retro.highlights.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-emerald-700 mb-1">성과</h4>
          <ul className="space-y-1">
            {retro.highlights.map((h, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                <span className="text-emerald-500 shrink-0">+</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {retro.challenges.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-amber-600 mb-1">도전</h4>
          <ul className="space-y-1">
            {retro.challenges.map((c, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                <span className="text-amber-500 shrink-0">!</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
