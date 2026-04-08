import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-600">AutoBlog</h1>
        <div className="flex items-center gap-4">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt="프로필"
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-700">{session.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            네이버 로그인 성공!
          </h2>
          <p className="text-gray-500">
            안녕하세요, <span className="font-semibold text-green-600">{session.user?.name}</span>님
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Step 2에서 미디어 업로드 기능을 추가할 예정입니다.
          </p>
        </div>
      </main>
    </div>
  );
}
