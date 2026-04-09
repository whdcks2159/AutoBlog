"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { generateBlog, generateTweet, generateReelsConcepts, TweetResult, ReelsConcept } from "./actions";
import { postTweet } from "./twitterActions";
import ReelsSection from "./ReelsSection";
import AdModal from "./AdModal";
import Toast from "./Toast";
import { POINT_COSTS } from "@/lib/points";

/* ── 타입 ── */
interface PreviewFile {
  id: string;
  file: File;
  url: string;
  progress: number;
}

interface BlogResult {
  title: string;
  content: string;
  tags: string[];
}

type Platform     = "naver" | "twitter" | "instagram" | "tiktok";
type PipelineStep = "idle" | "uploading" | "analyzing" | "writing" | "posting" | "done" | "error";

/* ── 상수 ── */
const MAX_FILES   = 5;
const MAX_SIZE_MB = 20;
const MAX_SIZE_B  = MAX_SIZE_MB * 1024 * 1024;

const STEPS: Record<Platform, { key: PipelineStep; label: string }[]> = {
  naver: [
    { key: "uploading", label: "이미지 업로드 중" },
    { key: "analyzing", label: "AI 이미지 분석 중" },
    { key: "writing",   label: "블로그 본문 생성 중" },
  ],
  twitter: [
    { key: "uploading", label: "이미지 업로드 중" },
    { key: "analyzing", label: "AI 이미지 분석 중" },
    { key: "writing",   label: "트윗 생성 중" },
    { key: "posting",   label: "트위터에 게시 중" },
  ],
  instagram: [
    { key: "uploading", label: "이미지 업로드 중" },
    { key: "analyzing", label: "AI 이미지 분석 중" },
    { key: "writing",   label: "릴스 콘셉트 생성 중" },
  ],
  tiktok: [
    { key: "uploading", label: "이미지 업로드 중" },
    { key: "analyzing", label: "AI 이미지 분석 중" },
    { key: "writing",   label: "틱톡 콘셉트 생성 중" },
  ],
};

/* ── 이미지 유틸 ── */
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg", 0.8
      );
    };
    img.onerror = () => resolve(file);
    img.src = blobUrl;
  });
}

