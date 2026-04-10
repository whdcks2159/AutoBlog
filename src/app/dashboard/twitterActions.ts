"use server";

import { auth } from "@/lib/auth";
import { getTwitterToken } from "@/lib/twitter-tokens";

interface PostResult {
  success: boolean;
  tweetUrl?: string;
  error?: string;
}

export async function postTweet(text: string): Promise<PostResult> {
  const session = await auth();
  if (!session?.user || !session.userId) return { success: false, error: "로그인이 필요합니다." };

  // DB에서 연동된 Twitter 토큰 조회 (provider 무관)
  const tokenRow = await getTwitterToken(session.userId);
  const accessToken = tokenRow?.access_token ?? session.twitterAccessToken;
  if (!accessToken)
    return { success: false, error: "트위터 계정이 연동되어 있지 않습니다. 대시보드에서 트위터를 연결해주세요." };

  try {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Twitter API error:", response.status, errorBody);
      return {
        success: false,
        error: `트위터 API 오류 (${response.status}). 권한을 확인해주세요.`,
      };
    }

    const data = await response.json();
    const tweetId = data.data?.id as string | undefined;
    return {
      success: true,
      tweetUrl: tweetId
        ? `https://twitter.com/i/web/status/${tweetId}`
        : "https://twitter.com",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
