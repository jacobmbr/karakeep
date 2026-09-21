"use client";

import type { BookmarksLayoutTypes } from "@/lib/userLocalSettings/types";
import type { ReactNode } from "react";
import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "@/lib/auth/client";
import { BOOKMARK_DRAG_MIME } from "@/lib/bookmark-drag";
import useBulkActionsStore from "@/lib/bulkActions";
import { useClientConfig } from "@/lib/clientConfig";
import { useTranslation } from "@/lib/i18n/client";
import {
  bookmarkLayoutSwitch,
  useBookmarkDisplaySettings,
  useBookmarkLayout,
} from "@/lib/userLocalSettings/bookmarksLayout";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Circle,
  CircleCheck,
  GripVertical,
  Image as ImageIcon,
  NotebookPen,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useBookmarkListContext } from "@karakeep/shared-react/hooks/bookmark-list-context";
import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";
import {
  getBookmarkTitle,
  isBookmarkStillTagging,
} from "@karakeep/shared/utils/bookmarkUtils";
import { switchCase } from "@karakeep/shared/utils/switch";

import BookmarkActionBar from "./BookmarkActionBar";
import BookmarkFormattedCreatedAt from "./BookmarkFormattedCreatedAt";
import BookmarkOwnerIcon from "./BookmarkOwnerIcon";
import { ArchivedActionIcon, FavouritedActionIcon } from "./icons";
import { NotePreview } from "./NotePreview";
import TagList from "./TagList";

interface Props {
  bookmark: ZBookmark;
  image: (layout: BookmarksLayoutTypes, className: string) => ReactNode;
  title?: ReactNode;
  content?: ReactNode;
  footer?: ReactNode;
  className?: string;
  fitHeight?: boolean;
  wrapTags: boolean;
  bookmarkIndex?: number;
}

function BottomRow({
  footer,
  bookmark,
}: {
  footer?: ReactNode;
  bookmark: ZBookmark;
}) {
  return (
    <div className="justify flex w-full shrink-0 justify-between text-gray-500">
      <div className="flex items-center gap-2 overflow-hidden text-nowrap font-light">
        {footer && <>{footer}•</>}
        <Link
          href={`/dashboard/preview/${bookmark.id}`}
          suppressHydrationWarning
        >
          <BookmarkFormattedCreatedAt createdAt={bookmark.createdAt} />
        </Link>
      </div>
      <BookmarkActionBar bookmark={bookmark} />
    </div>
  );
}

function OwnerIndicator({ bookmark }: { bookmark: ZBookmark }) {
  const api = useTRPC();
  const listContext = useBookmarkListContext();
  const collaborators = useQuery(
    api.lists.getCollaborators.queryOptions(
      {
        listId: listContext?.id ?? "",
      },
      {
        refetchOnWindowFocus: false,
        enabled: !!listContext?.hasCollaborators,
      },
    ),
  );

  if (!listContext || listContext.userRole === "owner" || !collaborators.data) {
    return null;
  }

  let owner = undefined;
  if (bookmark.userId === collaborators.data.owner?.id) {
    owner = collaborators.data.owner;
  } else {
    owner = collaborators.data.collaborators.find(
      (c) => c.userId === bookmark.userId,
    )?.user;
  }

  if (!owner) return null;

  return (
    <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <BookmarkOwnerIcon ownerName={owner.name} ownerAvatar={owner.image} />
    </div>
  );
}

function BulkEditSelectionOverlay({ bookmark }: { bookmark: ZBookmark }) {
  const isSelected = useBulkActionsStore((s) =>
    s.isBookmarkSelected(bookmark.id),
  );
  const isBulkEditEnabled = useBulkActionsStore((s) => s.isBulkEditEnabled);
  const toggleBookmark = useBulkActionsStore((state) => state.toggleBookmark);
  const { theme } = useTheme();
  const { data: session } = useSession();

  // Don't show selector for non-owned bookmarks or when bulk edit is disabled
  const isOwner = session?.user?.id === bookmark.userId;
  if (!isBulkEditEnabled || !isOwner) return null;

  return (
    <button
      className={cn(
        "absolute left-0 top-0 z-20 h-full w-full bg-opacity-0",
        {
          "bg-opacity-10": isSelected,
        },
        theme === "dark" ? "bg-white" : "bg-black",
      )}
      onClick={() => toggleBookmark(bookmark.id)}
    ></button>
  );
}

