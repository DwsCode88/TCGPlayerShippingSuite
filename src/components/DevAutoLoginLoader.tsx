"use client";

import dynamic from "next/dynamic";

const DevAutoLogin = dynamic(() => import("@/components/DevAutoLogin"), {
  ssr: false,
});

export default function DevAutoLoginLoader() {
  return <DevAutoLogin />;
}
