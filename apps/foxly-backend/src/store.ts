import bcrypt from "bcryptjs";
import { randomUUID, webcrypto } from "node:crypto";
import type { Approval } from "shared-types";
export interface User { id: string; name: string; email: string; emailVerified: boolean; usualLoginHours: number[]; sessionVersion?: number; role?: string; createdAt?: Date; }
export interface Credential { id: string; userId: string; credentialId: string; publicKey: string; counter: number; transports: string[]; deviceLabel: string; fingerprintHash?: string; lastUsedAt?: Date; createdAt: Date; revokedAt?: Date; }
export type DeviceLinkStatus = "pending" | "scanned" | "completed" | "expired";
export interface DeviceLinkSession { id: string; userId: string; status: DeviceLinkStatus; createdAt: Date; expiresAt: Date; challenge?: string; emailCodeHash?: string; emailCodeExpiresAt?: Date; completedCredentialId?: string; }
export interface AuthLinkSession { id: string; userId: string; status: DeviceLinkStatus; createdAt: Date; expiresAt: Date; challenge?: string; token?: string; completedCredentialId?: string; }
interface BackupCode { id: string; userId: string; codeHash: string; used: boolean; usedAt?: Date; createdAt: Date; }
interface AuditRow { id: string; userId?: string; approvalId?: string; action: string; metadata: unknown; createdAt: Date; }
export interface Notification { id: string; userId: string; text: string; read: boolean; createdAt: Date; }

const users = new Map<string, User>();
const credentials = new Map<string, Credential>();
const backupCodes = new Map<string, BackupCode>();
const approvals = new Map<string, Approval>();
const deviceLinkSessions = new Map<string, DeviceLinkSession>();
const authLinkSessions = new Map<string, AuthLinkSession>();
const auditRows: AuditRow[] = [];
const notifications: string[] = [];
const userNotifications = new Map<string, Notification>();
const challenges = new Map<string, string>();
const failedAttempts = new Map<string, { count: number; expiresAt: number }>();