function DragHandle({
  bookmark,
  className,
}: {
  bookmark: ZBookmark;
  className?: string;
}) {
  const { isBulkEditEnabled } = useBulkActionsStore();
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData(BOOKMARK_DRAG_MIME, bookmark.id);
      e.dataTransfer.effectAllowed = "copy";

      // Create a small pill element as the drag preview
      const pill = document.createElement("div");
      const title = getBookmarkTitle(bookmark) ?? "Untitled";
      pill.textContent =
        title.length > 40 ? title.substring(0, 40) + "\u2026" : title;
      Object.assign(pill.style, {
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        padding: "6px 12px",
        borderRadius: "8px",
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "hsl(var(--foreground))",
        maxWidth: "240px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      });
      document.body.appendChild(pill);
      e.dataTransfer.setDragImage(pill, 0, 0);
      requestAnimationFrame(() => pill.remove());
    },
    [bookmark],
  );

  if (isBulkEditEnabled) return null;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "absolute z-10 hidden cursor-grab rounded bg-background/70 p-0.5 opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 [@media(pointer:fine)]:block",
        className,
      )}
    >
      <GripVertical className="size-4 text-muted-foreground" />
    </div>
  );
}

function HoverActionBar({
  bookmark,
  inline = false,
}: {
  bookmark: ZBookmark;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  const enableBulkEditForBookmark = useBulkActionsStore(
    (state) => state.enableBulkEditForBookmark,
  );
  const isBulkEditEnabled = useBulkActionsStore(
    (state) => state.isBulkEditEnabled,
  );
  const isSelected = useBulkActionsStore((state) =>
    state.isBookmarkSelected(bookmark.id),
  );
  const toggleBookmark = useBulkActionsStore((state) => state.toggleBookmark);
  const { data: session } = useSession();
  const demoMode = !!useClientConfig().demoMode;
  const updateBookmarkMutator = useUpdateBookmark({
    onSuccess: () => {
      toast.success(t("toasts.bookmarks.updated"));
    },
    onError: () => {
      toast.error(t("common.something_went_wrong"));
    },
  });

  const isOwner = session?.user?.id === bookmark.userId;
  if (!isOwner) return null;

  return (
    <div
      className={cn(
        "z-30 gap-1 rounded bg-white/50 p-1 backdrop-blur-sm transition-opacity duration-200 dark:bg-black/50",
        inline ? "shrink-0" : "absolute right-2 top-2",
        isBulkEditEnabled
          ? "pointer-events-auto flex opacity-100"
          : "pointer-events-none hidden opacity-0 group-hover:opacity-100 [@media(pointer:fine)]:pointer-events-auto [@media(pointer:fine)]:flex",
      )}
    >
      <button
        aria-label={t("actions.bulk_edit")}
        title={t("actions.bulk_edit")}
        className="rounded p-0.5 hover:bg-background/50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isBulkEditEnabled) {
            toggleBookmark(bookmark.id);
          } else {
            enableBulkEditForBookmark(bookmark.id);
          }
        }}
      >
        {isSelected ? (
          <CircleCheck className="size-4" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>
      {!demoMode && (
        <>
          <button
            title={
              bookmark.favourited
                ? t("actions.unfavorite")
                : t("actions.favorite")
            }
            className="rounded p-0.5 hover:bg-background/50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              updateBookmarkMutator.mutate({
                bookmarkId: bookmark.id,
                favourited: !bookmark.favourited,
              });
            }}
          >
            <FavouritedActionIcon favourited={bookmark.favourited} size={16} />
          </button>
          <button
            title={
              bookmark.archived ? t("actions.unarchive") : t("actions.archive")
            }
            className="rounded p-0.5 hover:bg-background/50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              updateBookmarkMutator.mutate({
                bookmarkId: bookmark.id,
                archived: !bookmark.archived,
              });
            }}
          >
            <ArchivedActionIcon archived={bookmark.archived} size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function ListView({
  bookmark,
  image,
  title,
  content,
  footer,
  className,
  bookmarkIndex,
}: Props) {
  const { showNotes, showTags, showTitle, imageFit } =
    useBookmarkDisplaySettings();
  const imgFitClass = switchCase(imageFit, {
    cover: "object-cover",
    contain: "object-contain",
  });
  const note = showNotes ? bookmark.note?.trim() : undefined;

  return (
    <div
      className={cn(
        "group relative flex max-h-96 gap-4 overflow-hidden rounded-lg p-2",
        className,
      )}
      data-bookmark-index={bookmarkIndex}
    >
      <BulkEditSelectionOverlay bookmark={bookmark} />
      <OwnerIndicator bookmark={bookmark} />
      <DragHandle
        bookmark={bookmark}
        className="left-1 top-1/2 -translate-y-1/2"
      />
      <HoverActionBar bookmark={bookmark} />
      <div className="flex size-32 items-center justify-center overflow-hidden">
        {image("list", cn("size-32 rounded-lg", imgFitClass))}
      </div>
      <div className="flex h-full flex-1 flex-col justify-between gap-2 overflow-hidden">
        <div className="flex flex-col gap-2 overflow-hidden">
          {showTitle && title && (
            <div className="line-clamp-2 flex-none shrink-0 overflow-hidden text-ellipsis break-words text-lg">
              {title}
            </div>
          )}
          {content && <div className="shrink-1 overflow-hidden">{content}</div>}
          {note && <NotePreview note={note} bookmarkId={bookmark.id} />}
          {showTags && (
            <div className="flex shrink-0 flex-wrap gap-1 overflow-hidden">
              <TagList
                bookmark={bookmark}
                loading={isBookmarkStillTagging(bookmark)}
              />
            </div>
          )}
        </div>
        <BottomRow footer={footer} bookmark={bookmark} />
      </div>
    </div>
  );
}

