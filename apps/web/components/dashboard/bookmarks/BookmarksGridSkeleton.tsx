// TODO: Refactor the bookmark layout grid to be generic and allow to pass the bookmark component generically.
// This removes the need for handling the layout in this component.
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bookmarkLayoutSwitch,
  useBookmarkLayout,
  useGridColumns,
} from "@/lib/userLocalSettings/bookmarksLayout";
import tailwindConfig from "@/tailwind.config";
import Masonry from "react-masonry-css";
import resolveConfig from "tailwindcss/resolveConfig";

function getBreakpointConfig(userColumns: number) {
  const fullConfig = resolveConfig(tailwindConfig);

  const breakpointColumnsObj: { [key: number]: number; default: number } = {
    default: userColumns,
  };

  const lgColumns = Math.max(1, Math.min(userColumns, userColumns - 1));
  const mdColumns = Math.max(1, Math.min(userColumns, 2));
  const smColumns = 1;

  breakpointColumnsObj[parseInt(fullConfig.theme.screens.lg)] = lgColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.md)] = mdColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.sm)] = smColumns;
  return breakpointColumnsObj;
}

function BookmarkCardSkeleton({
  height,
  compact = false,
}: {
  height: string;
  compact?: boolean;
}) {
  // A compact row is a title line over a metadata line, so the three stacked
  // bars below would flash a placeholder well over its height before settling.
  // Mirror the real row instead: icon and title on the first line, host on the
  // second, date to the right (see CompactView).
  if (compact) {
    return (
      <div className="mb-1 border border-border bg-card px-3 py-2">
        <div className="flex min-h-[34px] items-start gap-3">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 border border-border bg-card p-4">
      <div className="space-y-3">
        <Skeleton className={`w-full ${height}`} />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export default function BookmarksGridSkeleton({
  count = 12,
}: {
  count?: number;
}) {
  const layout = useBookmarkLayout();
  const gridColumns = useGridColumns();
  const breakpointConfig = useMemo(
    () => getBreakpointConfig(gridColumns),
    [gridColumns],
  );

  const children = Array.from({ length: count }, (_, i) => (
    <BookmarkCardSkeleton
      key={i}
      compact={layout === "compact"}
      height={bookmarkLayoutSwitch(layout, {
        masonry: "h-48",
        grid: "h-48",
        list: "h-32",
        compact: "h-4",
      })}
    />
  ));

  return bookmarkLayoutSwitch(layout, {
    masonry: (
      <Masonry
        className="-ml-4 flex w-auto"
        columnClassName="pl-4"
        breakpointCols={breakpointConfig}
      >
        {children}
      </Masonry>
    ),
    grid: (
      <Masonry
        className="-ml-4 flex w-auto"
        columnClassName="pl-4"
        breakpointCols={breakpointConfig}
      >
        {children}
      </Masonry>
    ),
    list: <div className="grid grid-cols-1">{children}</div>,
    compact: <div className="grid grid-cols-1">{children}</div>,
  });
}
