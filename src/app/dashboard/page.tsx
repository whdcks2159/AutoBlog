import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { getUserPoints } from "@/lib/points";
import { checkAdRewardAvailable } from "./adActions";
import { hasTwitterToken } from "@/lib/twitter-tokens";
import { createServiceClient } from "@/lib/supabase";
import UploadArea from "./UploadArea";
import PointStatus from "./PointStatus";

async function isOnboarded(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("users")
    .select("onboarded")
    .eq("naver_id", userId)
    .single();
  return data?.onboarded ?? false;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.userId && !(await isOnboarded(session.userId))) {
    redirect("/welcome");
  }

  const [points, adAvailableToday, twitterLinked] = await Promise.all([
    session.userId ? getUserPoints(session.userId) : Promise.resolve(0),
    checkAdRewardAvailable(),
    session.userId ? hasTwitterToken(session.userId) : Promise.resolve(false),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-green-600">AutoBlog</h1>
        <div className="flex items-center gap-3">
          <PointStatus points={points} />
          {session.user?.image && (
            <img
              src={session.user.image}
              alt="프로필"
              className="w-8 h-8 rounded-full ring-2 ring-green-100"
            />
          )}
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {session.user?.name}님
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              로그아웃
            </button>
          </form>
        </div>
      </nav>

      {/* 메인 */}
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">콘텐츠 만들기</h2>
          <p className="text-gray-500 mt-1 text-sm">
            사진을 업로드하면 AI가 플랫폼에 맞는 글을 자동으로 작성해드려요.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <UploadArea
            provider={session.provider ?? "naver"}
            initialPoints={points}
            adAvailableToday={adAvailableToday}
            twitterLinked={twitterLinked || session.provider === "twitter"}
          />
        </div>
      </main>
    </div>
  );
}
