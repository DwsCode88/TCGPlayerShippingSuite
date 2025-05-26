import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const urls: string[] = await req.json();
    const mergedPdf = await PDFDocument.create();

    for (const url of urls) {
      const res = await fetch(url);
      if (!res.ok) continue;

      const bytes = await res.arrayBuffer();
      const singlePdf = await PDFDocument.load(bytes);
      const pages = await mergedPdf.copyPages(singlePdf, singlePdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const finalBytes = await mergedPdf.save();

    return new NextResponse(Buffer.from(finalBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="labels.pdf"',
      },
    });
  } catch (err) {
    console.error('❌ Error merging PDFs:', err);
    return NextResponse.json({ error: 'Failed to merge PDFs' }, { status: 500 });
  }
}
