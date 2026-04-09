import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId?: string;
    provider?: string;
    naverAccessToken?: string;
    twitterAccessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    provider?: string;
    naverAccessToken?: string;
    naverRefreshToken?: string;
    naverTokenExpiresAt?: number;
    twitterAccessToken?: string;
    twitterRefreshToken?: string;
    twitterTokenExpiresAt?: number;
  }
}
