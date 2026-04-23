"use client";

import type { GraphNodeData } from "@/lib/types";

interface NodeDetailPanelProps {
  node: GraphNodeData;
  onClose: () => void;
  onVerify?: (id: string) => void;
}

export default function NodeDetailPanel({
  node,
  onClose,
  onVerify,
}: NodeDetailPanelProps) {
  const propertyEntries = Object.entries(node.properties).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="fixed top-14 right-0 w-80 h-[calc(100vh-3.5rem)] bg-gray-800 border-l border-gray-700 flex flex-col z-50 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-700">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">
            {node.name}
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">{node.typeName}</p>
          <span
            className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: node.color + "33",
              color: node.color,
            }}
          >
            {node.parentCategory}
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Confidence */}
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Confidence
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${node.confidence * 100}%`,
                  backgroundColor: node.color,
                }}
              />
            </div>
            <span className="text-sm text-white font-medium">
              {Math.round(node.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            Status
          </span>
          <p className="text-sm text-white mt-0.5 capitalize">{node.status}</p>
        </div>

        {/* Properties */}
        {propertyEntries.length > 0 && (
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Properties
            </span>
            <table className="w-full mt-1 text-sm">
              <tbody>
                {propertyEntries.map(([key, value]) => (
                  <tr key={key} className="border-t border-gray-700/50">
                    <td className="py-1.5 pr-2 text-gray-400 align-top whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-1.5 text-white break-all">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      {node.status === "draft" && onVerify && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => onVerify(node.id)}
            className="w-full px-4 py-2 rounded bg-sky-700 text-white text-sm font-medium hover:bg-sky-600 transition"
          >
            Verify
          </button>
        </div>
      )}
    </div>
  );
}
