import { doc, getDoc, setDoc, DocumentReference } from "firebase/firestore";
import { db } from "@/firebase";

export type UsageCheckResult = {
  isPro: boolean;
  usageCount: number;
  usageRef: DocumentReference;
  currentMonth: string;
};

export async function getUserUsage(
  userId: string,
  userSettings: Record<string, unknown>
): Promise<UsageCheckResult> {
  const usageRef = doc(db, "usage", userId);
  const usageSnap = await getDoc(usageRef);
  const usage = usageSnap.exists() ? usageSnap.data() : { count: 0, month: "" };
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageCount = usage?.month === currentMonth ? (usage.count as number) : 0;
  const isPro =
    userSettings?.isPro === true || userSettings?.plan === "pro";
  return { isPro, usageCount, usageRef, currentMonth };
}

export async function incrementUsage(
  usageRef: DocumentReference,
  currentMonth: string,
  previousCount: number,
  addedCount: number
): Promise<void> {
  await setDoc(
    usageRef,
    {
      month: currentMonth,
      count: previousCount + addedCount,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
