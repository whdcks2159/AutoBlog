import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">AutoBlog</h1>
          <p className="text-gray-500 mt-2 text-sm">
            사진 한 장으로 네이버 블로그 포스팅 완성
          </p>
        </div>

        {/* 기능 소개 */}
        <ul className="space-y-3 mb-8">
          {[
            { icon: "📸", text: "사진/동영상 업로드" },
            { icon: "🤖", text: "AI가 내용 분석 및 글 작성" },
            { icon: "📝", text: "네이버 블로그 임시저장 자동 전송" },
          ].map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-lg">{item.icon}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        {/* 네이버 로그인 버튼 */}
        <form
          action={async () => {
            "use server";
            await signIn("naver", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-[#03C75A] hover:bg-[#02b350] text-white font-semibold py-3.5 px-6 rounded-xl transition-colors duration-200 text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
            </svg>
            네이버로 시작하기
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          로그인 시 네이버 블로그 API 접근 권한이 요청됩니다
        </p>
      </div>
    </div>
  );
}
