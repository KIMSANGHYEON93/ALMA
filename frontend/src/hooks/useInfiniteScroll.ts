import { useEffect, useRef, type RefObject } from "react";

export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean,
  scrollContainerRef: RefObject<HTMLDivElement | null>
) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && enabled) {
          onLoadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, scrollContainerRef]);

  return { loadMoreRef };
}
