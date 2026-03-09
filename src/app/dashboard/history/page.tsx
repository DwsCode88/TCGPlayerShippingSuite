"use client";

import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SidebarLayout from "@/components/SidebarLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

type OrderRecord = {
  batchId: string;
  batchName: string;
  createdAt: number;
  userId: string;
};

type BatchMeta = {
  batchId: string;
  batchName: string;
  orderCount: number;
  createdAt: number;
  notes?: string;
  archived?: boolean;
};

export default function BatchHistoryPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [batches, setBatches] = useState<BatchMeta[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    const loadBatches = async () => {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const map = new Map<string, BatchMeta>();

      snapshot.forEach((doc) => {
        const data = doc.data() as OrderRecord;
        if (!data.batchId) return;

        if (!map.has(data.batchId)) {
          map.set(data.batchId, {
            batchId: data.batchId,
            batchName: data.batchName || "Unnamed Batch",
            createdAt: data.createdAt || 0,
            orderCount: 1,
          });
        } else {
          map.get(data.batchId)!.orderCount += 1;
        }
      });

      const withNotesAndStatus = await Promise.all(
        Array.from(map.values()).map(async (b) => {
          const batchRef = doc(db, "batches", b.batchId);
          const metaSnap = await getDoc(batchRef);
          const notes = metaSnap.exists() ? metaSnap.data().notes || "" : "";
          const archived = metaSnap.exists()
            ? metaSnap.data().archived || false
            : false;
          return { ...b, notes, archived };
        })
      );

      setBatches(
        withNotesAndStatus
          .filter((b) => !b.archived)
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    };

    loadBatches();
  }, [user]);

  const handleArchive = async (batchId: string) => {
    await updateDoc(doc(db, "batches", batchId), { archived: true });
    setBatches((prev) => prev.filter((b) => b.batchId !== batchId));
  };

  if (loading || !user) return null;

  return (
    <SidebarLayout>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--muted-foreground)" }}
          >
            Batch History
          </h1>
          <a
            href="/api/export-batches"
            className="text-[12px] px-3 py-1.5 rounded border font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
          >
            Download Full Report (CSV)
          </a>
        </div>

        {batches.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)" }} className="text-sm">
            No batches found.
          </p>
        ) : (
          <div
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "var(--stripe)" }}>
                  {["Batch Name", "Orders", "Created", "Status", "Notes", ""].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-b"
                        style={{
                          color: "var(--muted-foreground)",
                          borderColor: "var(--border)",
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, i) => (
                  <tr
                    key={batch.batchId}
                    style={{
                      background: i % 2 === 0 ? "var(--background)" : "var(--stripe)",
                    }}
                  >
                    <td
                      className="px-3.5 py-2.5 border-b text-[13px] font-medium"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Link
                        href={`/dashboard/batch/${batch.batchId}`}
                        className="hover:underline"
                        style={{ color: "var(--primary-color)" }}
                      >
                        {batch.batchName}
                      </Link>
                    </td>
                    <td
                      className="px-3.5 py-2.5 border-b text-[13px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {batch.orderCount} order{batch.orderCount !== 1 ? "s" : ""}
                    </td>
                    <td
                      className="px-3.5 py-2.5 border-b text-[13px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {batch.createdAt
                        ? new Date(batch.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td
                      className="px-3.5 py-2.5 border-b"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Badge
                        variant={batch.archived ? "secondary" : "default"}
                        className="text-[11px]"
                      >
                        {batch.archived ? "Archived" : "Active"}
                      </Badge>
                    </td>
                    <td
                      className="px-3.5 py-2.5 border-b text-[12px] italic"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {batch.notes || "—"}
                    </td>
                    <td
                      className="px-3.5 py-2.5 border-b"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="text-[12px] px-3 py-1.5 rounded border font-medium transition-colors"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            Archive
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Archive this batch?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will archive &ldquo;{batch.batchName}&rdquo;. You can
                              still access it from History.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleArchive(batch.batchId)}
                              style={{
                                background: "var(--destructive)",
                                color: "var(--destructive-foreground)",
                              }}
                            >
                              Archive Batch
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
