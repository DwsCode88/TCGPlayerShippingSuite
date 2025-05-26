import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase'; // Make sure this path is correct for your project

export const getUserSettings = async (userId: string) => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : {};
};

export const saveUserSettings = async (userId: string, settings: any) => {
  const docRef = doc(db, 'users', userId);
  await setDoc(docRef, settings, { merge: true });
};
