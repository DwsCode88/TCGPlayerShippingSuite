"use client";

import {
  useCreateUserWithEmailAndPassword,
  useSignInWithEmailAndPassword,
  useSignInWithGoogle,
  useAuthState,
} from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { sendEmailVerification, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [createUserWithEmailAndPassword] =
    useCreateUserWithEmailAndPassword(auth);
  const [signInWithEmailAndPassword] = useSignInWithEmailAndPassword(auth);
  const [signInWithGoogle] = useSignInWithGoogle(auth);

  const [waitingForVerification, setWaitingForVerification] = useState(false);

  // Handle redirect after verification
  useEffect(() => {
    if (user?.emailVerified) {
      toast.success("✅ Email verified!");
      router.push("/dashboard");
    } else if (user && !user.emailVerified) {
      setWaitingForVerification(true);
    }
  }, [user]);

  // Poll every 5s to refresh emailVerified state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (waitingForVerification && user) {
      interval = setInterval(async () => {
        await user.reload();
        if (user.emailVerified) {
          setWaitingForVerification(false);
          router.push("/dashboard");
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [waitingForVerification, user]);

  const saveUserProfile = async (uid: string) => {
    const userDoc = doc(db, "users", uid);
    await setDoc(
      userDoc,
      {
        email,
        fullName,
        storeName,
        phone,
        createdAt: Date.now(),
      },
      { merge: true }
    );
  };

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !storeName || !phone) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const res = await createUserWithEmailAndPassword(email, password);
      if (res?.user) {
        await saveUserProfile(res.user.uid);
        await sendEmailVerification(res.user);
        toast.success("✅ Account created. Check your inbox!");
        toast("📬 Don’t forget to check your spam folder.");
        await signOut(auth); // sign out to prevent auto-login without verifying
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Signup failed");
    }
  };

  const handleResendVerification = async () => {
    if (user) {
      await sendEmailVerification(user);
      toast.success("📨 Verification email re-sent!");
      toast("📬 Check your spam folder!");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await signInWithGoogle();
      if (res?.user) {
        await saveUserProfile(res.user.uid);
        toast.success("✅ Signed in with Google");
      }
    } catch (err) {
      console.error(err);
      toast.error("Google sign-in failed");
    }
  };

  if (loading) return null;

  // Show splash screen if user is signed in but email not verified
  if (user && !user.emailVerified && waitingForVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold">📨 Verify Your Email</h1>
          <p className="text-gray-300 text-sm">
            We've sent a verification link to <strong>{user.email}</strong>.
          </p>
          <p className="text-yellow-400 text-sm">
            ⚠️ Don’t forget to check your <strong>spam folder</strong>!
          </p>
          <button
            onClick={handleResendVerification}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
          >
            🔁 Resend Verification Email
          </button>
          <p className="text-xs text-gray-400">
            This page will auto-refresh once verified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 p-6 rounded-lg shadow-lg space-y-5">
        <h1 className="text-2xl font-bold text-center">
          🔐 Sign In / Create Account
        </h1>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          />
          <input
            type="text"
            placeholder="Store Name"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 border border-gray-700"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-blue-400"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            onClick={handleSignUp}
            className="w-full bg-green-600 hover:bg-green-700 py-2 rounded text-white font-semibold"
          >
            📝 Create Account
          </button>

          <button
            onClick={() => signInWithEmailAndPassword(email, password)}
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-white font-semibold"
          >
            🔑 Sign In
          </button>

          <div className="border-t border-gray-700 my-2" />

          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-red-600 hover:bg-red-700 py-2 rounded text-white font-semibold"
          >
            🔒 Sign In with Google
          </button>
        </div>
      </div>
    </div>
  );
}
