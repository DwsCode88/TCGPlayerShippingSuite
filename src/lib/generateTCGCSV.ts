export const generateTCGCSV = (orders: any[]) => {
  // Exact headers with hash symbols
  const headers = ['Tracking #', 'Order #', 'Carrier'];

  const rows = orders.map((order) => [
    order.trackingCode || '',
    order.orderNumber,
    'USPS', // Replace with order.carrier if needed
  ]);

  const csvContent = [
    headers.join(','),        // → "Tracking #,Order #,Carrier"
    ...rows.map((r) => r.join(','))
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv' });
};
