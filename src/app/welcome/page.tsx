import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";

async function completeOnboarding(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  if (!userId) redirect("/dashboard");
  const supabase = createServiceClient();
  // upsert로 없으면 만들고, 있으면 onboarded 업데이트
  await supabase.from("users").upsert(
    { naver_id: userId, onboarded: true },
    { onConflict: "naver_id" }
  );
  redirect("/dashboard");
}

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.userId) redirect("/login");

  const userId = session.userId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">

        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl shadow-xl shadow-green-900/40">
            <svg className="w-11 h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">AutoBlog에 오신 걸<br />환영해요!</h1>
            <p className="text-slate-400 mt-2 text-sm">
              {session.user?.name}님, 가입을 축하드려요 🎉
            </p>
          </div>
        </div>

        {/* 가입 포인트 */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-5">
          <p className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">가입 축하 선물</p>
          <p className="text-4xl font-black text-white">500P</p>
          <p className="text-slate-400 text-sm mt-1">바로 사용 가능합니다</p>
        </div>

        {/* 서비스 소개 */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 space-y-3 text-left">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">이런 걸 할 수 있어요</p>
          {[
            { icon: "📝", title: "네이버 블로그", desc: "사진 올리면 AI가 블로그 글 자동 생성" },
            { icon: "✦",  title: "트위터 (X)",   desc: "AI 트윗 생성 + 즉시 자동 게시" },
            { icon: "📸", title: "인스타그램",    desc: "캡션 + 해시태그 30개 자동 생성" },
            { icon: "🎵", title: "틱톡",          desc: "캡션 + 트렌딩 해시태그 자동 생성" },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <span className="text-xl w-7 text-center flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 시작하기 버튼 */}
        <form action={completeOnboarding}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-black text-base transition-all shadow-lg shadow-green-900/40 active:scale-[0.98]"
          >
            시작하기 →
          </button>
        </form>

        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button type="submit" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
            로그아웃
          </button>
        </form>

      </div>
    </div>
  );
}
