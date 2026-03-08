import * as admin from "firebase-admin";

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (usingEmulator) {
    return admin.initializeApp({ projectId: "tcgplayershipsite" });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");

  const serviceAccount = JSON.parse(
    Buffer.from(raw, "base64").toString("utf-8")
  );

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = getApp();

export const adminAuth = admin.auth(app);
export const adminDb = admin.firestore(app);
