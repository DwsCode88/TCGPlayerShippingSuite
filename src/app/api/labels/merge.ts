import type { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument } from 'pdf-lib';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const urls: string[] = JSON.parse(req.body);

    const mergedPdf = await PDFDocument.create();

    for (const url of urls) {
      const pdfBytes = await fetch(url).then((r) => r.arrayBuffer());
      const sourcePdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const finalPdfBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged-labels.pdf');
    res.send(Buffer.from(finalPdfBytes));
  } catch (error) {
    console.error('Error merging PDFs:', error);
    res.status(500).json({ error: 'Failed to merge labels' });
  }
}
