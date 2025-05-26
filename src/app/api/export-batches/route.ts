import { NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function GET() {
  const batchSnapshot = await getDocs(collection(db, 'batches'));

  const csvRows: string[][] = [
    ['Batch ID', 'Batch Name', 'Created', 'Order Count', 'Notes'],
  ];

  for (const docSnap of batchSnapshot.docs) {
    const data = docSnap.data();
    if (data.archived) continue;

    const batchId = docSnap.id;
    const batchName = data.batchName || 'Unnamed Batch';
    const notes = data.notes || '';
    const createdAt = data.createdAt
      ? new Date(data.createdAt).toLocaleString()
      : '';

    // Count related orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('batchId', '==', batchId)
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    const orderCount = ordersSnapshot.size;

    csvRows.push([batchId, batchName, createdAt, orderCount.toString(), notes]);
  }

  const csv = csvRows.map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="batch-report.csv"',
    },
  });
}
