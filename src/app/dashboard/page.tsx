import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import UploadArea from "./UploadArea";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-bold text-green-600">AutoBlog</h1>
        <div className="flex items-center gap-3">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt="프로필"
              className="w-8 h-8 rounded-full ring-2 ring-green-100"
            />
          )}
          <span className="text-sm font-medium text-gray-700">{session.user?.name}님</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">블로그 글 만들기</h2>
          <p className="text-gray-500 mt-1 text-sm">
            사진이나 동영상을 업로드하면 AI가 네이버 블로그 글을 작성해드려요.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <UploadArea />
        </div>
      </main>
    </div>
  );
}
