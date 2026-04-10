"use server";

import { auth } from "@/lib/auth";
import { addPoints } from "@/lib/points";

function isAdmin(email: string | null | undefined) {
  return email && email === process.env.ADMIN_EMAIL;
}

export async function adminAddPoints(userId: string, amount: number): Promise<number> {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) throw new Error("권한 없음");
  return addPoints(userId, amount, "관리자 수동 지급");
}
