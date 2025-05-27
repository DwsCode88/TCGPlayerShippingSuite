import { db } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserSettings {
  easypostApiKey: string;
  logoUrl: string;
  envelopeCost?: number;
  defaultNonMachinable?: boolean;
  fromAddress?: {
    name: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
}

export async function saveUserSettings(uid: string, settings: UserSettings) {
  await setDoc(doc(db, 'users', uid), settings, { merge: true });
}

export async function fetchUserSettings(uid: string): Promise<UserSettings | null> {
  const docSnap = await getDoc(doc(db, 'users', uid));
  return docSnap.exists() ? (docSnap.data() as UserSettings) : null;
}
