"use client";

import { useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";

const DEV_EMAIL = "dev@localhost.test";
const DEV_PASSWORD = "devdev123";

/**
 * Auto-signs into the Firebase Auth emulator with a dev account.
 * Only active when NEXT_PUBLIC_USE_EMULATORS=true.
 * Renders nothing — just handles the sign-in side effect.
 */
export default function DevAutoLogin() {
  const [user, loading] = useAuthState(auth);
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || user || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        await signInWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
      } catch {
        // Account doesn't exist yet — create it in the emulator
        try {
          const cred = await createUserWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD);
          // Seed a basic user doc so dashboard pages work
          await setDoc(doc(db, "users", cred.user.uid), {
            email: DEV_EMAIL,
            isPro: true,
            plan: "pro",
            easypostApiKey: "",
            fromAddress: { name: "", street1: "", city: "", state: "", zip: "" },
          });
        } catch (e) {
          console.error("[DevAutoLogin] Failed to create dev user:", e);
        }
      }
    })();
  }, [user, loading]);

  return null;
}
