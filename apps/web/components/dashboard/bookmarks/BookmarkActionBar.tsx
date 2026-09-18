import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

import BookmarkOptions from "./BookmarkOptions";
import { FavouritedActionIcon } from "./icons";

export default function BookmarkActionBar({
  bookmark,
  favouritedClassName,
  compact = false,
}: {
  bookmark: ZBookmark;
  favouritedClassName?: string;
  /**
   * These buttons are the tallest thing in a row, so in the compact layout they
   * — not the text — dictate the row height. Shrink them there.
   */
  compact?: boolean;
}) {
  return (
    <div className="flex text-gray-500">
      {bookmark.favourited && (
        <FavouritedActionIcon
          className={cn(
            "rounded",
            compact ? "m-0.5 size-6 p-0.5" : "m-1 size-8 p-1",
            favouritedClassName,
          )}
          favourited
        />
      )}
      <Link
        href={`/dashboard/preview/${bookmark.id}`}
        className={cn(
          buttonVariants({
            variant: "ghost",
            size: compact ? "icon-sm" : "default",
          }),
          compact ? "px-1" : "px-2",
        )}
      >
        <Maximize2 size={16} />
      </Link>
      <BookmarkOptions bookmark={bookmark} compact={compact} />
    </div>
  );
}
