import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    naverAccessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    naverAccessToken?: string;
    naverRefreshToken?: string;
    naverTokenExpiresAt?: number;
  }
}
