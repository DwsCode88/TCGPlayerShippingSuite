import { storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function uploadUserLogo(uid: string, file: File): Promise<string> {
  const logoRef = ref(storage, `logos/${uid}.png`);
  await uploadBytes(logoRef, file);
  return await getDownloadURL(logoRef);
}
