import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { issueJwt, verifyJwt } from "./auth/jwt.js";
import { sendDeviceLinkCodeEmail, sendEmailChangedNotificationEmail, sendBackupCodeUsedEmail } from "./email.js";
import { calculateRiskScore, hashFingerprint } from "./risk/index.js";
import { store } from "./store.js";

dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), override: true });
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: true });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const rpName = "Foxly";
app.set("trust proxy", 1);
const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const origin = configuredOrigins[0];
app.use(cors({
  origin(requestOrigin, callback) {
    if (!requestOrigin || configuredOrigins.includes(requestOrigin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/.test(requestOrigin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${requestOrigin} is not allowed by CORS`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
async function currentUser(req: express.Request) { const payload = await verifyJwt(req.cookies?.foxly_session); if (!payload) return null; const user = store.findUserById(payload.sub); return user && user.sessionVersion === (payload.version ?? 0) ? user : null; }
function expectedOrigins(req: express.Request) {
  const requestOrigin = req.get("origin");
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const protocol = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
  const derivedOrigin = `${protocol}://${host}`;
  return [...new Set([...configuredOrigins, ...(requestOrigin ? [requestOrigin] : []), derivedOrigin])];
}
function getRpId(req: express.Request) {
  const envRpId = process.env.RP_ID;
  if (envRpId && envRpId !== "localhost" && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(envRpId)) {
    return envRpId;
  }
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const hostname = host.split(":")[0];
  if (hostname && hostname !== "localhost" && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return hostname;
  }
  return "localhost";
}
function publicFrontendOrigin(req: express.Request) {
  return process.env.PUBLIC_FRONTEND_ORIGIN ?? req.get("origin") ?? origin;
}
function setSession(req: express.Request, res: express.Response, token: string) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https" || req.get("origin")?.startsWith("https://");
  const requestOrigin = req.get("origin");
  const isCrossSite = requestOrigin ? new URL(requestOrigin).host !== req.get("host") : false;
  res.cookie("foxly_session", token, {
    httpOnly: true,
    sameSite: isCrossSite ? "none" : "lax",
    secure: secure || isCrossSite,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours session timeout limit
  });
}
app.get("/health", (_req, res) => res.json({ ok: true, service: "foxly-backend" }));
app.post("/auth/signup/init", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const existingUser = store.findUserByEmail(email);
  if (existingUser) {
    return res.status(409).json({ error: "Email is already registered" });
  }

  const user = await store.upsertPendingUser(name, email);
  console.log(`[mock-email] verification sent to ${user.email}`);
  res.json({ userId: user.id, email: user.email, verified: user.emailVerified });
});

app.post("/auth/signup/passkey/options", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const options = await generateRegistrationOptions({
    rpName,
    rpID: getRpId(req),
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
  });
  store.saveChallenge(`reg:${user.id}`, options.challenge);
  res.json(options);
});

app.post("/auth/signup/passkey/verify", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const expectedChallenge = store.takeChallenge(`reg:${user.id}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: "registration challenge expired" });
  }
  const verification = await verifyRegistrationResponse({
    response: req.body.attestation,
    expectedChallenge,
    expectedOrigin: expectedOrigins(req),
    expectedRPID: getRpId(req),
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: "passkey verification failed" });
  }
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", req.body.stableClientId);
  store.addCredential({
    userId: user.id,
    credentialId: credentialID,
    publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
    counter,
    transports: req.body.attestation?.response?.transports ?? [],
    deviceLabel: req.body.deviceLabel ?? "Primary passkey",
    fingerprintHash,
  });
  res.json({ verified: true });
});

app.post("/auth/signup/backup-codes", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const codes = await store.generateBackupCodes(user.id);
  const token = await issueJwt({
    sub: user.id,
    email: user.email,
    role: "user",
    scope: "full",
    version: user.sessionVersion ?? 0,
  });
  setSession(req, res, token);
  res.json({ codes });
});

app.post("/auth/signin/init", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    store.recordAttempt(req.body.email ?? "unknown", false);
    return res.status(404).json({ error: "user not found" });
  }
  const allowCredentials = store.credentialsForUser(user.id).map((c) => ({
    id: c.credentialId,
    type: "public-key" as const,
    transports: c.transports as AuthenticatorTransport[],
  }));
  const options = await generateAuthenticationOptions({
    rpID: getRpId(req),
    allowCredentials,
    userVerification: "preferred",
  });
  store.saveChallenge(`auth:${user.id}`, options.challenge);
  res.json(options);
});

app.post("/auth/signin/verify", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const expectedChallenge = store.takeChallenge(`auth:${user.id}`);
  if (!expectedChallenge) {
    return res.status(400).json({ error: "authentication challenge expired" });
  }
  const credential = store.findCredentialByExternalId(req.body.assertion?.id);
  if (!credential) {
    return res.status(401).json({ error: "This device passkey has been revoked or removed from the database and cannot be used to sign in." });
  }
  const verification = await verifyAuthenticationResponse({
    response: req.body.assertion,
    expectedChallenge,
    expectedOrigin: expectedOrigins(req),
    expectedRPID: getRpId(req),
    authenticator: {
      credentialID: credential.credentialId,
      credentialPublicKey: isoBase64URL.toBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[],
    },
    requireUserVerification: true,
  });
  if (!verification.verified) {
    store.recordAttempt(user.email, false);
    return res.status(401).json({ error: "passkey assertion failed" });
  }
  store.updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
  store.auditDeviceAuth(user.id, credential, "native-passkey");
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", req.body.stableClientId);
  const risk = calculateRiskScore({
    userId: user.id,
    deviceKnown: fingerprintHash === credential.fingerprintHash,
    ip: req.ip ?? "",
    userAgent: req.get("user-agent") ?? "",
    stableClientId: req.body.stableClientId,
    failedAttempts: store.failedAttemptCount(user.email),
    loginHour: new Date().getHours(),
    usualLoginHours: user.usualLoginHours,
  });
  store.recordAttempt(user.email, true);
  if (risk.policy === "PASSKEY_PLUS_BACKUP_CONFIRM") {
    return res.json({ stepUp: "backup_code_required", risk });
  }
  if (risk.policy === "PASSKEY_PLUS_PUSH_APPROVAL_OTHER_DEVICE") {
    const approval = store.createApproval(user.id, "High-risk sign in", "Approve this sign-in from another trusted device.");
    return res.json({ stepUp: "push_approval_required", approval, risk });
  }
  if (risk.policy === "BLOCK_AND_NOTIFY") {
    return res.status(403).json({ stepUp: "blocked", risk });
  }
  store.addAuditRow({
    userId: user.id,
    action: "auth.signin.success",
    metadata: { deviceLabel: credential.deviceLabel, method: "native-passkey" },
  });
  const token = await issueJwt({
    sub: user.id,
    email: user.email,
    role: "user",
    scope: "full",
    version: user.sessionVersion ?? 0,
  });
  setSession(req, res, token);
  res.json({ ok: true, risk });
});

app.post("/api/device-link/create", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const session = store.createDeviceLinkSession(user.id);
  const publicOrigin = publicFrontendOrigin(req);
  res.json({
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    url: `${publicOrigin}/device-link/${session.id}`
  });
});

app.get("/api/device-link/:id/status", async (req, res) => {
  const session = store.getDeviceLinkSession(req.params.id);
  if (!session) return res.status(404).json({ error: "device link not found" });
  res.json({ sessionId: session.id, status: session.status, expiresAt: session.expiresAt });
});

app.post("/api/device-link/:id/email-code", async (req, res) => {
  const session = store.markDeviceLinkScanned(req.params.id);
  if (!session) return res.status(404).json({ error: "device link not found" });
  if (session.status === "expired") return res.status(410).json({ error: "This code has expired" });
  if (session.status === "completed") return res.status(409).json({ error: "This code has already been used" });
  const user = store.publicUser(session.userId);
  if (!user || user.email !== String(req.body.email ?? "").toLowerCase()) {
    return res.status(400).json({ error: "Enter the email for the account that created this code" });
  }
  const code = await store.setDeviceLinkEmailCode(session.id);
  if (!code) return res.status(410).json({ error: "This code can no longer be used" });
  try {
    await sendDeviceLinkCodeEmail(user.email, code);
  } catch (error) {
    console.error(`[email] failed to send device-link code to ${user.email}`, error);
    return res.status(503).json({ error: "Could not send the one-time code email. Check backend email configuration." });
  }
  res.json({ ok: true });
});

app.post("/api/device-link/:id/options", async (req, res) => {
  const session = store.markDeviceLinkScanned(req.params.id);
  if (!session) return res.status(404).json({ error: "device link not found" });
  if (session.status === "expired") return res.status(410).json({ error: "This code has expired" });
  if (session.status === "completed") return res.status(409).json({ error: "This code has already been used" });
  const user = store.findUserById(session.userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  const current = await currentUser(req);
  const emailCodeOk = req.body.email && req.body.code
    ? await store.validateDeviceLinkOwner(session.id, req.body.email, req.body.code)
    : false;
  if (current?.id !== user.id && !emailCodeOk) {
    return res.status(401).json({ error: "Confirm the account email before adding this device" });
  }
  const options = await generateRegistrationOptions({
    rpName,
    rpID: getRpId(req),
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none"
  });
  store.setDeviceLinkChallenge(session.id, options.challenge);
  res.json({ account: { email: user.email, name: user.name }, options });
});

app.post("/api/device-link/:id/complete", async (req, res) => {
  const session = store.getDeviceLinkSession(req.params.id);
  if (!session) return res.status(404).json({ error: "device link not found" });
  if (session.status === "expired") return res.status(410).json({ error: "This code has expired" });
  if (session.status === "completed") return res.status(409).json({ error: "This code has already been used" });
  const user = store.findUserById(session.userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  const current = await currentUser(req);
  const emailCodeOk = req.body.email && req.body.code
    ? await store.validateDeviceLinkOwner(session.id, req.body.email, req.body.code)
    : false;
  if (current?.id !== user.id && !emailCodeOk) {
    return res.status(401).json({ error: "Confirm the account email before adding this device" });
  }
  if (!session.challenge) return res.status(400).json({ error: "registration challenge expired" });
  const verification = await verifyRegistrationResponse({
    response: req.body.attestation,
    expectedChallenge: session.challenge,
    expectedOrigin: expectedOrigins(req),
    expectedRPID: getRpId(req),
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: "passkey verification failed" });
  const freshSession = store.getDeviceLinkSession(session.id);
  if (!freshSession || freshSession.status === "completed") return res.status(409).json({ error: "This code has already been used" });
  if (freshSession.status === "expired") return res.status(410).json({ error: "This code has expired" });
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", req.body.stableClientId);
  const credential = store.addCredential({
    userId: user.id,
    credentialId: credentialID,
    publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
    counter,
    transports: req.body.attestation?.response?.transports ?? [],
    deviceLabel: req.body.deviceLabel ?? "Backup passkey device",
    fingerprintHash
  });
  const completed = store.completeDeviceLinkSession(session.id, credential.id);
  if (!completed) return res.status(409).json({ error: "This code has already been used" });
  res.json({ ok: true });
});
app.post("/api/auth-link/create", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) return res.status(404).json({ error: "user not found" });
  const session = store.createAuthLinkSession(user.id);
  const publicOrigin = publicFrontendOrigin(req);
  res.json({
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    url: `${publicOrigin}/auth-link/${session.id}`
  });
});

app.get("/api/auth-link/:id/status", async (req, res) => {
  const session = store.getAuthLinkSession(req.params.id);
  if (!session) return res.status(404).json({ error: "sign-in link not found" });
  if (session.status === "completed" && session.token) setSession(req, res, session.token);
  res.json({ sessionId: session.id, status: session.status, expiresAt: session.expiresAt });
});

app.post("/api/auth-link/:id/options", async (req, res) => {
  const session = store.markAuthLinkScanned(req.params.id);
  if (!session) return res.status(404).json({ error: "sign-in link not found" });
  if (session.status === "expired") return res.status(410).json({ error: "This sign-in code has expired" });
  if (session.status === "completed") return res.status(409).json({ error: "This sign-in code has already been used" });
  const user = store.findUserById(session.userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  const allowCredentials = store.credentialsForUser(user.id).map((c) => ({ id: c.credentialId, type: "public-key" as const, transports: c.transports as AuthenticatorTransport[] }));
  const options = await generateAuthenticationOptions({ rpID: getRpId(req), allowCredentials, userVerification: "preferred" });
  store.setAuthLinkChallenge(session.id, options.challenge);
  res.json({ account: { email: user.email, name: user.name }, options });
});

app.post("/api/auth-link/:id/complete", async (req, res) => {
  const session = store.getAuthLinkSession(req.params.id);
  if (!session) return res.status(404).json({ error: "sign-in link not found" });
  if (session.status === "expired") return res.status(410).json({ error: "This sign-in code has expired" });
  if (session.status === "completed") return res.status(409).json({ error: "This sign-in code has already been used" });
  const user = store.findUserById(session.userId);
  if (!user) return res.status(404).json({ error: "user not found" });
  if (!session.challenge) return res.status(400).json({ error: "authentication challenge expired" });
  const credential = store.findCredentialByExternalId(req.body.assertion?.id);
  if (!credential || credential.userId !== user.id) return res.status(401).json({ error: "This device passkey has been revoked or removed from the database and cannot be used to sign in." });
  const verification = await verifyAuthenticationResponse({
    response: req.body.assertion,
    expectedChallenge: session.challenge,
    expectedOrigin: expectedOrigins(req),
    expectedRPID: getRpId(req),
    authenticator: {
      credentialID: credential.credentialId,
      credentialPublicKey: isoBase64URL.toBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[]
    },
    requireUserVerification: true
  });
  if (!verification.verified) return res.status(401).json({ error: "passkey assertion failed" });
  store.updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
  store.auditDeviceAuth(user.id, credential, "auth-link");
  const token = await issueJwt({ sub: user.id, email: user.email, role: "user", scope: "full", version: user.sessionVersion ?? 0 });
  store.completeAuthLinkSession(session.id, credential.id, token);
  res.json({ ok: true });
});
app.post("/auth/recovery/verify-code", async (req, res) => {
  const user = store.findUserByEmail(req.body.email);
  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }
  const ok = await store.consumeBackupCode(user.id, req.body.code);
  if (!ok) {
    return res.status(401).json({ error: "invalid or used backup code" });
  }
  store.addAuditRow({
    userId: user.id,
    action: "auth.signin.recovery",
    metadata: { method: "backup-code" },
  });

  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", req.body.stableClientId);
  const knownCred = store.credentialsForUser(user.id).find(c => c.fingerprintHash === fingerprintHash);
  
  const risk = calculateRiskScore({
    userId: user.id,
    deviceKnown: Boolean(knownCred),
    ip: req.ip ?? "",
    userAgent: req.get("user-agent") ?? "",
    stableClientId: req.body.stableClientId,
    failedAttempts: store.failedAttemptCount(user.email),
    loginHour: new Date().getHours(),
    usualLoginHours: user.usualLoginHours ?? [],
  });

  if (risk.score > 20) {
    sendBackupCodeUsedEmail(user.email, knownCred ? knownCred.deviceLabel : null).catch(err => console.error("Failed to send backup code used email", err));
  }

  const token = await issueJwt(
    {
      sub: user.id,
      email: user.email,
      role: "recovery",
      scope: "passkey_registration_only",
      version: user.sessionVersion ?? 0,
    },
    "10m"
  );
  setSession(req, res, token);
  res.json({ ok: true, scope: "passkey_registration_only" });
});

app.post("/auth/recovery/complete", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const codes = await store.generateBackupCodes(user.id);
  const token = await issueJwt({
    sub: user.id,
    email: user.email,
    role: "user",
    scope: "full",
    version: user.sessionVersion ?? 0,
  });
  setSession(req, res, token);
  res.json({ codes });
});

app.get("/devices", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const allCreds = store.credentialsForUser(user.id);
  const clientHeader = (req.get("x-stable-client-id") as string) ?? (req.body?.stableClientId as string) ?? (req.query?.stableClientId as string);
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", clientHeader);

  let currentCred = allCreds.find((c) => c.fingerprintHash === fingerprintHash);
  if (!currentCred) {
    currentCred = allCreds.find((c) => c.isPrimary) ?? allCreds[0];
  }

  const primaryCredId = allCreds.find((c) => c.isPrimary)?.id ?? allCreds[0]?.id;
  const isCurrentDevicePrimary = currentCred ? (currentCred.isPrimary || currentCred.id === primaryCredId) : true;
  const currentDeviceCanRevoke = currentCred ? (currentCred.canRevoke || isCurrentDevicePrimary) : true;

  res.json({
    currentDeviceId: currentCred?.id ?? null,
    isCurrentDevicePrimary,
    currentDeviceCanRevoke,
    devices: allCreds.map((c) => {
      const isPrimary = c.isPrimary || c.id === primaryCredId;
      const canRevoke = isPrimary ? true : (c.canRevoke ?? false);
      const isCurrent = c.id === currentCred?.id;
      return {
        id: c.id,
        label: c.deviceLabel,
        isPrimary,
        canRevoke,
        isCurrent,
        lastUsedAt: c.lastUsedAt,
        createdAt: c.createdAt,
      };
    }),
  });
});

app.delete("/devices/:id", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const allCreds = store.credentialsForUser(user.id);
  const clientHeader = (req.get("x-stable-client-id") as string) ?? (req.body?.stableClientId as string) ?? (req.query?.stableClientId as string);
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", clientHeader);

  let currentCred = allCreds.find((c) => c.fingerprintHash === fingerprintHash);
  if (!currentCred) {
    currentCred = allCreds.find((c) => c.isPrimary) ?? allCreds[0];
  }

  if (currentCred && req.params.id === currentCred.id) {
    return res.status(400).json({ error: "A device cannot revoke itself. Use another authorized device to revoke this device, or sign out if you wish to exit." });
  }

  const primaryCredId = allCreds.find((c) => c.isPrimary)?.id ?? allCreds[0]?.id;
  const isPrimary = currentCred ? (currentCred.isPrimary || currentCred.id === primaryCredId) : true;
  const canRevoke = currentCred ? (currentCred.canRevoke || isPrimary) : true;

  if (!canRevoke) {
    return res.status(403).json({ error: "This device does not have access to revoke other devices. Only the primary device or devices with granted revoke access can revoke devices." });
  }

  const targetCred = allCreds.find((c) => c.id === req.params.id);
  const remainingBackupDevices = allCreds.filter((c) => !c.isPrimary && c.id !== primaryCredId && c.id !== req.params.id);
  if (targetCred && targetCred.canRevoke && remainingBackupDevices.length > 0) {
    const otherBackupWithRevoke = remainingBackupDevices.filter((c) => c.canRevoke);
    if (otherBackupWithRevoke.length === 0) {
      return res.status(400).json({ error: "At least one remaining device other than the primary device must have revoke access enabled. Please grant revoke access to another device before revoking this device." });
    }
  }

  res.json({ revoked: store.revokeCredential(user.id, req.params.id) });
});

app.post("/devices/:id/grant-revoke", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const allCreds = store.credentialsForUser(user.id);
  const clientHeader = (req.get("x-stable-client-id") as string) ?? (req.body?.stableClientId as string) ?? (req.query?.stableClientId as string);
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", clientHeader);

  let currentCred = allCreds.find((c) => c.fingerprintHash === fingerprintHash);
  if (!currentCred) {
    currentCred = allCreds.find((c) => c.isPrimary) ?? allCreds[0];
  }

  const primaryCredId = allCreds.find((c) => c.isPrimary)?.id ?? allCreds[0]?.id;
  const isPrimary = currentCred ? (currentCred.isPrimary || currentCred.id === primaryCredId) : true;

  if (!isPrimary) {
    return res.status(403).json({ error: "Only the primary device can grant revoke access to other devices." });
  }

  const ok = store.grantRevokeAccess(user.id, req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Device not found" });
  }
  res.json({ ok: true });
});

app.post("/devices/:id/revoke-revoke", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const allCreds = store.credentialsForUser(user.id);
  const clientHeader = (req.get("x-stable-client-id") as string) ?? (req.body?.stableClientId as string) ?? (req.query?.stableClientId as string);
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", clientHeader);

  let currentCred = allCreds.find((c) => c.fingerprintHash === fingerprintHash);
  if (!currentCred) {
    currentCred = allCreds.find((c) => c.isPrimary) ?? allCreds[0];
  }

  const primaryCredId = allCreds.find((c) => c.isPrimary)?.id ?? allCreds[0]?.id;
  const isPrimary = currentCred ? (currentCred.isPrimary || currentCred.id === primaryCredId) : true;

  if (!isPrimary) {
    return res.status(403).json({ error: "Only the primary device can manage revoke permissions." });
  }

  const targetCred = allCreds.find((c) => c.id === req.params.id);
  if (targetCred && targetCred.canRevoke) {
    const otherBackupWithRevoke = allCreds.filter((c) => !c.isPrimary && c.id !== primaryCredId && c.id !== req.params.id && c.canRevoke);
    if (otherBackupWithRevoke.length === 0) {
      return res.status(400).json({ error: "At least one device other than the primary device must have revoke access enabled." });
    }
  }

  const ok = store.revokeRevokeAccess(user.id, req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Device not found" });
  }
  res.json({ ok: true });
});

app.post("/approvals", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({
    approval: store.createApproval(
      user.id,
      req.body.title,
      req.body.description,
      req.body.requiredApprovals ?? 1
    ),
  });
});

app.get("/approvals", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({ approvals: store.listApprovals(user.id, req.query.status?.toString()) });
});

app.post("/approvals/:id/approve", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!req.body.passkeyAssertion) {
    return res.status(400).json({ error: "fresh passkey assertion required" });
  }
  const approval = store.approve(user.id, req.params.id);
  if (!approval) {
    return res.status(404).json({ error: "approval not found" });
  }
  res.json({ approval });
});

app.get("/audit-log", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({ rows: store.auditRows().filter((r) => r.userId === user.id) });
});

// Formatted recent-activity feed for the dashboard (last 20 events, newest first)
const ACTION_META: Record<string, { label: string; icon: string; category: string }> = {
  "auth.signin.success":              { label: "Signed in",               icon: "🔑", category: "signin" },
  "auth.signin.recovery":             { label: "Signed in via backup code", icon: "🛡", category: "signin" },
  "auth.signout":                     { label: "Signed out",               icon: "🚪", category: "signin" },
  "auth.signout_everywhere":           { label: "Signed out everywhere",    icon: "🚪", category: "signin" },
  "device.registered":                { label: "Device registered",        icon: "➕", category: "security" },
  "device.authentication.completed":  { label: "Signed in",               icon: "🔑", category: "signin" },
  "device.revoked":                   { label: "Device revoked",           icon: "🗑", category: "security" },
  "device_link.created":              { label: "Device link QR created",   icon: "📲", category: "security" },
  "device_link.completed":            { label: "Backup device linked",     icon: "✅", category: "security" },
  "security.backup_codes_regenerated":{ label: "Backup codes regenerated", icon: "🔄", category: "security" },
  "approval.created":                 { label: "Approval requested",       icon: "📋", category: "approval" },
  "approval.approved":                { label: "Approval granted",         icon: "✅", category: "approval" },
  "approval.rejected":                { label: "Approval rejected",        icon: "❌", category: "approval" },
};

app.get("/activity", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const rows = store.auditRows()
    .filter((r) => r.userId === user.id)
    .slice(-20)
    .reverse()
    .map((r) => {
      const meta = ACTION_META[r.action] ?? { label: r.action, icon: "⚙", category: "other" };
      const m = r.metadata as Record<string, unknown>;
      const deviceLabel = typeof m.deviceLabel === "string" ? m.deviceLabel : undefined;
      return {
        id: r.id,
        action: r.action,
        label: meta.label,
        icon: meta.icon,
        category: meta.category,
        device: deviceLabel ?? null,
        createdAt: r.createdAt,
      };
    });
  res.json({ activity: rows });
});


app.get("/auth/me", async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    res.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt ?? new Date() });
  } catch (err) {
    console.error("Error in /auth/me:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/auth/stats", async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const backupCodesUnused = store.backupCodesUnusedCount(user.id);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRiskFlags = store.auditRows().filter(
      (r) =>
        r.userId === user.id &&
        r.action === "auth.signin.recovery" &&
        new Date(r.createdAt).getTime() > thirtyDaysAgo
    ).length;
    res.json({ backupCodesUnused, recentRiskFlags });
  } catch (err) {
    console.error("Error in /auth/stats:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/auth/profile/options", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const allowCredentials = store.credentialsForUser(user.id).map((c) => ({
    id: c.credentialId,
    type: "public-key" as const,
    transports: c.transports as AuthenticatorTransport[],
  }));
  const options = await generateAuthenticationOptions({
    rpID: getRpId(req),
    allowCredentials,
    userVerification: "preferred",
  });
  store.saveChallenge(`auth:${user.id}`, options.challenge);
  res.json(options);
});

app.post("/auth/profile", async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const { name, email, passkeyAssertion } = req.body;
    if (!name || !email) return res.status(400).json({ error: "name and email are required" });
    
    // If changing email, require a fresh passkey assertion
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = store.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      if (!passkeyAssertion) {
        return res.status(400).json({ error: "fresh passkey assertion required to change email" });
      }
      const expectedChallenge = store.takeChallenge(`auth:${user.id}`);
      if (!expectedChallenge) return res.status(400).json({ error: "authentication challenge expired" });
      const credential = store.findCredentialByExternalId(passkeyAssertion.id);
      if (!credential) return res.status(401).json({ error: "This device passkey has been revoked or removed from the database and cannot be used to sign in." });
      const verification = await verifyAuthenticationResponse({
        response: passkeyAssertion,
        expectedChallenge,
        expectedOrigin: expectedOrigins(req),
        expectedRPID: getRpId(req),
        authenticator: {
          credentialID: credential.credentialId,
          credentialPublicKey: isoBase64URL.toBuffer(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransport[],
        },
        requireUserVerification: true,
      });
      if (!verification.verified) {
        return res.status(401).json({ error: "passkey assertion failed" });
      }
      store.updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
      store.addAuditRow({ userId: user.id, action: "security.email_changed", metadata: { oldEmail: user.email, newEmail: email } });
      
      sendEmailChangedNotificationEmail(user.email).catch(err => console.error("Failed to send email changed notification", err));
    }

    store.updateProfile(user.id, name, email);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error in /auth/profile:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/auth/device/options", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const options = await generateRegistrationOptions({
    rpName,
    rpID: getRpId(req),
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none"
  });
  store.saveChallenge(`reg:${user.id}`, options.challenge);
  res.json(options);
});

app.post("/auth/device/verify", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const expectedChallenge = store.takeChallenge(`reg:${user.id}`);
  if (!expectedChallenge) return res.status(400).json({ error: "registration challenge expired" });
  const verification = await verifyRegistrationResponse({
    response: req.body.attestation,
    expectedChallenge,
    expectedOrigin: expectedOrigins(req),
    expectedRPID: getRpId(req),
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: "passkey verification failed" });
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const fingerprintHash = hashFingerprint(req.get("user-agent") ?? "", req.body.stableClientId);
  store.addCredential({
    userId: user.id,
    credentialId: credentialID,
    publicKey: isoBase64URL.fromBuffer(credentialPublicKey),
    counter,
    transports: req.body.attestation?.response?.transports ?? [],
    deviceLabel: req.body.deviceLabel ?? "New passkey",
    fingerprintHash
  });
  res.json({ verified: true });
});

app.post("/auth/logout", async (req, res) => {
  const user = await currentUser(req);
  if (user) store.addAuditRow({ userId: user.id, action: "auth.signout", metadata: {} });
  res.clearCookie("foxly_session");
  res.json({ ok: true });
});

app.post("/auth/signout-everywhere", async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    store.revokeAllSessions(user.id);
    res.clearCookie("foxly_session");
    res.json({ ok: true });
  } catch (err) {
    console.error("Error in /auth/signout-everywhere:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/auth/delete-account", async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "unauthorized" });
    store.deleteAccount(user.id);
    res.clearCookie("foxly_session");
    res.json({ ok: true });
  } catch (err) {
    console.error("Error in /auth/delete-account:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/notifications", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  res.json({ notifications: store.notificationsForUser(user.id) });
});

app.post("/notifications/read-all", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  store.markNotificationsRead(user.id);
  res.json({ ok: true });
});

app.delete("/notifications/:id", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const ok = store.deleteNotification(user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: "notification not found" });
  res.json({ ok: true });
});

app.post("/approvals/:id/reject", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const approval = store.reject(user.id, req.params.id);
  if (!approval) return res.status(404).json({ error: "approval not found" });
  res.json({ approval });
});

const certFile = process.env.HTTPS_CERT_FILE;
const keyFile = process.env.HTTPS_KEY_FILE;

if (certFile && keyFile) {
  https
    .createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app)
    .listen(port, "0.0.0.0", () => console.log(`Foxly backend listening on https://0.0.0.0:${port}`));
} else {
  app.listen(port, "0.0.0.0", () => console.log(`Foxly backend listening on http://0.0.0.0:${port}`));
}




