import bcrypt from "bcryptjs";
import { randomUUID, webcrypto } from "node:crypto";
import type { Approval } from "shared-types";
import pg from "pg";
import Redis from "ioredis";

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

// DB Connection Clients
const dbUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

const pool = dbUrl ? new pg.Pool({ connectionString: dbUrl }) : null;
const redis = redisUrl ? new Redis(redisUrl) : null;

// Initialize tables and load data into memory Maps (Write-Through cache)
async function initDb() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      // Ensure uuid-ossp extension is enabled
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

      // Create users table and extend with session_version and role if missing
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          name text NOT NULL,
          email text NOT NULL UNIQUE,
          email_verified boolean NOT NULL DEFAULT false,
          usual_login_hours integer[] NOT NULL DEFAULT '{}',
          last_latitude double precision,
          last_longitude double precision,
          last_login_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 0;`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;`);

      // Create credentials
      await client.query(`
        CREATE TABLE IF NOT EXISTS credentials (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          credential_id text NOT NULL UNIQUE,
          public_key text NOT NULL,
          counter bigint NOT NULL DEFAULT 0,
          transports text[] NOT NULL DEFAULT '{}',
          device_label text NOT NULL DEFAULT 'Passkey device',
          fingerprint_hash text,
          last_used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          revoked_at timestamptz
        );
      `);

      // Create backup_codes
      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_codes (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          code_hash text NOT NULL,
          used boolean NOT NULL DEFAULT false,
          used_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create device_link_sessions
      await client.query(`
        CREATE TABLE IF NOT EXISTS device_link_sessions (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'completed', 'expired')),
          challenge text,
          email_code_hash text,
          email_code_expires_at timestamptz,
          completed_credential_id uuid REFERENCES credentials(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL
        );
      `);

      // Create auth_link_sessions
      await client.query(`
        CREATE TABLE IF NOT EXISTS auth_link_sessions (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending',
          challenge text,
          token text,
          completed_credential_id uuid REFERENCES credentials(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL
        );
      `);

      // Create approvals
      await client.query(`
        CREATE TABLE IF NOT EXISTS approvals (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title text NOT NULL,
          description text NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          required_approvals integer NOT NULL DEFAULT 1,
          current_approvals integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create audit_log
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid REFERENCES users(id) ON DELETE SET NULL,
          approval_id uuid REFERENCES approvals(id) ON DELETE SET NULL,
          action text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}',
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Create user_notifications
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          text text NOT NULL,
          read boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      // Load all tables into memory cache
      console.log("⚡ Loading persistent store data from PostgreSQL...");
      
      const resUsers = await client.query("SELECT * FROM users");
      for (const r of resUsers.rows) {
        users.set(r.id, {
          id: r.id, name: r.name, email: r.email,
          emailVerified: r.email_verified, usualLoginHours: r.usual_login_hours,
          sessionVersion: r.session_version, role: r.role, createdAt: new Date(r.created_at)
        });
      }

      const resCreds = await client.query("SELECT * FROM credentials");
      for (const r of resCreds.rows) {
        credentials.set(r.id, {
          id: r.id, userId: r.user_id, credentialId: r.credential_id, publicKey: r.public_key,
          counter: Number(r.counter), transports: r.transports, deviceLabel: r.device_label,
          fingerprintHash: r.fingerprint_hash, lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : undefined,
          createdAt: new Date(r.created_at), revokedAt: r.revoked_at ? new Date(r.revoked_at) : undefined
        });
      }

      const resBackup = await client.query("SELECT * FROM backup_codes");
      for (const r of resBackup.rows) {
        backupCodes.set(r.id, {
          id: r.id, userId: r.user_id, codeHash: r.code_hash, used: r.used,
          usedAt: r.used_at ? new Date(r.used_at) : undefined, createdAt: new Date(r.created_at)
        });
      }

      const resDeviceSessions = await client.query("SELECT * FROM device_link_sessions");
      for (const r of resDeviceSessions.rows) {
        deviceLinkSessions.set(r.id, {
          id: r.id, userId: r.user_id, status: r.status, challenge: r.challenge,
          emailCodeHash: r.email_code_hash, emailCodeExpiresAt: r.email_code_expires_at ? new Date(r.email_code_expires_at) : undefined,
          completedCredentialId: r.completed_credential_id, createdAt: new Date(r.created_at), expiresAt: new Date(r.expires_at)
        });
      }

      const resAuthSessions = await client.query("SELECT * FROM auth_link_sessions");
      for (const r of resAuthSessions.rows) {
        authLinkSessions.set(r.id, {
          id: r.id, userId: r.user_id, status: r.status, challenge: r.challenge,
          token: r.token, completedCredentialId: r.completed_credential_id,
          createdAt: new Date(r.created_at), expiresAt: new Date(r.expires_at)
        });
      }

      const resApprovals = await client.query("SELECT * FROM approvals");
      for (const r of resApprovals.rows) {
        approvals.set(r.id, {
          id: r.id, userId: r.user_id, title: r.title, description: r.description, status: r.status,
          requiredApprovals: r.required_approvals, currentApprovals: r.current_approvals,
          createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString()
        });
      }

      const resAudit = await client.query("SELECT * FROM audit_log ORDER BY created_at ASC");
      for (const r of resAudit.rows) {
        auditRows.push({
          id: r.id, userId: r.user_id, approvalId: r.approval_id, action: r.action,
          metadata: r.metadata, createdAt: new Date(r.created_at)
        });
      }

      const resNotifs = await client.query("SELECT * FROM user_notifications");
      for (const r of resNotifs.rows) {
        userNotifications.set(r.id, {
          id: r.id, userId: r.user_id, text: r.text, read: r.read, createdAt: new Date(r.created_at)
        });
      }

      console.log(`✓ Loaded database tables successfully: ${users.size} users, ${credentials.size} credentials.`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("❌ Failed to initialize database / load table contents:", error);
  }
}

// Load database connection
initDb();

// Fire-and-forget helper to execute queries on PostgreSQL asynchronously
function runQuery(sql: string, params: unknown[] = []) {
  if (!pool) return;
  pool.query(sql, params).catch((err) => {
    console.error("❌ Database query execution error:", err);
  });
}

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

    runQuery(
      `INSERT INTO users (id, name, email, email_verified, usual_login_hours, session_version, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET name = $2, session_version = $6, role = $7`,
      [user.id, user.name, user.email, user.emailVerified, user.usualLoginHours, user.sessionVersion, user.role, user.createdAt]
    );

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
      
      runQuery(
        `UPDATE users SET name = $1, email = $2 WHERE id = $3`,
        [u.name, u.email, userId]
      );

      this.addNotification(userId, "Your profile details have been updated.");
      return true;
    }
    return false;
  },
  revokeAllSessions(userId: string) {
    const u = users.get(userId);
    if (u) {
      u.sessionVersion = (u.sessionVersion ?? 0) + 1;

      runQuery(
        `UPDATE users SET session_version = $1 WHERE id = $2`,
        [u.sessionVersion, userId]
      );

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

    runQuery(`DELETE FROM users WHERE id = $1`, [userId]);
    return true;
  },
  saveChallenge(key: string, challenge: string) {
    challenges.set(key, challenge);
    if (redis) {
      redis.setex(key, 300, challenge).catch((err) => console.error("Redis setex error:", err));
    }
  },
  takeChallenge(key: string) {
    const value = challenges.get(key);
    challenges.delete(key);
    if (redis) {
      redis.del(key).catch((err) => console.error("Redis del error:", err));
    }
    return value;
  },
  addCredential(input: Omit<Credential, "id" | "createdAt">) {
    const credential = { ...input, id: randomUUID(), createdAt: new Date() };
    credentials.set(credential.id, credential);
    notifications.push(`New device added for ${credential.userId}`);

    runQuery(
      `INSERT INTO credentials (id, user_id, credential_id, public_key, counter, transports, device_label, fingerprint_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [credential.id, credential.userId, credential.credentialId, credential.publicKey, credential.counter, credential.transports, credential.deviceLabel, credential.fingerprintHash, credential.createdAt]
    );

    this.addNotification(credential.userId, `New device paired: ${credential.deviceLabel}`);
    return credential;
  },
  credentialsForUser(userId: string) { return [...credentials.values()].filter((c) => c.userId === userId && !c.revokedAt); },
  findCredentialByExternalId(credentialId: string) { return [...credentials.values()].find((c) => c.credentialId === credentialId && !c.revokedAt); },
  updateCredentialCounter(id: string, counter: number) {
    const c = credentials.get(id);
    if (c) {
      c.counter = counter;
      c.lastUsedAt = new Date();

      runQuery(
        `UPDATE credentials SET counter = $1, last_used_at = $2 WHERE id = $3`,
        [c.counter, c.lastUsedAt, id]
      );
    }
  },
  auditDeviceAuth(userId: string, credential: Credential, source: string) {
    const row = {
      id: randomUUID(),
      userId,
      action: "device.authentication.completed",
      metadata: { credentialId: credential.credentialId, deviceName: credential.deviceLabel, source },
      createdAt: new Date()
    };
    auditRows.push(row);

    runQuery(
      `INSERT INTO audit_log (id, user_id, action, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.id, row.userId, row.action, row.metadata, row.createdAt]
    );
  },
  revokeCredential(userId: string, id: string) {
    const c = credentials.get(id);
    if (!c || c.userId !== userId) return false;
    c.revokedAt = new Date();
    notifications.push(`Device revoked for ${userId}`);

    runQuery(
      `UPDATE credentials SET revoked_at = $1 WHERE id = $2`,
      [c.revokedAt, id]
    );

    this.addNotification(userId, `Device revoked: ${c.deviceLabel}`);
    return true;
  },
  async generateBackupCodes(userId: string) {
    [...backupCodes.values()].filter((c) => c.userId === userId && !c.used).forEach((c) => {
      c.used = true;
      c.usedAt = new Date();
      runQuery(`UPDATE backup_codes SET used = true, used_at = $1 WHERE id = $2`, [c.usedAt, c.id]);
    });
    
    const plain = Array.from({ length: 3 }, () => cryptoCode());
    for (const code of plain) {
      const id = randomUUID();
      const row = { id, userId, codeHash: await bcrypt.hash(code, 10), used: false, createdAt: new Date() };
      backupCodes.set(id, row);

      runQuery(
        `INSERT INTO backup_codes (id, user_id, code_hash, used, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.id, row.userId, row.codeHash, row.used, row.createdAt]
      );
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

    runQuery(
      `INSERT INTO device_link_sessions (id, user_id, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, session.status, session.createdAt, session.expiresAt]
    );

    auditRows.push({ id: randomUUID(), userId, action: "device_link.created", metadata: { sessionId: session.id }, createdAt: new Date() });
    return session;
  },
  getDeviceLinkSession(id: string) {
    const session = deviceLinkSessions.get(id);
    if (!session) return null;
    if (session.status !== "completed" && session.expiresAt.getTime() <= Date.now()) {
      session.status = "expired";
      runQuery(`UPDATE device_link_sessions SET status = 'expired' WHERE id = $1`, [id]);
    }
    return session;
  },
  markDeviceLinkScanned(id: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status !== "pending") return session;
    session.status = "scanned";

    runQuery(`UPDATE device_link_sessions SET status = 'scanned' WHERE id = $1`, [id]);

    auditRows.push({ id: randomUUID(), userId: session.userId, action: "device_link.scanned", metadata: { sessionId: id }, createdAt: new Date() });
    return session;
  },
  setDeviceLinkChallenge(id: string, challenge: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.challenge = challenge;

    runQuery(`UPDATE device_link_sessions SET challenge = $1 WHERE id = $2`, [challenge, id]);

    return session;
  },
  async setDeviceLinkEmailCode(id: string) {
    const session = this.getDeviceLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    const code = numericCode();
    session.emailCodeHash = await bcrypt.hash(code, 10);
    session.emailCodeExpiresAt = new Date(Date.now() + 5 * 60_000);

    runQuery(
      `UPDATE device_link_sessions SET email_code_hash = $1, email_code_expires_at = $2 WHERE id = $3`,
      [session.emailCodeHash, session.emailCodeExpiresAt, id]
    );

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

    runQuery(
      `UPDATE device_link_sessions SET status = 'completed', completed_credential_id = $1 WHERE id = $2`,
      [credentialId, id]
    );

    auditRows.push({ id: randomUUID(), userId: session.userId, action: "device_link.completed", metadata: { sessionId: id, credentialId }, createdAt: new Date() });
    this.addNotification(session.userId, "A backup sign-in device was registered.");
    return session;
  },
  createAuthLinkSession(userId: string, ttlMs = 5 * 60_000) {
    const session: AuthLinkSession = { id: randomUUID(), userId, status: "pending", createdAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) };
    authLinkSessions.set(session.id, session);

    runQuery(
      `INSERT INTO auth_link_sessions (id, user_id, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [session.id, session.userId, session.status, session.createdAt, session.expiresAt]
    );

    auditRows.push({ id: randomUUID(), userId, action: "auth_link.created", metadata: { sessionId: session.id }, createdAt: new Date() });
    return session;
  },
  getAuthLinkSession(id: string) {
    const session = authLinkSessions.get(id);
    if (!session) return null;
    if (session.status !== "completed" && session.expiresAt.getTime() <= Date.now()) {
      session.status = "expired";
      runQuery(`UPDATE auth_link_sessions SET status = 'expired' WHERE id = $1`, [id]);
    }
    return session;
  },
  markAuthLinkScanned(id: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status !== "pending") return session;
    session.status = "scanned";

    runQuery(`UPDATE auth_link_sessions SET status = 'scanned' WHERE id = $1`, [id]);

    auditRows.push({ id: randomUUID(), userId: session.userId, action: "auth_link.scanned", metadata: { sessionId: id }, createdAt: new Date() });
    return session;
  },
  setAuthLinkChallenge(id: string, challenge: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.challenge = challenge;

    runQuery(`UPDATE auth_link_sessions SET challenge = $1 WHERE id = $2`, [challenge, id]);

    return session;
  },
  completeAuthLinkSession(id: string, credentialId: string, token: string) {
    const session = this.getAuthLinkSession(id);
    if (!session || session.status === "completed" || session.status === "expired") return null;
    session.status = "completed";
    session.completedCredentialId = credentialId;
    session.token = token;

    runQuery(
      `UPDATE auth_link_sessions SET status = 'completed', completed_credential_id = $1, token = $2 WHERE id = $3`,
      [credentialId, token, id]
    );

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

        runQuery(
          `UPDATE backup_codes SET used = true, used_at = $1 WHERE id = $2`,
          [row.usedAt, row.id]
        );

        this.addNotification(userId, "A recovery code was used for account access.");
        return true;
      }
    }
    return false;
  },
  failedAttemptCount(email: string) {
    const row = failedAttempts.get(email.toLowerCase());
    return row && row.expiresAt > Date.now() ? row.count : 0;
  },
  recordAttempt(email: string, success: boolean) {
    const key = email.toLowerCase();
    if (success) {
      failedAttempts.delete(key);
      if (redis) {
        redis.del(`failed:${key}`).catch((err) => console.error("Redis del error:", err));
      }
      return;
    }
    const row = failedAttempts.get(key);
    const count = (row?.count ?? 0) + 1;
    failedAttempts.set(key, { count, expiresAt: Date.now() + 15 * 60_000 });
    if (redis) {
      redis.setex(`failed:${key}`, 900, String(count)).catch((err) => console.error("Redis setex error:", err));
    }
  },
  createApproval(userId: string, title: string, description: string, requiredApprovals = 1) {
    const now = new Date().toISOString();
    const approval: Approval = { id: randomUUID(), userId, title, description, status: "pending", requiredApprovals, currentApprovals: 0, createdAt: now, updatedAt: now };
    approvals.set(approval.id, approval);

    runQuery(
      `INSERT INTO approvals (id, user_id, title, description, status, required_approvals, current_approvals, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [approval.id, approval.userId, approval.title, approval.description, approval.status, approval.requiredApprovals, approval.currentApprovals, approval.createdAt, approval.updatedAt]
    );

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

    runQuery(
      `UPDATE approvals SET current_approvals = $1, status = $2, updated_at = $3 WHERE id = $4`,
      [approval.currentApprovals, approval.status, approval.updatedAt, id]
    );

    auditRows.push({ id: randomUUID(), userId, approvalId: id, action: "approval.approved", metadata: { currentApprovals: approval.currentApprovals }, createdAt: new Date() });
    this.addNotification(userId, `Approval request approved: ${approval.title}`);
    return approval;
  },
  reject(userId: string, id: string) {
    const approval = approvals.get(id);
    if (!approval || approval.userId !== userId) return null;
    approval.status = "rejected";
    approval.updatedAt = new Date().toISOString();

    runQuery(
      `UPDATE approvals SET status = 'rejected', updated_at = $1 WHERE id = $2`,
      [approval.updatedAt, id]
    );

    auditRows.push({ id: randomUUID(), userId, approvalId: id, action: "approval.rejected", metadata: {}, createdAt: new Date() });
    this.addNotification(userId, `Approval request rejected: ${approval.title}`);
    return approval;
  },
  addNotification(userId: string, text: string) {
    const id = randomUUID();
    const notif = { id, userId, text, read: false, createdAt: new Date() };
    userNotifications.set(id, notif);

    runQuery(
      `INSERT INTO user_notifications (id, user_id, text, read, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [notif.id, notif.userId, notif.text, notif.read, notif.createdAt]
    );
  },
  notificationsForUser(userId: string) {
    return [...userNotifications.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
  markNotificationsRead(userId: string) {
    for (const n of userNotifications.values()) {
      if (n.userId === userId) {
        n.read = true;
        runQuery(`UPDATE user_notifications SET read = true WHERE id = $1`, [n.id]);
      }
    }
  },
  deleteNotification(userId: string, id: string) {
    const n = userNotifications.get(id);
    if (n && n.userId === userId) {
      userNotifications.delete(id);
      runQuery(`DELETE FROM user_notifications WHERE id = $1`, [id]);
      return true;
    }
    return false;
  },
  auditRows: () => auditRows,
  notifications: () => notifications
};
function cryptoCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = new Uint8Array(10); webcrypto.getRandomValues(bytes); return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("").replace(/(.{5})/, "$1-"); }
function numericCode() { const bytes = new Uint8Array(6); webcrypto.getRandomValues(bytes); return Array.from(bytes, (n) => String(n % 10)).join(""); }
