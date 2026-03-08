import { Hono } from "hono";
import { handle } from "hono/vercel";
import { adminAuth } from "@/lib/admin";

type Variables = {
  uid: string;
};

const app = new Hono<{ Variables: Variables }>().basePath("/api");

// Auth middleware — skip for Stripe webhook
app.use("*", async (c, next) => {
  if (c.req.path === "/api/stripe/webhook") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    c.set("uid", decoded.uid);
    return next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Health check
app.get("/health", (c) => c.json({ ok: true }));

export const GET = handle(app);
export const POST = handle(app);
