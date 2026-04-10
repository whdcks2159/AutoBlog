-- AutoBlog Supabase Schema
-- Supabase 대시보드 SQL Editor에서 실행하세요

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 유저 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naver_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  image TEXT,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON users FOR ALL USING (true);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 포인트 테이블
CREATE TABLE IF NOT EXISTS user_points (
  user_id TEXT PRIMARY KEY,
  points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON user_points FOR ALL USING (true);

-- 포인트 로그
CREATE TABLE IF NOT EXISTS points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON points_log FOR ALL USING (true);

-- 트위터 토큰
CREATE TABLE IF NOT EXISTS twitter_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE twitter_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON twitter_tokens FOR ALL USING (true);

-- RPC: 신규 유저 포인트 초기화 (500P, 기존 유저 무시)
CREATE OR REPLACE FUNCTION initialize_user_points(p_user_id TEXT)
RETURNS INT AS $$
DECLARE v_points INT;
BEGIN
  INSERT INTO user_points (user_id, points)
  VALUES (p_user_id, 500)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT points INTO v_points FROM user_points WHERE user_id = p_user_id;
  RETURN v_points;
END;
$$ LANGUAGE plpgsql;

-- RPC: 포인트 차감
CREATE OR REPLACE FUNCTION deduct_points(p_user_id TEXT, p_amount INT, p_reason TEXT)
RETURNS INT AS $$
DECLARE v_points INT;
BEGIN
  SELECT points INTO v_points FROM user_points WHERE user_id = p_user_id;
  IF v_points IS NULL OR v_points < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;
  UPDATE user_points SET points = points - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
  INSERT INTO points_log (user_id, amount, reason) VALUES (p_user_id, -p_amount, p_reason);
  RETURN v_points - p_amount;
END;
$$ LANGUAGE plpgsql;

-- RPC: 포인트 추가
CREATE OR REPLACE FUNCTION add_points(p_user_id TEXT, p_amount INT, p_reason TEXT)
RETURNS INT AS $$
DECLARE v_points INT;
BEGIN
  UPDATE user_points SET points = points + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
  INSERT INTO points_log (user_id, amount, reason) VALUES (p_user_id, p_amount, p_reason);
  SELECT points INTO v_points FROM user_points WHERE user_id = p_user_id;
  RETURN v_points;
END;
$$ LANGUAGE plpgsql;
