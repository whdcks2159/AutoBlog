"use server";

import { auth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";

export async function checkAdRewardAvailable(): Promise<boolean> {
  const session = await auth();
  if (!session?.userId) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("check_ad_reward_available", {
    p_user_id: session.userId,
  });
  if (error) return false;
  return data as boolean;
}

export async function claimAdReward(): Promise<
  { success: true; points: number } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.userId) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("claim_ad_reward", {
    p_user_id: session.userId,
  });

  if (error) {
    if (error.message.includes("ALREADY_CLAIMED_TODAY")) {
      return { success: false, error: "오늘은 이미 광고 보상을 받으셨어요. 내일 다시 시도해주세요." };
    }
    return { success: false, error: "포인트 지급에 실패했어요. 다시 시도해주세요." };
  }

  return { success: true, points: data as number };
}
