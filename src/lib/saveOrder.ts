import { db } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

export interface OrderRecord {
  userId: string;
  trackingCode: string;
  labelUrl: string;
  toName: string;
  createdAt: number;
}

export async function saveOrder(order: Omit<OrderRecord, 'createdAt'>) {
  const orderId = uuidv4();
  const fullOrder: OrderRecord = {
    ...order,
    createdAt: Date.now()
  };
  await setDoc(doc(db, 'orders', orderId), fullOrder);
}