function GridView({
  bookmark,
  image,
  title,
  content,
  footer,
  className,
  wrapTags,
  layout,
  fitHeight = false,
  bookmarkIndex,
}: Props & { layout: BookmarksLayoutTypes }) {
  const { showNotes, showTags, showTitle, imageFit } =
    useBookmarkDisplaySettings();
  const imgFitClass = switchCase(imageFit, {
    cover: "object-cover",
    contain: "object-contain",
  });
  const note = showNotes ? bookmark.note?.trim() : undefined;
  const img = image(
    "grid",
    cn("h-56 min-h-56 w-full rounded-t-lg", imgFitClass),
  );

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg",
        className,
        fitHeight && layout != "grid" ? "max-h-96" : "h-96",
      )}
      data-bookmark-index={bookmarkIndex}
    >
      <BulkEditSelectionOverlay bookmark={bookmark} />
      <OwnerIndicator bookmark={bookmark} />
      <DragHandle bookmark={bookmark} className="left-2 top-2" />
      <HoverActionBar bookmark={bookmark} />
      {img && <div className="h-56 w-full shrink-0 overflow-hidden">{img}</div>}
      <div className="flex h-full flex-col justify-between gap-2 overflow-hidden p-2">
        <div className="grow-1 flex flex-col gap-2 overflow-hidden">
          {showTitle && title && (
            <div className="line-clamp-2 flex-none shrink-0 overflow-hidden text-ellipsis break-words text-lg">
              {title}
            </div>
          )}
          {content && <div className="shrink-1 overflow-hidden">{content}</div>}
          {note && <NotePreview note={note} bookmarkId={bookmark.id} />}
          {showTags && (
            <div className="flex shrink-0 flex-wrap gap-1 overflow-hidden">
              <TagList
                className={wrapTags ? undefined : "h-full"}
                bookmark={bookmark}
                loading={isBookmarkStillTagging(bookmark)}
              />
            </div>
          )}
        </div>
        <BottomRow footer={footer} bookmark={bookmark} />
      </div>
    </div>
  );
}

