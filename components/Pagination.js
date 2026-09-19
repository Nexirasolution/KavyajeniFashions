'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Builds the page list with ellipses, e.g. [1, '...', 4, 5, 6, '...', 12]
function getPageNumbers(current, total) {
  const delta = 1; // how many pages to show around the current page
  const range = [];
  const pages = [];

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }

  let prev;
  for (const i of range) {
    if (prev !== undefined && i - prev > 1) pages.push('...');
    pages.push(i);
    prev = i;
  }
  return pages;
}

export default function Pagination({ currentPage, totalPages, basePath }) {
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const buildHref = (page) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page);
    return `${basePath}?${params.toString()}`;
  };

  const linkStyle = (isActive) => ({
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    minWidth: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    color: isActive ? '#FFF5F8' : '#8B1E4F',
    background: isActive ? '#C2478A' : 'transparent',
    border: isActive ? '1px solid #C2478A' : '1px solid #F0C9D8',
  });

  return (
    <nav
      aria-label="Product pagination"
      className="mt-12 flex items-center justify-center gap-2 flex-wrap"
    >
      {/* Prev */}
      {currentPage > 1 ? (
        <Link href={buildHref(currentPage - 1)} style={linkStyle(false)} aria-label="Previous page">
          ‹
        </Link>
      ) : (
        <span style={{ ...linkStyle(false), opacity: 0.35, cursor: 'not-allowed' }} aria-hidden="true">
          ‹
        </span>
      )}

      {/* Page numbers */}
      {pageNumbers.map((p, idx) =>
        p === '...' ? (
          <span
            key={`ellipsis-${idx}`}
            style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#C2478A', padding: '0 4px' }}
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            style={linkStyle(p === currentPage)}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link href={buildHref(currentPage + 1)} style={linkStyle(false)} aria-label="Next page">
          ›
        </Link>
      ) : (
        <span style={{ ...linkStyle(false), opacity: 0.35, cursor: 'not-allowed' }} aria-hidden="true">
          ›
        </span>
      )}
    </nav>
  );
}