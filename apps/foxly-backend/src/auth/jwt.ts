import { SignJWT, jwtVerify } from "jose";
import type { FoxlyJwtPayload } from "shared-types";
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-only-change-me-foxly-secret");
export async function issueJwt(payload: Omit<FoxlyJwtPayload, "iat" | "exp">, ttl = "2h") {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(ttl).sign(secret);
}
export async function verifyJwt(token?: string): Promise<FoxlyJwtPayload | null> {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] }); return payload as unknown as FoxlyJwtPayload; } catch { return null; }
}
