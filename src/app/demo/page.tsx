'use client';

import { useState } from 'react';
import { generateLabelWithLogo } from '@/lib/generateLabelWithLogo';

export default function DemoPage() {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const pdfBytes = await generateLabelWithLogo(); // Optionally pass a real logo URL
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
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PDF Label with Logo</h1>
      <button
        onClick={handleGenerate}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Generate PDF'}
      </button>
    </div>
  );
}
