import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertTwitterToken } from "@/lib/twitter-tokens";

export async function GET(req: NextRequest) {
  const dashboardUrl = new URL("/dashboard", process.env.NEXTAUTH_URL!);
  const cookieStore = await cookies();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || state !== "link" || !code) {
    dashboardUrl.searchParams.set("link_error", error ?? "invalid_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const codeVerifier = cookieStore.get("tw_link_verifier")?.value;
  const userId = cookieStore.get("tw_link_user_id")?.value;

  if (!codeVerifier || !userId) {
    dashboardUrl.searchParams.set("link_error", "session_expired");
    return NextResponse.redirect(dashboardUrl);
  }

  // 쿠키 삭제
  cookieStore.delete("tw_link_verifier");
  cookieStore.delete("tw_link_user_id");

  // 코드 → 토큰 교환
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/link/twitter/callback`;
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error("Twitter token exchange failed:", body);
    dashboardUrl.searchParams.set("link_error", "token_exchange_failed");
    return NextResponse.redirect(dashboardUrl);
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  try {
    await upsertTwitterToken(
      userId,
      tokenData.access_token,
      tokenData.refresh_token ?? null,
      expiresAt
    );
  } catch (e) {
    console.error("upsertTwitterToken error:", e);
    dashboardUrl.searchParams.set("link_error", "db_error");
    return NextResponse.redirect(dashboardUrl);
  }

  dashboardUrl.searchParams.set("link_success", "twitter");
  return NextResponse.redirect(dashboardUrl);
}
