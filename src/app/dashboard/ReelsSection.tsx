"use client";

import { useState } from "react";
import { ReelsConcept, ReelsScript, generateReelsScript } from "./actions";
import AdModal from "./AdModal";
import Toast from "./Toast";
import { POINT_COSTS } from "@/lib/points";

const CONCEPT_STYLES: Record<ReelsConcept["type"], { emoji: string; border: string; badge: string }> = {
  "감성 스토리형": { emoji: "🌸", border: "border-pink-200",   badge: "bg-pink-100 text-pink-700" },
  "정보성 꿀팁형": { emoji: "💡", border: "border-blue-200",   badge: "bg-blue-100 text-blue-700" },
  "병맛 유머형":   { emoji: "😂", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-700" },
};

interface ReelsSectionProps {
  concepts: [ReelsConcept, ReelsConcept, ReelsConcept];
  guide: string;
  imageUrls: string[];
  platform: "instagram" | "tiktok";
  points: number;
  onPointsChange: (remaining: number) => void;
  adAvailable: boolean;
  onAdClaimed: (newPoints: number) => void;
  onReset: () => void;
}

export default function ReelsSection({
  concepts,
  guide,
  imageUrls,
  platform,
  points,
  onPointsChange,
  adAvailable: adAvailableProp,
  onAdClaimed,
  onReset,
}: ReelsSectionProps) {
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);
  const [script, setScript]               = useState<ReelsScript | null>(null);
  const [loadingIdx, setLoadingIdx]       = useState<number | null>(null);
  const [showPaywall, setShowPaywall]     = useState(false);
  const [paywallConcept, setPaywallConcept] = useState<ReelsConcept | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [showAdModal, setShowAdModal]     = useState(false);
  const [adAvailable, setAdAvailable]     = useState(adAvailableProp);
  const [showToast, setShowToast]         = useState(false);

  const handleSelectConcept = async (concept: ReelsConcept, idx: number) => {
    if (points < POINT_COSTS.REELS_SCRIPT) {
      setPaywallConcept(concept);
      setShowPaywall(true);
      return;
    }

    // 같은 카드 다시 클릭 → 닫기
    if (selectedIdx === idx && script) {
      setSelectedIdx(null);
      setScript(null);
      return;
    }

    setSelectedIdx(idx);
    setScript(null);
    setError(null);
    setLoadingIdx(idx);

    try {
      const { script: result, remainingPoints } = await generateReelsScript(
        concept, guide, imageUrls, platform
      );
      setScript(result);
      onPointsChange(remainingPoints);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_POINTS") {
        setPaywallConcept(concept);
        setShowPaywall(true);
        setSelectedIdx(null);
      } else {
        setError(e instanceof Error ? e.message : "대본 생성 실패. 다시 시도해주세요.");
      }
    } finally {
      setLoadingIdx(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* 헤더 */}
      <div className="text-center py-1">
        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">AI 추천 콘셉트</p>
        <p className="text-sm text-gray-500">
          마음에 드는 콘셉트를 선택하면 상세 대본을 드려요
          <span className="ml-1 text-xs text-purple-500 font-semibold">({POINT_COSTS.REELS_SCRIPT}P)</span>
        </p>
      </div>

      {/* 콘셉트 카드 3개 */}
      {concepts.map((concept, idx) => {
        const style     = CONCEPT_STYLES[concept.type];
        const isSelected = selectedIdx === idx;
        const isLoading  = loadingIdx === idx;
        const canAfford  = points >= POINT_COSTS.REELS_SCRIPT;

        return (
          <div key={idx}
            className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden bg-white
              ${isSelected ? "border-purple-400 shadow-md" : style.border}`}>

            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{style.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mb-2 ${style.badge}`}>
                    {concept.type}
                  </span>
                  <p className="text-sm font-bold text-gray-900 leading-snug">{concept.title}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{concept.description}</p>
                  <p className="text-xs text-gray-400 mt-2">🎵 {concept.bgm}</p>
                </div>

                <button
                  onClick={() => handleSelectConcept(concept, idx)}
                  disabled={isLoading}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap
                    ${isSelected
                      ? "bg-purple-600 text-white"
                      : canAfford
                        ? "bg-purple-50 border border-purple-300 text-purple-700 hover:bg-purple-100"
                        : "bg-gray-50 border border-gray-200 text-gray-400"}`}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  ) : isSelected ? "닫기" : canAfford ? "선택" : (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      P 부족
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 상세 대본 (선택 후 확장) */}
            {isSelected && script && (
              <div className="border-t border-purple-200 bg-white px-5 py-5 space-y-5">
                <Section label="🎬 오프닝 훅 (첫 3초)">
                  <div className="bg-purple-50 rounded-xl px-4 py-3">
                    <p className="text-sm font-semibold text-gray-800">{script.hook}</p>
                  </div>
                </Section>

                <Section label="🎥 장면별 대본">
                  <div className="space-y-2">
                    {script.scenes.map((scene, i) => (
                      <div key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <p className="leading-relaxed">{scene}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section label="✂️ 편집 포인트">
                  <ul className="space-y-1.5">
                    {script.editingPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-purple-400 mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section label="😂 밈 자막">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-800">
                    "{script.memeCaption}"
                  </div>
                </Section>

                <Section label="📣 마무리 CTA">
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3">{script.cta}</p>
                </Section>

                <button
                  onClick={() => {
                    const text = [
                      `[${concept.type}] ${concept.title}`,
                      `BGM: ${concept.bgm}`, "",
                      `🎬 오프닝: ${script.hook}`, "",
                      `🎥 대본:\n${script.scenes.join("\n")}`, "",
                      `✂️ 편집:\n${script.editingPoints.join("\n")}`, "",
                      `😂 밈 자막: "${script.memeCaption}"`, "",
                      `📣 CTA: ${script.cta}`,
                    ].join("\n");
                    navigator.clipboard.writeText(text);
                  }}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors"
                >
                  대본 전체 복사
                </button>

                {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              </div>
            )}

            {isLoading && (
              <div className="border-t border-purple-100 bg-white px-5 py-5 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-purple-600 font-medium">AI가 대본을 작성하고 있어요...</p>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={onReset} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
        새 콘셉트 분석하기
      </button>

      {/* 포인트 부족 모달 */}
      {showPaywall && paywallConcept && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPaywall(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
            </div>

            <h3 className="text-lg font-black text-gray-900 text-center mb-1">포인트가 부족해요</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              <span className="font-semibold text-gray-700">"{paywallConcept.title}"</span>
            </p>
            <p className="text-sm text-gray-500 text-center mb-5">
              상세 대본 열람에 <span className="font-bold text-purple-600">{POINT_COSTS.REELS_SCRIPT}P</span>가 필요해요.<br />
              현재 잔액: <span className="font-bold text-red-500">{points.toLocaleString()}P</span>
            </p>

            <div className="bg-orange-50 rounded-2xl p-4 mb-5 space-y-1.5">
              <p className="text-xs font-bold text-orange-700 mb-2">포인트로 이용 가능한 서비스</p>
              {[
                `네이버/트위터 콘텐츠 생성 — 100P`,
                `릴스/틱톡 상세 대본 — 300P`,
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-orange-400 text-sm">⭐</span>
                  <p className="text-xs text-gray-700">{item}</p>
                </div>
              ))}
            </div>

            {/* 오늘의 무료 광고 혜택 */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-3">
              <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider mb-2">🎁 오늘의 무료 혜택</p>
              <button
                onClick={() => { setShowPaywall(false); setShowAdModal(true); }}
                disabled={!adAvailable}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2
                  ${adAvailable
                    ? "bg-green-500 hover:bg-green-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                <span>📺</span>
                {adAvailable ? "15초 광고 보고 100P 충전하기 (오늘 0/1)" : "오늘 이미 받으셨어요 (오늘 1/1)"}
              </button>
            </div>

            <button
              onClick={() => {
                window.location.href = "mailto:whdcks2159@naver.com?subject=AutoBlog 포인트 충전 문의";
              }}
              className="w-full py-3 rounded-2xl border border-orange-200 text-orange-600 text-sm font-bold hover:bg-orange-50 transition-colors"
            >
              포인트 충전하러 가기
            </button>
            <button onClick={() => setShowPaywall(false)}
              className="w-full py-2 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 광고 모달 */}
      {showAdModal && (
        <AdModal
          onSuccess={(newPoints) => {
            setAdAvailable(false);
            setShowAdModal(false);
            setShowToast(true);
            onPointsChange(newPoints);
            onAdClaimed(newPoints);
          }}
          onClose={() => setShowAdModal(false)}
        />
      )}

      {/* 충전 완료 토스트 */}
      <Toast
        message="포인트가 충전되었습니다! 바로 블로그 포스팅을 시작해보세요."
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}
