import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type UserSettings = {
  apiKey?: string;
  logoUrl?: string;
  envelopeCost?: number;
  defaultNonMachinable?: boolean;
  fromAddress?: string;
  valueThreshold?: number;
  packageRules?: any[];
};

export async function fetchUserSettings(uid: string): Promise<UserSettings> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  return snap.data() as UserSettings;
}

export async function saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, settings, { merge: true });
}
