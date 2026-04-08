import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

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
          naverNickname: profile.response.nickname ?? null,
        };
      },
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // 최초 로그인 시 네이버 access_token 저장
      if (account && account.provider === "naver") {
        token.naverAccessToken = account.access_token;
        token.naverRefreshToken = account.refresh_token;
        token.naverTokenExpiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.naverAccessToken = token.naverAccessToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
