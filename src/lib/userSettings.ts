import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

export type UserSettings = {
  easypostApiKey: string;
  logoUrl?: string;
  envelopeCost?: number;
  shieldCost?: number;
  pennySleeveCost?: number;
  topLoaderCost?: number;
  usePennySleeves?: boolean;
  defaultNonMachinable?: boolean;
  valueThreshold?: number;
  cardCountThreshold?: number;
  fromAddress?: {
    name: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
  };
  packageTypes?: {
    name: string;
    weight: number;
    predefined_package: string;
    length?: string;
    width?: string;
    height?: string;
  }[]; // ✅ Add this line
};

export async function fetchUserSettings(
  uid: string
): Promise<UserSettings | null> {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserSettings) : null;
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return null;
  }
}

export async function saveUserSettings(uid: string, settings: UserSettings) {
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, settings, { merge: true });
  } catch (error) {
    console.error("Error saving user settings:", error);
    throw error;
  }
}