export const store = {
  async upsertPendingUser(name: string, email: string) {
    const existing = [...users.values()].find((u) => u.email === email.toLowerCase());
    if (existing) return existing;
    const user: User = {
      id: randomUUID(),
      name,
      email: email.toLowerCase(),
      emailVerified: true,
      usualLoginHours: [8,9,10,11,12,13,14,15,16,17,18,19],
      sessionVersion: 0,
      role: "Admin",
      createdAt: new Date()
    };
    users.set(user.id, user);
    // Add an initial notification
    this.addNotification(user.id, "Welcome to Foxly! Your account is active and protected.");
    return user;
  },
  findUserByEmail(email: string) { return [...users.values()].find((u) => u.email === email.toLowerCase()); },
  findUserById(id: string) { return users.get(id); },
  publicUser(userId: string) {
    const user = users.get(userId);
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  },
  updateProfile(userId: string, name: string, email: string) {
    const u = users.get(userId);
    if (u) {
      u.name = name;
      u.email = email.toLowerCase();
      this.addNotification(userId, "Your profile details have been updated.");
      return true;
    }
    return false;
  },
  revokeAllSessions(userId: string) {
    const u = users.get(userId);
    if (u) {
      u.sessionVersion = (u.sessionVersion ?? 0) + 1;
      this.addNotification(userId, "Logged out of all other active sessions.");
      return true;
    }
    return false;
  },
  deleteAccount(userId: string) {
    users.delete(userId);
    // Remove credentials
    for (const [id, c] of credentials.entries()) {
      if (c.userId === userId) credentials.delete(id);
    }
    // Remove backup codes
    for (const [id, b] of backupCodes.entries()) {
      if (b.userId === userId) backupCodes.delete(id);
    }
    // Remove approvals
    for (const [id, a] of approvals.entries()) {
      if (a.userId === userId) approvals.delete(id);
    }
    // Remove notifications
    for (const [id, n] of userNotifications.entries()) {
      if (n.userId === userId) userNotifications.delete(id);
    }
    return true;
  },
  saveChallenge(key: string, challenge: string) { challenges.set(key, challenge); },
  takeChallenge(key: string) { const value = challenges.get(key); challenges.delete(key); return value; },
  addCredential(input: Omit<Credential, "id" | "createdAt">) {
    const credential = { ...input, id: randomUUID(), createdAt: new Date() };
    credentials.set(credential.id, credential);
    notifications.push(`New device added for ${credential.userId}`);
    this.addNotification(credential.userId, `New device paired: ${credential.deviceLabel}`);
    return credential;
  },
  credentialsForUser(userId: string) { return [...credentials.values()].filter((c) => c.userId === userId && !c.revokedAt); },
  findCredentialByExternalId(credentialId: string) { return [...credentials.values()].find((c) => c.credentialId === credentialId && !c.revokedAt); },
  updateCredentialCounter(id: string, counter: number) { const c = credentials.get(id); if (c) { c.counter = counter; c.lastUsedAt = new Date(); } },
  auditDeviceAuth(userId: string, credential: Credential, source: string) {
    auditRows.push({
      id: randomUUID(),
      userId,
      action: "device.authentication.completed",
      metadata: { credentialId: credential.credentialId, deviceName: credential.deviceLabel, source },
      createdAt: new Date()
    });
  },
  revokeCredential(userId: string, id: string) {
    const c = credentials.get(id);
    if (!c || c.userId !== userId) return false;
    c.revokedAt = new Date();
    notifications.push(`Device revoked for ${userId}`);
    this.addNotification(userId, `Device revoked: ${c.deviceLabel}`);
    return true;
  },
  async generateBackupCodes(userId: string) {
    [...backupCodes.values()].filter((c) => c.userId === userId && !c.used).forEach((c) => { c.used = true; c.usedAt = new Date(); });
    const plain = Array.from({ length: 3 }, () => cryptoCode());
    for (const code of plain) {
      const id = randomUUID();
      backupCodes.set(id, { id, userId, codeHash: await bcrypt.hash(code, 10), used: false, createdAt: new Date() });
    }
    this.addNotification(userId, "A fresh set of recovery codes was generated.");
    return plain;
  },
  createDeviceLinkSession(userId: string, ttlMs = 5 * 60_000) {
    const session: DeviceLinkSession = {
      id: randomUUID(),
      userId,
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttlMs)
    };
    deviceLinkSessions.set(session.id, session);
    auditRows.push({ id: randomUUID(), userId, action: "device_link.created", metadata: { sessionId: session.id }, createdAt: new Date() });
    return session;
  },
  getDeviceLinkSession(id: string) {
    const session = deviceLinkSessions.get(id);
    if (!session) return null;
    if (session.status !== "completed" && session.expiresAt.getTime() <= Date.now()) session.status = "expired";
    return session;
  },
  markDeviceLinkScanned(id: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status !== "pending") return session;
    session.status = "scanned";
    auditRows.push({ id: randomUUID(), userId: session.userId, action: "device_link.scanned", metadata: { sessionId: id }, createdAt: new Date() });
    return session;
  },
  setDeviceLinkChallenge(id: string, challenge: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.challenge = challenge;
    return session;
  },
  async setDeviceLinkEmailCode(id: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    const code = numericCode();
    session.emailCodeHash = await bcrypt.hash(code, 10);
    session.emailCodeExpiresAt = new Date(Date.now() + 5 * 60_000);
    return code;
  },
  async validateDeviceLinkOwner(id: string, email: string, code: string) {
    const session = this.getDeviceLinkSession(id);
    const user = session ? users.get(session.userId) : null;
    if (!session || !user || user.email !== email.toLowerCase()) return false;
    if (!session.emailCodeHash || !session.emailCodeExpiresAt || session.emailCodeExpiresAt.getTime() <= Date.now()) return false;
    return bcrypt.compare(code, session.emailCodeHash);
  },
  completeDeviceLinkSession(id: string, credentialId: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.status = "completed";
    session.completedCredentialId = credentialId;
    auditRows.push({ id: randomUUID(), userId: session.userId, action: "device_link.completed", metadata: { sessionId: id, credentialId }, createdAt: new Date() });
    this.addNotification(session.userId, "A backup sign-in device was registered.");
    return session;
  },
  createAuthLinkSession(userId: string, ttlMs = 5 * 60_000) {
    const session: AuthLinkSession = { id: randomUUID(), userId, status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) };
    authLinkSessions.set(session.id, session);
    auditRows.push({ id: randomUUID(), userId, action: "auth_link.created", metadata: { sessionId: session.id }, createdAt: new Date() });
    return session;
  },
  getAuthLinkSession(id: string) {
    const session = authLinkSessions.get(id);
    if (!session) return null;
    if (session.status !== "completed" && session.expiresAt.getTime() <= Date.now()) session.status = "expired";
    return session;
  },
  markAuthLinkScanned(id: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status !== "pending") return session;
    session.status = "scanned";
    auditRows.push({ id: randomUUID(), userId: session.userId, action: "auth_link.scanned", metadata: { sessionId: id }, createdAt: new Date() });
    return session;
  },
  setAuthLinkChallenge(id: string, challenge: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.challenge = challenge;
    return session;
  },
  completeAuthLinkSession(id: string, credentialId: string, token: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.status = "completed";
    session.completedCredentialId = credentialId;
    session.token = token;
    auditRows.push({ id: randomUUID(), userId: session.userId, action: "auth_link.completed", metadata: { sessionId: id, credentialId }, createdAt: new Date() });
    return session;
  },
  async consumeBackupCode(userId: string, code: string) {
    const candidates = [...backupCodes.values()].filter((c) => c.userId === userId && !c.used);
    for (const row of candidates) {
      if (await bcrypt.compare(code, row.codeHash)) {
        if (row.used) return false;
        row.used = true;
        row.usedAt = new Date();
        this.addNotification(userId, "A recovery code was used for account access.");
        return true;
      }
    }
    return false;
  },
  failedAttemptCount(email: string) { const row = failedAttempts.get(email.toLowerCase()); return row && row.expiresAt > Date.now() ? row.count : 0; },
  recordAttempt(email: string, success: boolean) {
    if (success) {
      failedAttempts.delete(email.toLowerCase());
      return;
    }
    const key = email.toLowerCase();
    const row = failedAttempts.get(key);
    failedAttempts.set(key, { count: (row?.count ?? 0) + 1, expiresAt: Date.now() + 15 * 60_000 });
  },
  createApproval(userId: string, title: string, description: string, requiredApprovals = 1) {
    const now = new Date().toISOString();
    const approval: Approval = { id: randomUUID(), userId, title, description, status: "pending", requiredApprovals, currentApprovals: 0, createdAt: now, updatedAt: now };
    approvals.set(approval.id, approval);
    auditRows.push({ id: randomUUID(), userId, approvalId: approval.id, action: "approval.created", metadata: approval, createdAt: new Date() });
    this.addNotification(userId, `Pending approval request created: ${title}`);
    return approval;
  },
  listApprovals(userId: string, status?: string) { return [...approvals.values()].filter((a) => a.userId === userId && (!status || a.status === status)); },
  approve(userId: string, id: string) {
    const approval = approvals.get(id);
    if (!approval || approval.userId !== userId) return null;
    approval.currentApprovals += 1;
    approval.status = approval.currentApprovals >= approval.requiredApprovals ? "approved" : "pending";
    approval.updatedAt = new Date().toISOString();
    auditRows.push({ id: randomUUID(), userId, approvalId: id, action: "approval.approved", metadata: { currentApprovals: approval.currentApprovals }, createdAt: new Date() });
    this.addNotification(userId, `Approval request approved: ${approval.title}`);
    return approval;
  },
  reject(userId: string, id: string) {
    const approval = approvals.get(id);
    if (!approval || approval.userId !== userId) return null;
    approval.status = "rejected";
    approval.updatedAt = new Date().toISOString();
    auditRows.push({ id: randomUUID(), userId, approvalId: id, action: "approval.rejected", metadata: {}, createdAt: new Date() });
    this.addNotification(userId, `Approval request rejected: ${approval.title}`);
    return approval;
  },
  addNotification(userId: string, text: string) {
    const id = randomUUID();
    userNotifications.set(id, { id, userId, text, read: false, createdAt: new Date() });
  },
  notificationsForUser(userId: string) {
    return [...userNotifications.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
  markNotificationsRead(userId: string) {
    for (const n of userNotifications.values()) {
      if (n.userId === userId) n.read = true;
    }
  },
  deleteNotification(userId: string, id: string) {
    const n = userNotifications.get(id);
    if (n && n.userId === userId) {
      userNotifications.delete(id);
      return true;
    }
    return false;
  },
  auditRows: () => auditRows,
  notifications: () => notifications
};
function cryptoCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = new Uint8Array(10); webcrypto.getRandomValues(bytes); return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("").replace(/(.{5})/, "$1-"); }
function numericCode() { const bytes = new Uint8Array(6); webcrypto.getRandomValues(bytes); return Array.from(bytes, (n) => String(n % 10)).join(""); }

