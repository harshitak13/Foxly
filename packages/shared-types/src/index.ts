export type JwtRoleHint = "user" | "guardian" | "recovery";

/** Stable JWT contract consumed by Foxly and future Tally services. */
export interface FoxlyJwtPayload {
  sub: string;
  email: string;
  role?: JwtRoleHint;
  scope?: "full" | "passkey_registration_only";
  version?: number;
  iat: number;
  exp: number;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface Approval {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  requiredApprovals: number;
  currentApprovals: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  title: string;
  description: string;
  requiredApprovals?: number;
}

export interface ApprovalResponse {
  approval: Approval;
}

export type RiskPolicy =
  | "PASSKEY_ONLY"
  | "PASSKEY_PLUS_BACKUP_CONFIRM"
  | "PASSKEY_PLUS_PUSH_APPROVAL_OTHER_DEVICE"
  | "BLOCK_AND_NOTIFY";

export interface RiskAssessment {
  score: number;
  reasons: string[];
  policy: RiskPolicy;
}
