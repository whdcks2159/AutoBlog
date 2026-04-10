import { createServiceClient } from "./supabase";

export const POINT_COSTS = {
  BASIC_GENERATE: 200,  // 네이버/트위터/인스타/틱톡 생성
} as const;

export async function initializeUserPoints(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("initialize_user_points", {
    p_user_id: userId,
  });
  if (error) {
    console.error("initializeUserPoints error:", error);
    return 500;
  }
  return data as number;
}

export async function getUserPoints(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_points")
    .select("points")
    .eq("user_id", userId)
    .single();
  if (error || !data) return 0;
  return (data as { points: number }).points;
}

/**
 * 포인트 차감 (서버 사이드 전용 — 트랜잭션 보장)
 * @returns 차감 후 잔여 포인트
 * @throws "INSUFFICIENT_POINTS" — 잔액 부족 시
 */
export async function deductPoints(
  userId: string,
  amount: number,
  reason: string
): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("deduct_points", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_POINTS")) {
      throw new Error("INSUFFICIENT_POINTS");
    }
    throw new Error("포인트 처리 중 오류가 발생했습니다.");
  }
  return data as number;
}

export async function addPoints(
  userId: string,
  amount: number,
  reason: string
): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("add_points", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw new Error("포인트 추가 실패");
  return data as number;
}
