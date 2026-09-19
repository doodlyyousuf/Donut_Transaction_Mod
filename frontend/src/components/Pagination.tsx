import { Button } from "./m3";

/**
 * Shared list pagination footer. Returns nothing when there is no data so it
 * can be dropped at the bottom of any card unconditionally.
 */
export function Pagination({
  page, pages, total, limit, onPage,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/50 px-4 py-3 sm:px-5">
      <span className="text-xs text-on-surface-variant">
        Showing <span className="font-mono">{first.toLocaleString()}</span>–
        <span className="font-mono">{last.toLocaleString()}</span> of{" "}
        <span className="font-mono">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outlined"
          size="sm"
          icon="chevron-left"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Prev
        </Button>
        <span className="min-w-[4.5rem] text-center text-xs text-on-surface-variant">
          Page {page} / {pages}
        </span>
        <Button
          variant="outlined"
          size="sm"
          trailingIcon="chevron-right"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
