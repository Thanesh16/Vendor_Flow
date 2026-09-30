import React from 'react';
import Button from './Button';

/**
 * Reusable server-side Pagination toolbar
 * @param {Object} props
 * @param {number} props.page - Current page (1-based)
 * @param {number} props.totalPages - Total pages count
 * @param {number} props.total - Total items matching query
 * @param {number} props.limit - Items per page
 * @param {function} props.onPageChange - Handler receiving new page number
 * @param {function} [props.onLimitChange] - Handler receiving new limit
 * @param {string} [props.itemLabel] - Label for items (e.g. 'vendors', 'requests')
 * @param {number[]} [props.pageSizeOptions] - Allowed page sizes [10, 20, 50]
 */
export const Pagination = ({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 10,
  onPageChange,
  onLimitChange,
  itemLabel = 'records',
  pageSizeOptions = [10, 20, 50],
}) => {
  if (total === 0) {
    return null;
  }

  const startRecord = Math.min((page - 1) * limit + 1, total);
  const endRecord = Math.min(page * limit, total);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--spacing-4)',
        padding: 'var(--spacing-4)',
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-subtle, transparent)',
      }}
    >
      {/* Left side: Item count summary & page size selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Showing <strong>{startRecord}</strong> - <strong>{endRecord}</strong> of <strong>{total}</strong> {itemLabel}
        </span>

        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Navigation buttons and page numbers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
        >
          &larr; Prev
        </Button>

        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  padding: '0 0.4rem',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                ...
              </span>
            );
          }

          const isActive = p === page;
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                minWidth: '28px',
                height: '28px',
                padding: '0 0.4rem',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg)',
                color: isActive ? '#ffffff' : 'var(--color-text-main)',
                fontWeight: isActive ? 600 : 400,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-fast)',
              }}
            >
              {p}
            </button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
        >
          Next &rarr;
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
