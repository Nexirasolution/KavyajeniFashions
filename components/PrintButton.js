'use client';

export default function PrintButton({ label = 'Print / Save as PDF' }) {
  return (
    <div className="text-center mt-6 print:hidden">
      <button onClick={() => window.print()} className="btn-primary">
        {label}
      </button>
    </div>
  );
}
