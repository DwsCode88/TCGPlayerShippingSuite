"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
import { debounce } from "lodash";
import SidebarLayout from "@/components/SidebarLayout";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";

type Order = {
  orderNumber: string;
  toName: string;
  trackingCode: string;
  trackingUrl?: string;
  labelUrl: string;
  labelCost: number;
  envelopeCost: number;
  shieldCost: number;
  pennyCost: number;
  loaderCost: number;
  totalCost: number;
  shippingShield: boolean;
  useEnvelope: boolean;
  notes?: string;
};

export default function BatchSummaryPage() {
  const { batchId } = useParams() as { batchId: string };
  const [user] = useAuthState(auth);

  const [orders, setOrders] = useState<Order[]>([]);
  const [batchName, setBatchName] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [createdDate, setCreatedDate] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const batchSnap = await getDoc(doc(db, "batches", batchId));
      const orderSnap = await getDocs(
        query(collection(db, "orders"), where("batchId", "==", batchId))
      );

      const parsed: Order[] = [];
      orderSnap.forEach((doc) => parsed.push(doc.data() as Order));
      setOrders(parsed);

      if (batchSnap.exists()) {
        const meta = batchSnap.data();
        setBatchName(meta.batchName || "");
        setBatchNotes(meta.notes || "");
        setCreatedDate(
          meta.createdAt ? new Date(meta.createdAt).toLocaleString() : ""
        );
        setArchived(meta.archived || false);
      }

      setLoading(false);
    };

    fetchData();
  }, [batchId]);

  const sum = (field: keyof Order) =>
    orders
      .reduce((acc, o) => {
        const value = o[field];
        return acc + (typeof value === "number" ? value : 0);
      }, 0)
      .toFixed(2);

  const debouncedSave = debounce(async (text: string) => {
    const batchRef = doc(db, "batches", batchId);
    await updateDoc(batchRef, { notes: text });
  }, 1000);

  const handleDownloadCSV = () => {
    const csv = [
      ["Order #", "Tracking #", "Carrier"],
      ...orders.map((o) => [o.orderNumber, o.trackingCode, "USPS"]),
    ]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
      .replace(/ /g, "-");

    const timeStr = now
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/:/g, "-");

    const a = document.createElement("a");
    a.href = url;
    a.download = `Tcgtracking_${dateStr}_${timeStr}.csv`;
    a.click();
  };

  const downloadByType = async (labelUrls: string[], filename: string) => {
    if (!labelUrls.length) {
      toast.error("No labels found for this type.");
      return;
    }

    const token = await user?.getIdToken();
    const res = await fetch("/api/labels/merge", {
      method: "POST",
      body: JSON.stringify(labelUrls),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      toast.error("Failed to generate PDF");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const envelopeOrders = orders.filter((o) => o.useEnvelope === true);
  const groundOrders = orders.filter((o) => o.useEnvelope === false);

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6 flex justify-between items-start flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
              📦 Batch Summary
            </h1>
            <p style={{ color: "var(--muted-foreground)" }}>
              Batch: <strong>{batchName}</strong>
            </p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Created: {createdDate}</p>
            {archived && (
              <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold rounded" style={{ background: "rgba(220,38,38,0.15)", color: "var(--destructive)" }}>
                ARCHIVED
              </span>
            )}
          </div>
          <Link
            href="/dashboard/history"
            className="hover:underline text-sm mt-1"
            style={{ color: "var(--primary-color)" }}
          >
            ← Back to History
          </Link>
        </div>

        <div className="mb-6">
          <label
            htmlFor="notes"
            className="block text-sm font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            📝 Batch Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={batchNotes}
            onChange={(e) => {
              const val = e.target.value;
              setBatchNotes(val);
              debouncedSave(val);
            }}
            className="mt-1 w-full border p-2 rounded text-sm"
            placeholder="Add notes about this batch (auto-saved)"
          />
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            🧠 Notes auto-save while typing...
          </p>
        </div>

        {loading ? (
          <p className="text-center" style={{ color: "var(--muted-foreground)" }}>Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-center" style={{ color: "var(--muted-foreground)" }}>
            No orders found for this batch.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={() =>
                  downloadByType(
                    orders.map((o) => o.labelUrl),
                    "batch-all-labels.pdf"
                  )
                }
                style={{
                  background: "var(--primary-color)",
                  color: "var(--primary-foreground)",
                  border: "1.5px solid var(--primary-color)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Download All Labels
              </button>
              <button
                onClick={() =>
                  downloadByType(
                    envelopeOrders.map((o) => o.labelUrl),
                    "batch-envelope-labels.pdf"
                  )
                }
                style={{
                  background: "transparent",
                  color: "var(--primary-color)",
                  border: "1.5px solid var(--primary-color)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Envelopes Only
              </button>
              <button
                onClick={() =>
                  downloadByType(
                    groundOrders.map((o) => o.labelUrl),
                    "batch-ground-labels.pdf"
                  )
                }
                style={{
                  background: "transparent",
                  color: "var(--primary-color)",
                  border: "1.5px solid var(--primary-color)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Ground Advantage Only
              </button>
              <button
                onClick={handleDownloadCSV}
                style={{
                  background: "transparent",
                  color: "var(--muted-foreground)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 6,
                  padding: "7px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Export CSV
              </button>
            </div>

            <div
              className="overflow-x-auto rounded-lg"
              style={{ border: "1px solid var(--border)" }}
            >
              <table className="min-w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Order #</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Name</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Tracking</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Type</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Sleeve</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Loader</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Envelope</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Shield</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Postage</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Total</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Notes</th>
                    <th className="p-3 text-left" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>Label</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? "var(--background)" : "var(--stripe)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td className="p-3">{o.orderNumber}</td>
                      <td className="p-3">{o.toName}</td>
                      <td className="p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {o.trackingCode}
                        {o.trackingUrl && (
                          <div>
                            <a
                              href={o.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--primary-color)", textDecoration: "underline" }}
                            >
                              Track Package
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {o.useEnvelope ? (
                          <Badge
                            style={{
                              background: "rgba(0,148,198,0.15)",
                              color: "var(--active-color)",
                              border: "none",
                            }}
                          >
                            Envelope
                          </Badge>
                        ) : (
                          <Badge
                            style={{
                              background: "rgba(22,163,74,0.15)",
                              color: "var(--success)",
                              border: "none",
                            }}
                          >
                            Ground
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        ${o.pennyCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3">
                        ${o.loaderCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3">
                        ${o.envelopeCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3">
                        ${o.shieldCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3">
                        ${o.labelCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3 font-semibold">
                        ${o.totalCost?.toFixed(2) || "0.00"}
                      </td>
                      <td className="p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {o.notes || ""}
                      </td>
                      <td className="p-3">
                        <a
                          href={o.labelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--primary-color)" }}
                          className="hover:underline"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--stripe)", borderTop: "1px solid var(--border)", fontWeight: 600 }}>
                    <td colSpan={4} className="p-3">
                      Totals
                    </td>
                    <td className="p-3">${sum("pennyCost")}</td>
                    <td className="p-3">${sum("loaderCost")}</td>
                    <td className="p-3">${sum("envelopeCost")}</td>
                    <td className="p-3">${sum("shieldCost")}</td>
                    <td className="p-3">${sum("labelCost")}</td>
                    <td className="p-3">${sum("totalCost")}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
