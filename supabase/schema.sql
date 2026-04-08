-- AutoBlog Supabase Schema
-- Supabase 대시보드 SQL Editor에서 실행하세요

-- 사용자 테이블 (NextAuth 세션과 연동)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naver_id TEXT UNIQUE NOT NULL,         -- 네이버 고유 ID
  name TEXT,
  email TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 네이버 OAuth 토큰 테이블
CREATE TABLE IF NOT EXISTS naver_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 포스팅 기록 테이블 (Step 3에서 활용)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'published', 'failed')),
  naver_post_id TEXT,                    -- 네이버 블로그 포스트 ID
  media_urls TEXT[],                     -- 업로드한 미디어 URL 목록
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE naver_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 접근 허용 (서버 사이드 API에서 사용)
CREATE POLICY "service_role_all" ON users FOR ALL USING (true);
CREATE POLICY "service_role_all" ON naver_tokens FOR ALL USING (true);
CREATE POLICY "service_role_all" ON posts FOR ALL USING (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_naver_tokens_updated_at BEFORE UPDATE ON naver_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
