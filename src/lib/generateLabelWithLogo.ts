import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateLabelWithLogo(logoUrl?: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 200]);
  const { width, height } = page.getSize();

  const fallback = 'https://via.placeholder.com/150?text=Logo';

  try {
    const logoBytes = await fetch(logoUrl || fallback).then(res => res.arrayBuffer());
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scale(0.25);
    page.drawImage(logoImage, {
      x: 20,
      y: height - logoDims.height - 20,
      width: logoDims.width,
      height: logoDims.height,
    });
  } catch (err) {
    console.warn('⚠️ Failed to load logo, using placeholder only');
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Shipping Label Preview', {
    x: 20,
    y: height - 160,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });

  return await pdfDoc.save();
}
