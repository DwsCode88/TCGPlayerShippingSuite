import { Suspense } from "react";
import BillingPageContent from "./BillingPageContent";

export default function BillingPage() {
  return (
    <Suspense
      fallback={<div className="text-white p-6">Loading billing info...</div>}
    >
      <BillingPageContent />
    </Suspense>
  );
}
