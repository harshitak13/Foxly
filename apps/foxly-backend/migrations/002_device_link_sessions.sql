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

CREATE INDEX IF NOT EXISTS idx_device_link_sessions_user_id ON device_link_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_link_sessions_expires_at ON device_link_sessions(expires_at);
