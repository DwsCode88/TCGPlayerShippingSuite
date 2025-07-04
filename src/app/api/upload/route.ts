import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const orders = await req.json();
  const groundAdvantage: { url: string; tracking: string }[] = [];
  const other: { url: string; tracking: string }[] = [];

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
      const isHighValue = order.useEnvelope === false;


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
              predefined_package: isHighValue ? 'Parcel' : 'Letter',
              weight: isHighValue ? 3 : Math.max(1, order.weight || 1),
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

      if (shipment.error) {
        console.error(`❌ EasyPost error for ${order.name}:`, shipment.error);
        continue;
      }

      if (!shipment?.rates || !Array.isArray(shipment.rates)) {
        console.error(`❌ No rates returned for ${order.name}. Shipment response:`, shipment);
        continue;
      }

      let rate;

      if (isHighValue) {
        rate = shipment.rates.find(
          (r: any) => r.carrier === 'USPS' && r.service === 'GroundAdvantage'
        );

        if (!rate) {
          console.warn(`⚠️ No USPS Ground Advantage for ${order.name}, using cheapest available`);
          rate = shipment.rates.reduce((lowest: any, current: any) => {
            if (!lowest || parseFloat(current.rate) < parseFloat(lowest.rate)) return current;
            return lowest;
          }, null);
        }
      } else {
        rate = shipment.rates.reduce((lowest: any, current: any) => {
          if (!lowest || parseFloat(current.rate) < parseFloat(lowest.rate)) return current;
          return lowest;
        }, null);
      }

      if (!rate) {
        console.warn(`❌ No valid rate found for ${order.name}`);
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
        console.error(`❌ Label purchase failed for ${order.name}`);
        continue;
      }

      const orderId = uuidv4();

      const envelopeCost = order.useEnvelope === false ? 0 : (userSettings.envelopeCost || 0.10);
      const shieldCost = order.shippingShield ? (userSettings.shieldCost || 0.10) : 0;
      const pennyCost = order.usePennySleeve ? (userSettings.pennySleeveCost || 0.02) : 0;
      const loaderCost = order.useTopLoader ? (userSettings.topLoaderCost || 0.12) : 0;

      const labelCost = parseFloat(rate?.rate || '0.63');
      const totalCost = parseFloat((labelCost + envelopeCost + shieldCost + pennyCost + loaderCost).toFixed(2));

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
        pennyCost,
        loaderCost,
        usePennySleeve: order.usePennySleeve || false,
        useTopLoader: order.useTopLoader || false,
        useEnvelope: order.useEnvelope !== false,
        totalCost,
        shippingShield: !!order.shippingShield,
        createdAt: Date.now(),
        dashboardTimestamp: new Date().toISOString(),
      });

      const labelData = {
        url: bought.postage_label.label_url,
        tracking: bought.tracking_code,
      };

      if (rate.service === 'GroundAdvantage') {
        groundAdvantage.push(labelData);
      } else {
        other.push(labelData);
      }
    } catch (err) {
      console.error(`🔥 Error generating label for ${order.name}:`, err);
    }
  }

  return NextResponse.json({ groundAdvantage, other });
}
