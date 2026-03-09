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
  const [isSignUp, setIsSignUp] = useState(false);

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
        toast("📬 Don't forget to check your spam folder.");
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
        const { uid, email, displayName, phoneNumber } = res.user;

        await setDoc(
          doc(db, "users", uid),
          {
            email: email || "",
            fullName: displayName || "",
            phone: phoneNumber || "",
            storeName: "", // let user fill this later
            createdAt: Date.now(),
          },
          { merge: true }
        );

        toast.success("✅ Signed in with Google");
        router.push("/dashboard");
      }
    } catch (err) {
      console.error(err);
      toast.error("Google sign-in failed");
    }
  };

  const handleEmailSignIn = async () => {
    try {
      await signInWithEmailAndPassword(email, password);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Sign in failed");
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1.5px solid var(--sidebar)",
    borderRadius: "6px",
    fontSize: "13px",
  };

  if (loading) return null;

  // Show splash screen if user is signed in but email not verified
  if (user && !user.emailVerified && waitingForVerification) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--sidebar)" }}
      >
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-[360px] w-full space-y-4 text-center">
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--sidebar)" }}
          >
            Verify Your Email
          </h1>
          <p className="text-gray-600 text-sm">
            We&apos;ve sent a verification link to{" "}
            <strong>{user.email}</strong>.
          </p>
          <p className="text-amber-600 text-sm">
            Don&apos;t forget to check your <strong>spam folder</strong>!
          </p>
          <button
            onClick={handleResendVerification}
            className="w-full py-2.5 rounded-md text-white font-semibold text-[13px] transition-opacity hover:opacity-90"
            style={{ background: "var(--primary-color)" }}
          >
            Resend Verification Email
          </button>
          <p className="text-xs text-gray-400">
            This page will auto-refresh once verified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="w-full max-w-[360px] bg-white rounded-xl shadow-lg p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--sidebar)" }}
          >
            TCG Shipping
          </h1>
          <p className="text-sm text-gray-500 font-medium">Shipping Suite</p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md font-semibold text-[13px] transition-colors hover:bg-gray-50"
          style={{
            border: "1.5px solid var(--sidebar)",
            color: "var(--sidebar)",
            background: "#ffffff",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Sign Up Fields (conditionally shown) */}
        {isSignUp && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--active-color)]"
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Store Name"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--active-color)]"
              style={inputStyle}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--active-color)]"
              style={inputStyle}
            />
          </div>
        )}

        {/* Email & Password */}
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--active-color)]"
            style={inputStyle}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-14 focus:outline-none focus:ring-2 focus:ring-[var(--active-color)]"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
              style={{ color: "var(--active-color)" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Action Button */}
        {isSignUp ? (
          <button
            onClick={handleSignUp}
            className="w-full py-2.5 rounded-md text-white font-semibold text-[13px] transition-opacity hover:opacity-90"
            style={{ background: "var(--primary-color)" }}
          >
            Create Account
          </button>
        ) : (
          <button
            onClick={handleEmailSignIn}
            className="w-full py-2.5 rounded-md text-white font-semibold text-[13px] transition-opacity hover:opacity-90"
            style={{ background: "var(--primary-color)" }}
          >
            Sign In
          </button>
        )}

        {/* Toggle Sign Up / Sign In */}
        <p className="text-center text-xs text-gray-500">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setIsSignUp(false)}
                className="font-semibold hover:underline"
                style={{ color: "var(--active-color)" }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setIsSignUp(true)}
                className="font-semibold hover:underline"
                style={{ color: "var(--active-color)" }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
