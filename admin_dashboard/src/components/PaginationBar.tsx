type PaginationBarProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function PaginationBar({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  itemLabel,
  onPageChange
}: PaginationBarProps) {
  if (totalItems <= pageSize) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-bar">
      <p className="small-muted">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>

      <div className="pagination-actions">
        <button
          type="button"
          className="secondary compact"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        <span className="count-pill">
          Page {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="secondary compact"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
