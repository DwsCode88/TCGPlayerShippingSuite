import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export { auth, db, storage };
