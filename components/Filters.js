'use client';

const FALLBACK_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size'];

export default function Filters({ sizes, activeSize, onSizeChange, sort, onSortChange, hideSizes = false }) {
  const sizeOptions = sizes?.length ? sizes : FALLBACK_SIZES;
  const showSizes = !hideSizes && sizeOptions.length > 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-4">
      {showSizes && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-sm font-medium text-brand-ink/60 shrink-0">Size:</span>
          <button
            onClick={() => onSizeChange('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 ${
              !activeSize
                ? 'bg-brand-pink text-white border-brand-pink'
                : 'border-brand-ink/15 text-brand-ink/70'
            }`}
          >
            All
          </button>
          {sizeOptions.map((s) => (
            <button
              key={s}
              onClick={() => onSizeChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 ${
                activeSize === s
                  ? 'bg-brand-pink text-white border-brand-pink'
                  : 'border-brand-ink/15 text-brand-ink/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 sm:ml-auto">
        <span className="text-sm font-medium text-brand-ink/60">Sort:</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="text-sm border border-brand-ink/15 rounded-full px-3 py-1.5 bg-white outline-none"
        >
          <option value="newest">Newest</option>
          <option value="priceLow">Price: Low to High</option>
          <option value="priceHigh">Price: High to Low</option>
          <option value="popular">Most Popular</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>
    </div>
  );
}