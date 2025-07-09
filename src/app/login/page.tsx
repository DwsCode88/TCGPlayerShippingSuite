"use client";

import {
  useCreateUserWithEmailAndPassword,
  useSignInWithEmailAndPassword,
  useSignInWithGoogle,
  useAuthState,
} from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();

  const [createUserWithEmailAndPassword, , loadingCreate, errorCreate] =
    useCreateUserWithEmailAndPassword(auth);
  const [signInWithEmailAndPassword, , loadingSignIn, errorSignIn] =
    useSignInWithEmailAndPassword(auth);
  const [signInWithGoogle, , loadingGoogle, errorGoogle] =
    useSignInWithGoogle(auth);

  const isLoading = loadingCreate || loadingSignIn || loadingGoogle;

  useEffect(() => {
    if (user) {
      const checkSuspended = async () => {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};

        if (data.suspended) {
          toast.error("Your account is suspended.");
          return;
        }

        if (!snap.exists()) {
          await setDoc(ref, { email: user.email, createdAt: Date.now() });
        }

        router.push("/dashboard");
      };

      checkSuspended();
    }
  }, [user]);

  const handleAuth = async () => {
    if (!email || !password) return toast.error("Email and password required");
    if (mode === "signup") {
      await createUserWithEmailAndPassword(email, password);
    } else {
      await signInWithEmailAndPassword(email, password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md space-y-6 bg-gray-900 border border-gray-800 p-6 rounded shadow-xl">
        <h1 className="text-2xl font-bold text-center text-white">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>

        <div className="space-y-4">
          <input
            type="email"
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-400 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-400 p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex justify-center"
            onClick={handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === "signup" ? (
              "Sign Up"
            ) : (
              "Sign In"
            )}
          </button>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-blue-400 hover:underline block text-center"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={() => signInWithGoogle()}
              className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
              disabled={loadingGoogle}
            >
              Sign In with Google
            </button>
          </div>
        </div>

        {(errorCreate || errorSignIn || errorGoogle) && (
          <p className="text-sm text-red-400 text-center">
            {errorCreate?.message ||
              errorSignIn?.message ||
              errorGoogle?.message}
          </p>
        )}
      </div>
    </div>
  );
}
