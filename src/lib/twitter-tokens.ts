import { createServiceClient } from "./supabase";

export interface TwitterTokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export async function getTwitterToken(userId: string): Promise<TwitterTokenRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("twitter_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as TwitterTokenRow;
}

export async function upsertTwitterToken(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string | null
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("twitter_tokens").upsert(
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`트위터 토큰 저장 실패: ${error.message}`);
}

export async function hasTwitterToken(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("twitter_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  return !!data;
}
