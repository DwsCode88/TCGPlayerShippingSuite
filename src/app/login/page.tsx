'use client';

import {
  useSignInWithEmailAndPassword,
  useCreateUserWithEmailAndPassword,
  useSignInWithGoogle,
  useAuthState
} from 'react-firebase-hooks/auth';
import { auth } from '@/firebase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createUserWithEmailAndPassword] = useCreateUserWithEmailAndPassword(auth);
  const [signInWithEmailAndPassword] = useSignInWithEmailAndPassword(auth);
  const [signInWithGoogle] = useSignInWithGoogle(auth);
  const [user] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold text-center">Sign In / Sign Up</h1>
      <input className="w-full p-2 border" type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full p-2 border" type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button className="w-full bg-blue-500 text-white p-2 rounded" onClick={() => signInWithEmailAndPassword(email, password)}>Sign In</button>
      <button className="w-full bg-green-500 text-white p-2 rounded" onClick={() => createUserWithEmailAndPassword(email, password)}>Sign Up</button>
      <hr />
      <button className="w-full bg-red-500 text-white p-2 rounded" onClick={() => signInWithGoogle()}>Sign In with Google</button>
    </div>
  );
}
