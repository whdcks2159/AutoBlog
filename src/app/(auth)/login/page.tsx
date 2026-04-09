import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* 로고 + 헤드카피 */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl mb-4 shadow-lg shadow-green-900/40">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">AutoBlog</h1>
          <p className="text-slate-400 mt-2 text-sm">
            사진 한 장 → 4개 플랫폼 콘텐츠 자동 생성
          </p>
        </div>

        {/* 플랫폼 프리뷰 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📝", platform: "네이버 블로그", badge: "무료", color: "border-green-500/30 bg-green-500/5" },
            { icon: "✦",  platform: "트위터 (X)",   badge: "무료", color: "border-slate-500/30 bg-slate-500/5" },
            { icon: "🎬", platform: "인스타그램 릴스", badge: "프리미엄", color: "border-purple-500/30 bg-purple-500/5" },
            { icon: "🎵", platform: "틱톡",          badge: "프리미엄", color: "border-pink-500/30 bg-pink-500/5" },
          ].map((item) => (
            <div key={item.platform}
              className={`rounded-xl border p-3 flex items-center gap-2.5 ${item.color}`}>
              <span className="text-xl">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{item.platform}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
                  ${item.badge === "무료"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-purple-500/20 text-purple-400"}`}>
                  {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 로그인 카드 */}
        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 space-y-4 shadow-xl">
          <p className="text-xs text-slate-400 text-center font-medium">
            플랫폼 계정으로 1초 로그인
          </p>

          {/* 네이버 로그인 */}
          <form
            action={async () => {
              "use server";
              await signIn("naver", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-[#03C75A] hover:bg-[#02b350] active:scale-[0.98] text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-150 text-sm shadow-lg shadow-green-900/30"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버로 시작하기
            </button>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">또는</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* 트위터 로그인 */}
          <form
            action={async () => {
              "use server";
              await signIn("twitter", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 active:scale-[0.98] text-black font-bold py-3.5 px-6 rounded-xl transition-all duration-150 text-sm shadow-lg shadow-black/20"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X(트위터)로 시작하기
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600">
          로그인 시 해당 플랫폼의 게시 권한이 요청됩니다
        </p>
      </div>
    </div>
  );
}
