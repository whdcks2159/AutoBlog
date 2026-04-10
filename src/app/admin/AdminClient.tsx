"use client";

import { useState } from "react";
import { adminAddPoints } from "./actions";

interface UserRow {
  userId: string;
  points: number;
  updatedAt: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
}

export default function AdminClient({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const handleAdd = async (userId: string, amount: number) => {
    setLoadingId(userId);
    try {
      const newPoints = await adminAddPoints(userId, amount);
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, points: newPoints } : u))
      );
      setToast(`+${amount.toLocaleString()}P 지급 완료`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("지급 실패");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">유저 목록</p>
          <p className="text-xs text-gray-400">{users.length}명</p>
        </div>

        <div className="divide-y divide-gray-50">
          {users.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-gray-400">유저 없음</div>
          )}
          {users.map((user) => (
            <div key={user.userId} className="px-5 py-4 flex items-center gap-3 flex-wrap">
              {/* 유저 정보 */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {user.image ? (
                  <img src={user.image} className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-gray-100" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name ?? "이름 없음"}</p>
                  <p className="text-[11px] text-gray-400 truncate font-mono">{user.userId}</p>
                </div>
              </div>

              {/* 포인트 */}
              <div className="flex-shrink-0 text-right mr-2">
                <p className="text-base font-black text-gray-900">{user.points.toLocaleString()}P</p>
                {user.updatedAt && (
                  <p className="text-[10px] text-gray-300">{new Date(user.updatedAt).toLocaleDateString("ko-KR")}</p>
                )}
              </div>

              {/* 포인트 지급 버튼 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {[200, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAdd(user.userId, amount)}
                    disabled={loadingId === user.userId}
                    className="px-2.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    +{amount}
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="number"
                    min={1}
                    placeholder="직접"
                    value={customAmounts[user.userId] ?? ""}
                    onChange={(e) =>
                      setCustomAmounts((prev) => ({ ...prev, [user.userId]: e.target.value }))
                    }
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <button
                    onClick={() => {
                      const amount = parseInt(customAmounts[user.userId] ?? "0");
                      if (amount > 0) handleAdd(user.userId, amount);
                    }}
                    disabled={loadingId === user.userId || !parseInt(customAmounts[user.userId] ?? "0")}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold transition-colors disabled:opacity-40"
                  >
                    지급
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
