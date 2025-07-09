"use client";

import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import SettingsForm from "@/components/SettingsForm";

export default function SettingsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading]);

  if (loading || !user) return null;

  return (
    <SidebarLayout>
      <SettingsForm user={user} />
    </SidebarLayout>
  );
}
