interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
} as const;

export default function Spinner({ size = "md", label }: SpinnerProps) {
  return (
    <div role="status">
      <svg
        className={`animate-spin ${sizeClasses[size]} text-current`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label ?? "로딩 중"}</span>
    </div>
  );
}
