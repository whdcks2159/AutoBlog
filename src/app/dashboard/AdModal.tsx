"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { claimAdReward } from "./adActions";

const AD_DURATION = 15; // 초
const AD_VIDEO_URL = process.env.NEXT_PUBLIC_AD_VIDEO_URL ?? "";

type Phase = "watching" | "complete" | "claiming" | "error";

interface AdModalProps {
  onSuccess: (newPoints: number) => void;
  onClose: () => void;
}

export default function AdModal({ onSuccess, onClose }: AdModalProps) {
  const [phase, setPhase]       = useState<Phase>("watching");
  const [elapsed, setElapsed]   = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const remaining = Math.max(0, AD_DURATION - elapsed);
  const progress  = Math.min(100, (elapsed / AD_DURATION) * 100);

  /* ── 타이머 시작 ── */
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= AD_DURATION) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPhase("complete");
        }
        return next;
      });
    }, 1000);
  }, []);

  /* ── 마운트 시 타이머/비디오 시작 ── */
  useEffect(() => {
    startTimer();
    if (videoRef.current && AD_VIDEO_URL) {
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  /* ── 비디오 종료 이벤트 → 타이머보다 빨리 끝날 경우 ── */
  const handleVideoEnded = () => {
    if (phase === "watching") {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(AD_DURATION);
      setPhase("complete");
    }
  };

  /* ── 포인트 수령 ── */
  const handleClaim = async () => {
    setPhase("claiming");
    const result = await claimAdReward();
    if (result.success) {
      onSuccess(result.points);
    } else {
      setErrorMsg(result.error);
      setPhase("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider">오늘의 무료 혜택</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">광고 시청 후 100P 받기</p>
          </div>
          {/* 시청 완료 전 X 버튼 비활성화 */}
          <button
            onClick={onClose}
            disabled={phase === "watching" || phase === "claiming"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
              ${(phase === "watching" || phase === "claiming")
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 광고 영역 */}
        <div className="relative bg-gray-900 aspect-video flex items-center justify-center overflow-hidden">
          {AD_VIDEO_URL ? (
            /* 실제 영상 */
            <video
              ref={videoRef}
              src={AD_VIDEO_URL}
              muted
              playsInline
              onEnded={handleVideoEnded}
              className="w-full h-full object-cover"
            />
          ) : (
            /* 더미 광고 플레이스홀더 */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 select-none">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-3 shadow-lg shadow-green-900/40">
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-white font-black text-xl">AutoBlog</p>
              <p className="text-slate-400 text-xs mt-1">AI 콘텐츠 자동화 서비스</p>
              <p className="text-slate-500 text-[10px] mt-4">사진 한 장 → 4개 플랫폼 동시 배포</p>
            </div>
          )}

          {/* 남은 시간 뱃지 */}
          {phase === "watching" && (
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2.5 py-1.5 rounded-full">
              {remaining}초
            </div>
          )}

          {/* 완료 오버레이 */}
          {phase === "complete" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-bold text-sm">시청 완료!</p>
              </div>
            </div>
          )}
        </div>

        {/* 진행 바 */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-green-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 하단 액션 영역 */}
        <div className="px-5 py-5 space-y-3">
          {phase === "watching" && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span>
                  광고 시청 중이에요... <span className="font-bold text-green-600">{remaining}초</span> 후에 포인트를 받을 수 있어요.
                </span>
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                영상이 끝나기 전에는 창을 닫을 수 없어요
              </p>
            </>
          )}

          {phase === "complete" && (
            <button
              onClick={handleClaim}
              className="w-full py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-[0.98] text-white font-black text-sm transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
            >
              <span>⭐</span>
              100P 받기
            </button>
          )}

          {phase === "claiming" && (
            <button disabled
              className="w-full py-3.5 rounded-2xl bg-gray-200 text-gray-400 font-black text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              포인트 지급 중...
            </button>
          )}

          {phase === "error" && (
            <div className="space-y-3">
              <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600 text-center">
                {errorMsg}
              </div>
              <button onClick={onClose}
                className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
