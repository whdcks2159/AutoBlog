"use server";

import { auth } from "@/lib/auth";
import { addPoints } from "@/lib/points";

function isAdmin(userId: string | undefined) {
  return userId && userId === process.env.ADMIN_USER_ID;
}

export async function adminAddPoints(userId: string, amount: number): Promise<number> {
  const session = await auth();
  if (!isAdmin(session?.userId)) throw new Error("권한 없음");
  return addPoints(userId, amount, "관리자 수동 지급");
}