async function uploadToStorage(file: File): Promise<string> {
  const path = `blog-images/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("autoblog")
    .upload(path, file, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`스토리지 업로드 실패: ${error.message}`);
  const { data } = supabase.storage.from("autoblog").getPublicUrl(path);
  return data.publicUrl;
}

/* ── 컴포넌트 ── */
interface UploadAreaProps {
  provider: string;
  initialPoints: number;
  adAvailableToday: boolean;
}

export default function UploadArea({ provider, initialPoints, adAvailableToday }: UploadAreaProps) {
  const defaultPlatform: Platform = provider === "twitter" ? "twitter" : "naver";

  const [platform, setPlatform]       = useState<Platform>(defaultPlatform);
  const [points, setPoints]           = useState(initialPoints);
  const [adAvailable, setAdAvailable] = useState(adAvailableToday);
  const [files, setFiles]             = useState<PreviewFile[]>([]);
  const [guide, setGuide]             = useState("");
  const [isDragging, setIsDragging]   = useState(false);
  const [step, setStep]               = useState<PipelineStep>("idle");
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [showToast, setShowToast]     = useState(false);

  // 결과
  const [blogResult, setBlogResult]     = useState<BlogResult | null>(null);
  const [tweetResult, setTweetResult]   = useState<TweetResult | null>(null);
  const [resultUrl, setResultUrl]       = useState<string | null>(null);
  const [reelsConcepts, setReelsConcepts] = useState<[ReelsConcept, ReelsConcept, ReelsConcept] | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── 포인트 비용 계산 ── */
  const currentCost = (platform === "naver" || platform === "twitter")
    ? POINT_COSTS.BASIC_GENERATE
    : 0; // 릴스 콘셉트 자체는 무료, 대본 선택 시 차감

  /* ── 플랫폼 전환 ── */
  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    setBlogResult(null); setTweetResult(null); setResultUrl(null); setReelsConcepts(null);
    setStep("idle"); setErrorMsg(null);
  };

  /* ── 파일 처리 ── */
  const processFiles = useCallback((newFiles: File[]) => {
    const images    = newFiles.filter((f) => f.type.startsWith("image/"));
    const oversized = images.filter((f) => f.size > MAX_SIZE_B);
    if (oversized.length > 0) {
      setErrorMsg(`파일 크기는 ${MAX_SIZE_MB}MB 이하만 가능해요.`);
      setStep("error");
    }
    const valid = images.filter((f) => f.size <= MAX_SIZE_B);
    if (valid.length === 0) return;

    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        setErrorMsg(`사진은 최대 ${MAX_FILES}장까지 업로드할 수 있어요.`);
        setStep("error");
        return prev;
      }
      const toAdd = valid.slice(0, remaining);
      if (valid.length > remaining) {
        setErrorMsg(`최대 ${MAX_FILES}장까지만 가능해서 ${remaining}장만 추가됐어요.`);
        setStep("error");
      }
      const previews: PreviewFile[] = toAdd.map((file) => ({
        id: crypto.randomUUID(), file, url: URL.createObjectURL(file), progress: 0,
      }));
      previews.forEach((p) => {
        let v = 0;
        const iv = setInterval(() => {
          v += Math.random() * 25;
          if (v >= 100) { v = 100; clearInterval(iv); }
          setFiles((cur) => cur.map((f) => f.id === p.id ? { ...f, progress: v } : f));
        }, 120);
      });
      return [...prev, ...previews];
    });
    setBlogResult(null); setTweetResult(null); setResultUrl(null); setReelsConcepts(null); setStep("idle");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const t = prev.find((f) => f.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((f) => f.id !== id);
    });
    setStep("idle");
  };

  /* ── 파이프라인 ── */
  const runPipeline = async () => {
    const imageFiles = files.filter((f) => f.file.type.startsWith("image/"));
    if (imageFiles.length === 0) { setErrorMsg("이미지 파일이 필요합니다."); setStep("error"); return; }

    // Basic 플랫폼 포인트 사전 체크 (UX용 — 실제 검증은 서버에서)
    if ((platform === "naver" || platform === "twitter") && points < POINT_COSTS.BASIC_GENERATE) {
      setShowPointsModal(true);
      return;
    }

    setErrorMsg(null); setBlogResult(null); setTweetResult(null); setResultUrl(null); setReelsConcepts(null);

    try {
      // ① 업로드
      setStep("uploading");
      const imageUrls: string[] = [];
      for (const pf of imageFiles) {
        const compressed = await compressImage(pf.file);
        imageUrls.push(await uploadToStorage(compressed));
      }
      setUploadedUrls(imageUrls);

      setStep("analyzing");

      if (platform === "naver") {
        const { blog, remainingPoints } = await generateBlog(guide, imageUrls);
        setPoints(remainingPoints);
        setStep("writing");
        await new Promise((r) => setTimeout(r, 400));
        setBlogResult(blog);

      } else if (platform === "twitter") {
        const { tweet, remainingPoints } = await generateTweet(guide, imageUrls);
        setPoints(remainingPoints);
        setStep("writing");
        await new Promise((r) => setTimeout(r, 400));
        setTweetResult(tweet);
        setStep("posting");
        const postRes = await postTweet(tweet.text);
        if (!postRes.success) throw new Error(postRes.error ?? "게시 실패");
        setResultUrl(postRes.tweetUrl ?? "https://twitter.com");

      } else {
        setStep("writing");
        const { concepts } = await generateReelsConcepts(guide, imageUrls, platform);
        setReelsConcepts(concepts);
      }

      setStep("done");
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_POINTS") {
        setShowPointsModal(true);
        setStep("idle");
      } else {
        setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
        setStep("error");
      }
    }
  };

  const reset = () => {
    setFiles([]); setGuide(""); setBlogResult(null); setTweetResult(null);
    setResultUrl(null); setReelsConcepts(null); setUploadedUrls([]);
    setStep("idle"); setErrorMsg(null);
  };

  const allUploaded = files.length > 0 && files.every((f) => f.progress >= 100);
  const isRunning   = ["uploading", "analyzing", "writing", "posting"].includes(step);
  const currentIdx  = STEPS[platform].findIndex((s) => s.key === step);
  const isNaverLinked   = provider === "naver";
  const isTwitterLinked = provider === "twitter";

  /* ── 버튼 상태 ── */
  const notLinked = (platform === "naver" && !isNaverLinked) || (platform === "twitter" && !isTwitterLinked);
  const btnDisabled = !allUploaded || isRunning || step === "done" || notLinked;

  const btnBg = () => {
    if (btnDisabled) return "bg-gray-200 text-gray-400 cursor-not-allowed";
    if (platform === "naver")   return "bg-[#03C75A] hover:bg-[#02b350] text-white shadow-md";
    if (platform === "twitter") return "bg-black hover:bg-gray-900 text-white shadow-md";
    return "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md shadow-purple-200";
  };

  const btnText = () => {
    if (isRunning)  return null;
    if (step === "done") return "✅ 완료됐어요!";
    if (notLinked) return `${platform === "naver" ? "네이버" : "트위터"} 로그인 후 사용 가능`;
    if (files.length === 0) return "파일을 먼저 업로드해주세요";
    if (!allUploaded) return "준비 중...";
    const cost = currentCost > 0 ? ` (${currentCost}P)` : "";
    if (platform === "naver")     return `블로그 글 생성하기${cost}`;
    if (platform === "twitter")   return `트윗 생성 및 게시${cost}`;
    if (platform === "instagram") return "릴스 콘셉트 3가지 분석 (무료)";
    return "틱톡 콘셉트 3가지 분석 (무료)";
  };

  return (
    <div className="space-y-6">

      {/* 포인트 잔액 표시 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">내 포인트</p>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
          ${points < 100 ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          <span>⭐</span>
          <span>{points.toLocaleString()} P</span>
        </div>
      </div>

      {/* 플랫폼 탭 */}
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1.5">Basic — 100P</p>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            {(["naver", "twitter"] as Platform[]).map((p) => (
              <button key={p} onClick={() => handlePlatformChange(p)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all
                  ${platform === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {p === "naver" ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                )}
                {p === "naver" ? "네이버 블로그" : "트위터 (X)"}
                {((p === "naver" && !isNaverLinked) || (p === "twitter" && !isTwitterLinked)) && (
                  <span className="text-[9px] bg-gray-200 text-gray-500 px-1 py-0.5 rounded-full">연동 필요</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider px-1 mb-1.5">
            Premium — 대본 선택 300P
          </p>
          <div className="flex gap-2 p-1 bg-purple-50 rounded-xl border border-purple-100">
            {(["instagram", "tiktok"] as Platform[]).map((p) => (
              <button key={p} onClick={() => handlePlatformChange(p)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all
                  ${platform === p ? "bg-white shadow-sm text-purple-700" : "text-purple-400 hover:text-purple-600"}`}>
                <span>{p === "instagram" ? "📸" : "🎵"}</span>
                {p === "instagram" ? "인스타그램" : "틱톡"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 비연동 안내 */}
      {notLinked && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 text-sm text-amber-700 text-center">
          {platform === "naver" ? "네이버" : "트위터"} 계정으로 로그인하면 사용할 수 있어요.
        </div>
      )}

      {/* 드래그 앤 드롭 */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isRunning && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all
          ${isRunning ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          ${isDragging ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50/50"}`}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files) processFiles(Array.from(e.target.files)); }} />
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">사진을 드래그하거나 클릭하여 업로드</p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG · 최대 {MAX_FILES}장 · 장당 {MAX_SIZE_MB}MB 이하</p>
          </div>
        </div>
      </div>

      {/* 미리보기 */}
      {files.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2 text-right">{files.length} / {MAX_FILES}장</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {files.map((f) => (
              <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                <img src={f.url} alt={f.file.name} className="w-full h-32 object-cover" />
                {f.progress < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200">
                    <div className="h-full bg-green-500 transition-all duration-150" style={{ width: `${f.progress}%` }} />
                  </div>
                )}
                {f.progress >= 100 && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">준비</div>
                )}
                {!isRunning && (
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <p className="text-xs text-gray-500 truncate px-2 py-1.5">{f.file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 가이드 입력 */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          가이드 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <textarea value={guide} onChange={(e) => setGuide(e.target.value)} disabled={isRunning}
          placeholder={
            platform === "naver"   ? "꼭 들어갔으면 하는 내용이나 상황을 알려주세요" :
            platform === "twitter" ? "트윗에 담고 싶은 핵심 메시지를 알려주세요" :
            "영상 분위기나 강조할 내용을 알려주세요"
          }
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none transition disabled:opacity-50" />
        <p className="text-xs text-gray-400 text-right">{guide.length}자</p>
      </div>

      {/* 실행 버튼 */}
      <button onClick={runPipeline} disabled={btnDisabled}
        className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${btnBg()}`}>
        {isRunning
          ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />처리 중...</>
          : btnText()}
      </button>

      {/* 파이프라인 진행 */}
      {isRunning && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6 space-y-4">
          {STEPS[platform].map((s, i) => {
            const isDone    = currentIdx > i;
            const isCurrent = currentIdx === i;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all
                  ${isDone ? "bg-green-500 text-white" : isCurrent ? "bg-white border-2 border-green-500" : "bg-gray-200 text-gray-400"}`}>
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  ) : i + 1}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? "text-green-700" : isDone ? "text-green-600" : "text-gray-400"}`}>
                  {s.label}{isCurrent && <span className="ml-1 animate-pulse">...</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 에러 */}
      {step === "error" && errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-600">오류가 발생했어요</p>
          <p className="text-xs text-red-500">{errorMsg}</p>
          <button onClick={() => setStep("idle")} className="text-xs text-red-400 underline">다시 시도</button>
        </div>
      )}

      {/* 결과: 네이버 */}
      {step === "done" && blogResult && platform === "naver" && (
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="bg-[#03C75A] px-6 py-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-100 text-xs font-medium">블로그 글 생성 완료</p>
            </div>
            <h3 className="text-white font-bold text-lg leading-snug">{blogResult.title}</h3>
          </div>

          {/* 태그 */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            {blogResult.tags.map((tag) => (
              <span key={tag} className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>

          {/* 사용 방법 안내 */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-2">📋 네이버 블로그에 올리는 방법</p>
            <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
              <li>아래 <span className="font-bold">전체 복사</span> 버튼 클릭</li>
              <li>네이버 블로그 → 글쓰기 → 붙여넣기</li>
              <li>사진 첨부 후 발행!</li>
            </ol>
          </div>

          {/* 본문 미리보기 */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 mb-3">생성된 본문 미리보기</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {blogResult.content}
            </div>
          </div>

          {/* 버튼 */}
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(blogResult.content)}
                className="flex-1 py-2.5 rounded-xl border border-green-500 text-green-600 text-sm font-semibold hover:bg-green-50 transition-colors">
                본문만 복사
              </button>
              <button onClick={() => navigator.clipboard.writeText(`제목: ${blogResult.title}\n\n${blogResult.content}\n\n태그: ${blogResult.tags.map((t) => `#${t}`).join(" ")}`)}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm">
                전체 복사
              </button>
            </div>
            <a href="https://blog.naver.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#03C75A] hover:bg-[#02b350] text-white font-bold text-sm transition-colors shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버 블로그 글쓰기 바로가기
            </a>
            <button onClick={reset} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">새 글 만들기</button>
          </div>
        </div>
      )}

      {/* 결과: 트위터 */}
      {step === "done" && tweetResult && platform === "twitter" && (
        <div className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          <div className="bg-black px-6 py-5 flex items-center gap-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-gray-300 text-xs font-medium">트위터 게시 완료</p>
          </div>
          <div className="px-6 py-5">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-300" />
                <div>
                  <p className="text-sm font-bold text-gray-900">내 계정</p>
                  <p className="text-xs text-gray-500">@username</p>
                </div>
                <svg className="w-5 h-5 text-black ml-auto" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{tweetResult.text}</p>
              <p className="text-xs text-gray-400 mt-3 text-right">{tweetResult.text.length} / 280자</p>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <button onClick={() => navigator.clipboard.writeText(tweetResult.text)}
              className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
              트윗 복사
            </button>
            <a href={resultUrl ?? "https://twitter.com"} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-black hover:bg-gray-900 text-white font-bold text-sm transition-colors shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              트위터에서 확인하기
            </a>
            <button onClick={reset} className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">새 글 만들기</button>
          </div>
        </div>
      )}

      {/* 결과: 릴스 콘셉트 */}
      {step === "done" && reelsConcepts && (platform === "instagram" || platform === "tiktok") && (
        <ReelsSection
          concepts={reelsConcepts}
          guide={guide}
          imageUrls={uploadedUrls}
          platform={platform}
          points={points}
          onPointsChange={setPoints}
          adAvailable={adAvailable}
          onAdClaimed={(newPoints) => { setPoints(newPoints); setAdAvailable(false); setShowToast(true); }}
          onReset={reset}
        />
      )}

      {/* 포인트 부족 모달 */}
      {showPointsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPointsModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-1">포인트가 부족해요</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              현재 잔액: <span className="font-bold text-red-500">{points.toLocaleString()}P</span>
              {"  "}|{"  "}필요: <span className="font-bold text-gray-700">{currentCost}P</span>
            </p>

            {/* 오늘의 무료 광고 혜택 */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-3">
              <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider mb-2">🎁 오늘의 무료 혜택</p>
              <button
                onClick={() => { setShowPointsModal(false); setShowAdModal(true); }}
                disabled={!adAvailable}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                  ${adAvailable
                    ? "bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
              >
                <span>📺</span>
                {adAvailable
                  ? "15초 광고 보고 100P 충전하기 (오늘 0/1)"
                  : "오늘 이미 받으셨어요 (오늘 1/1)"}
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
            <button onClick={() => setShowPointsModal(false)}
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
            setPoints(newPoints);
            setAdAvailable(false);
            setShowAdModal(false);
            setShowToast(true);
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
