'use client';

export default function ColorSizeSelector({ variants, activeVariant, onColorChange, activeSize, onSizeChange }) {
  const sizeStock = (size) => activeVariant?.sizes?.find((s) => s.size === size)?.stock ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-brand-ink mb-2">
          Color: <span className="text-brand-magenta">{activeVariant?.color}</span>
        </p>
        <div className="flex gap-2 flex-wrap">
          {variants.map((v) => (
            <button
              key={v._id}
              onClick={() => onColorChange(v)}
              title={v.color}
              className={`w-9 h-9 rounded-full border-2 transition ${
                activeVariant?._id === v._id ? 'border-brand-pink scale-110' : 'border-brand-ink/15'
              }`}
              style={{ backgroundColor: v.colorHex || '#ccc' }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-brand-ink mb-2">Size:</p>
        <div className="flex gap-2 flex-wrap">
          {activeVariant?.sizes?.map((s) => {
            const outOfStock = s.stock <= 0;
            return (
              <button
                key={s.size}
                disabled={outOfStock}
                onClick={() => onSizeChange(s.size)}
                className={`min-w-[44px] h-10 px-3 rounded-lg border text-sm font-medium transition ${
                  outOfStock
                    ? 'border-brand-ink/10 text-brand-ink/30 line-through cursor-not-allowed'
                    : activeSize === s.size
                    ? 'bg-brand-pink text-white border-brand-pink'
                    : 'border-brand-ink/20 text-brand-ink/80 hover:border-brand-pink'
                }`}
              >
                {s.size}
              </button>
            );
          })}
        </div>
        {activeSize && sizeStock(activeSize) <= 5 && sizeStock(activeSize) > 0 && (
          <p className="text-xs text-brand-magenta mt-2">Only {sizeStock(activeSize)} left in stock!</p>
        )}
      </div>
    </div>
  );
}
