import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import AdminClient from "./AdminClient";

async function getAdminData() {
  const supabase = createServiceClient();

  const [{ data: pointsData }, { data: usersData }] = await Promise.all([
    supabase
      .from("user_points")
      .select("user_id, points, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("users").select("naver_id, name, email, image"),
  ]);

  const usersMap = new Map((usersData ?? []).map((u) => [u.naver_id, u]));

  const users = (pointsData ?? []).map((p) => ({
    userId: p.user_id as string,
    points: p.points as number,
    updatedAt: p.updated_at as string | null,
    name: usersMap.get(p.user_id)?.name ?? null,
    email: usersMap.get(p.user_id)?.email ?? null,
    image: usersMap.get(p.user_id)?.image ?? null,
  }));

  const totalPoints = users.reduce((sum, u) => sum + u.points, 0);

  return { users, totalPoints };
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const { users, totalPoints } = await getAdminData();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← 대시보드</a>
        <span className="text-gray-200">/</span>
        <h1 className="text-sm font-bold text-gray-700">관리자</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h2 className="text-xl font-black text-gray-900">유저 관리</h2>

        {/* 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">전체 유저</p>
            <p className="text-3xl font-black text-gray-900">{users.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">총 보유 포인트</p>
            <p className="text-3xl font-black text-green-600">{totalPoints.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 mb-1">평균 포인트</p>
            <p className="text-3xl font-black text-gray-900">
              {users.length ? Math.round(totalPoints / users.length).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {/* 유저 목록 */}
        <AdminClient users={users} />
      </main>
    </div>
  );
}
