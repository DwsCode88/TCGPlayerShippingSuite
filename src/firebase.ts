import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD6cvDgRpTfpDI2j3ttxLOfGC7o6z6HLJ0",
  authDomain: "tcgplayershipsite.firebaseapp.com",
  projectId: "tcgplayershipsite",
  storageBucket: "tcgplayershipsite.appspot.com" ,// ✅ this is the correct format

  messagingSenderId: "136897617017",
  appId: "1:136897617017:web:9ab411dccd9486d34288a8"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
if (useEmulators && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}

export { auth, db, storage };
