import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

export async function generateOrderLabels(orderNumbers: string[]) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const fullOrderNumber of orderNumbers) {
    const shortCode = fullOrderNumber.split('-').pop() ?? fullOrderNumber;

    const page = pdfDoc.addPage([144, 90]); // width x height in points (2" x 1.25")
    const { width, height } = page.getSize();

    // Text is rotated around the bottom left corner
    page.drawText('Order #', {
      x: 10,
      y: 10,
      size: 12,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(90),
    });

    page.drawText(shortCode, {
      x: 35,
      y: 10,
      size: 18,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(90),
    });

    page.drawText('Thank you!', {
      x: 115,
      y: 10,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
      rotate: degrees(90),
    });

    page.drawText('VaultTrove', {
      x: 130,
      y: 10,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
      rotate: degrees(90),
    });
  }

  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'vaulttrove-order-labels.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
