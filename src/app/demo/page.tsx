'use client';

import { useState } from 'react';
import { generateLabelWithLogo } from '@/lib/generateLabelWithLogo';

export default function DemoPage() {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const pdfBytes = await generateLabelWithLogo();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ background: 'var(--sidebar)' }}
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div className="max-w-xl w-full text-center space-y-6">
        <p
          style={{ color: 'var(--active-color)', fontSize: '12px' }}
          className="uppercase tracking-widest font-medium"
        >
          TCG Shipping Suite
        </p>

        <h1 className="text-4xl font-bold text-white leading-tight">
          Label Preview Demo
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.5)' }} className="text-base">
          Generate a sample shipping label with logo overlay to see what your
          labels will look like.
        </p>

        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={handleGenerate}
            style={{ background: 'var(--primary-color)' }}
            className="px-6 py-3 rounded-lg text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
