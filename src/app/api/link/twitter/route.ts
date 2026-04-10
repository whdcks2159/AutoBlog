import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import crypto from "crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function GET() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
  }

  // PKCE
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const cookieStore = await cookies();
  cookieStore.set("tw_link_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10분
    path: "/",
  });
  cookieStore.set("tw_link_user_id", session.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/link/twitter/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: callbackUrl,
    scope: "tweet.read tweet.write users.read offline.access",
    state: "link",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  );
}
