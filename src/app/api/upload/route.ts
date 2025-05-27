import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const orders = await req.json();
  const results: { url: string; tracking: string }[] = [];

  const first = orders[0];
  const now = new Date();

  if (first?.batchId) {
    await setDoc(
      doc(db, 'batches', first.batchId),
      {
        batchName: first.batchName || 'Unnamed Batch',
        createdAt: serverTimestamp(),
        createdAtMillis: now.getTime(),
        createdAtDisplay: now.toLocaleString(),
        archived: false,
        notes: '',
        userId: first.userId || 'unknown',
      },
      { merge: true }
    );
  }

  for (const order of orders) {
    try {
      const userRef = doc(db, 'users', order.userId);
      const userSnap = await getDoc(userRef);
      const userSettings = userSnap.exists() ? userSnap.data() : {};
      const userApiKey = userSettings.easypostApiKey;

      if (!userApiKey) {
        console.warn(`❌ Missing API key for user ${order.userId}`);
        continue;
      }

      const fromAddress = userSettings.fromAddress;
      if (!fromAddress) {
        console.warn(`❌ Missing fromAddress for user ${order.userId}`);
        continue;
      }

      const authHeader = `Basic ${Buffer.from(userApiKey + ':').toString('base64')}`;

      const createRes = await fetch('https://api.easypost.com/v2/shipments', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipment: {
            to_address: {
              name: order.name,
              street1: order.address1,
              street2: order.address2,
              city: order.city,
              state: order.state,
              zip: order.zip?.replace(/\D/g, ''),
              country: 'US',
            },
            from_address: {
              name: fromAddress.name,
              street1: fromAddress.street1,
              city: fromAddress.city,
              state: fromAddress.state,
              zip: fromAddress.zip,
              country: 'US',
            },
            parcel: {
              predefined_package: 'Letter',
              weight: Math.max(1, order.weight || 1),
            },
            options: {
              label_format: 'PDF',
              label_size: '4x6',
              machinable: !order.nonMachinable,
              print_custom_1: order.orderNumber || '',
            },
          },
        }),
      });

      const shipment = await createRes.json();

      const rate = shipment.rates.find(
        (r: any) => r.carrier === 'USPS' && r.service.includes('First')
      );

      if (!rate) {
        console.warn(`❌ No USPS First-Class rate for ${order.name}`);
        continue;
      }

      const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rate }),
      });

      const bought = await buyRes.json();

      if (!bought?.postage_label?.label_url) {
        console.error(`❌ Label failed for ${order.name}`);
        continue;
      }

      const orderId = uuidv4();
      const labelCost = parseFloat(rate?.rate || '0.63');
      const envelopeCost = 0.10;
      const shieldCost = order.shippingShield ? 0.10 : 0;
      const totalCost = parseFloat((labelCost + envelopeCost + shieldCost).toFixed(2));

      await setDoc(doc(db, 'orders', orderId), {
        userId: order.userId || 'unknown',
        batchId: order.batchId,
        batchName: order.batchName,
        orderNumber: order.orderNumber,
        trackingCode: bought.tracking_code,
        labelUrl: bought.postage_label.label_url,
        toName: order.name,
        labelCost,
        envelopeCost,
        shieldCost,
        totalCost,
        shippingShield: !!order.shippingShield,
        createdAt: Date.now(),
        dashboardTimestamp: new Date().toISOString(),
      });

      results.push({
        url: bought.postage_label.label_url,
        tracking: bought.tracking_code,
      });
    } catch (err) {
      console.error(`🔥 Error generating label for ${order.name}:`, err);
    }
  }

  return NextResponse.json(results);
}
