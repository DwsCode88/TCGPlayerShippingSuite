export function getEasypostAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(apiKey + ":").toString("base64")}`;
}
