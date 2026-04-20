import Spinner from "@/components/common/Spinner";

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <Spinner size="md" label="로딩 중" />
    </div>
  );
}
