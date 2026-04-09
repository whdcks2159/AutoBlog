import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { initializeUserPoints } from "./points";

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "naver",
      name: "Naver",
      type: "oauth",
      authorization: {
        url: "https://nid.naver.com/oauth2.0/authorize",
        params: { scope: "blog" },
      },
      token: "https://nid.naver.com/oauth2.0/token",
      userinfo: "https://openapi.naver.com/v1/nid/me",
      profile(profile) {
        return {
          id: profile.response.id,
          name: profile.response.name,
          email: profile.response.email ?? null,
          image: profile.response.profile_image ?? null,
        };
      },
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    },
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "tweet.read tweet.write users.read offline.access",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // 최초 로그인 시 userId 저장
      if (user?.id) {
        token.userId = user.id;
      }
      if (account) {
        token.provider = account.provider;
      }
      if (account?.provider === "naver") {
        token.naverAccessToken = account.access_token;
        token.naverRefreshToken = account.refresh_token;
        token.naverTokenExpiresAt = account.expires_at;
      }
      if (account?.provider === "twitter") {
        token.twitterAccessToken = account.access_token;
        token.twitterRefreshToken = account.refresh_token;
        token.twitterTokenExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).userId = token.userId as string | undefined;
      session.provider = token.provider as string | undefined;
      session.naverAccessToken = token.naverAccessToken as string | undefined;
      session.twitterAccessToken = token.twitterAccessToken as string | undefined;
      return session;
    },
  },
  events: {
    // 로그인마다 포인트 레코드 초기화 (신규 유저면 500포인트 지급, 기존 유저면 무시)
    async signIn({ user }) {
      if (user.id) {
        try {
          await initializeUserPoints(user.id);
        } catch {
          // 포인트 초기화 실패해도 로그인은 정상 진행
        }
      }
    },
  },
  pages: {
    signIn: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