function CompactView({
  bookmark,
  title,
  footer,
  className,
  bookmarkIndex,
}: Props) {
  const { showTitle, showTags } = useBookmarkDisplaySettings();

  // Tags are a primary way people re-find something they filed, so the dense
  // row surfaces them. Three keeps the track from crowding the title; the rest
  // are counted.
  const visibleTags = showTags ? bookmark.tags.slice(0, 3) : [];
  const hiddenTagCount = showTags
    ? bookmark.tags.length - visibleTags.length
    : 0;

  return (
    // Two stacked lines rather than one row of columns: the title gets the
    // full width on its own line, and every piece of metadata drops to a
    // second line underneath. Sharing one row meant the title competed with
    // four fixed tracks and was left ~166px against the ~375px a normal
    // headline needs, so it was always the thing that got clipped.
    <div
      className={cn(
        "group relative flex flex-col gap-1 px-2.5 py-2 md:px-3",
        className,
      )}
      data-bookmark-index={bookmarkIndex}
    >
      <BulkEditSelectionOverlay bookmark={bookmark} />
      <OwnerIndicator bookmark={bookmark} />

      {/* Line 1 -- type icon and the title, nothing else competing for width. */}
      <div className="flex min-w-0 items-start gap-2">
        {bookmark.content.type === BookmarkTypes.LINK &&
          bookmark.content.favicon && (
            <Image
              src={bookmark.content.favicon}
              alt=""
              width={4}
              unoptimized
              height={4}
              // Nudged onto the title's first line box rather than the top of
              // the flex line, so icon and text share a centre.
              className="mt-px size-4 shrink-0 rounded-sm"
            />
          )}
        {bookmark.content.type === BookmarkTypes.TEXT && (
          <NotebookPen className="mt-px size-4 shrink-0 text-muted-foreground" />
        )}
        {bookmark.content.type === BookmarkTypes.ASSET && (
          <ImageIcon className="mt-px size-4 shrink-0 text-muted-foreground" />
        )}

        {showTitle && (
          // The title wraps in full rather than being clipped: at narrow widths
          // it used to get ~166px against the ~375px a normal headline needs.
          //
          // The 10-line ceiling is only a guard against a pathological title
          // turning one row into a page. It is done in CSS rather than by
          // slicing the string because `title` is a ReactNode: link bookmarks
          // pass an element (LinkCard's <LinkTitle>, which wraps the text in a
          // <Link>), so a character cap could not reach the most common case.
          // break-words keeps an unbroken URL-ish title inside the row.
          <span className="line-clamp-[10] min-w-0 break-words text-[13px] font-medium leading-[17px] tracking-[-0.006em] text-foreground">
            {title ?? "Untitled"}
          </span>
        )}
      </div>

      {/* Line 2 -- metadata and actions, still on shared column tracks so host,
          date and the action cluster scan down the list as real columns. The
          left indent lines it up under the title rather than under the icon.
          Host and tags now show at every width: the second line has the room
          the single row never did. */}
      <div className="grid grid-cols-[minmax(0,1fr)_0.75rem_5.5rem_4rem] items-center gap-x-2 pl-6 md:gap-x-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] leading-[17px] text-muted-foreground">
            {footer}
          </span>
          {visibleTags.map((tag) => (
            <Link
              key={tag.id}
              href={`/dashboard/tags/${tag.id}`}
              className="hidden shrink-0 truncate text-[11px] text-muted-foreground/80 hover:text-foreground sm:block"
            >
              {tag.name}
            </Link>
          ))}
          {hiddenTagCount > 0 && (
            <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground/60 sm:block">
              +{hiddenTagCount}
            </span>
          )}
        </div>

        {/* Favourited is state, not an action, so it sits with the metadata in
            its own track rather than inside the action cluster, where it used
            to shove the buttons across the date column. */}
        <span className="flex h-[17px] items-center justify-center">
          {bookmark.favourited && <FavouritedActionIcon favourited size={12} />}
        </span>

        {/* Dates get Inter tabular figures so the numerals line up down the
            column; proportional digits would make the track ragged. */}
        <Link
          href={`/dashboard/preview/${bookmark.id}`}
          suppressHydrationWarning
          className="whitespace-nowrap text-right text-[12px] tabular-nums leading-[17px] text-muted-foreground/90 transition-opacity group-hover:opacity-0"
        >
          <BookmarkFormattedCreatedAt createdAt={bookmark.createdAt} />
        </Link>

        {/* At rest only two buttons show and they fit the track. On hover three
            more join them and the cluster is wider than the track, so it is
            anchored to the right edge and the date fades out to make room —
            metadata yields to actions rather than being half-covered by them. */}
        <div className="relative z-30 flex h-[17px] items-center justify-end">
          <div className="absolute right-0 flex items-center">
            <HoverActionBar bookmark={bookmark} inline />
            <BookmarkActionBar
              bookmark={bookmark}
              compact
              favouritedClassName="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookmarkLayoutAdaptingCard(props: Props) {
  const layout = useBookmarkLayout();

  return bookmarkLayoutSwitch(layout, {
    masonry: <GridView layout={layout} {...props} />,
    grid: <GridView layout={layout} {...props} />,
    list: <ListView {...props} />,
    compact: <CompactView {...props} />,
  });
}
