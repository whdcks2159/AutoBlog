"use client";

import { useState, useRef, useCallback } from "react";
import { generateBlog } from "./actions";
import { postToNaverBlog } from "./blogActions";

interface PreviewFile {
  id: string;
  file: File;
  url: string;
  type: "image" | "video";
  progress: number;
}

interface BlogResult {
  title: string;
  content: string;
  tags: string[];
}

type PipelineStep = "idle" | "analyzing" | "writing" | "posting" | "done" | "error";

const STEPS = [
  { key: "analyzing", label: "AI 이미지 분석 중" },
  { key: "writing",   label: "블로그 본문 생성 중" },
  { key: "posting",   label: "네이버 블로그 전송 중" },
  { key: "done",      label: "완료" },
] as const;

export default function UploadArea() {
  const [files, setFiles]           = useState<PreviewFile[]>([]);
  const [guide, setGuide]           = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [step, setStep]             = useState<PipelineStep>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [result, setResult]         = useState<BlogResult | null>(null);
  const [blogUrl, setBlogUrl]       = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── 파일 처리 ── */
  const processFiles = useCallback((newFiles: File[]) => {
    const accepted = newFiles.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    const previews: PreviewFile[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" : "video",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...previews]);
    setResult(null);
    setBlogUrl(null);
    setStep("idle");

    previews.forEach((preview) => {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 100) { p = 100; clearInterval(interval); }
        setFiles((prev) =>
          prev.map((f) => (f.id === preview.id ? { ...f, progress: p } : f))
        );
      }, 150);
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const t = prev.find((f) => f.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((f) => f.id !== id);
    });
    setResult(null);
    setBlogUrl(null);
    setStep("idle");
  };

  /* ── 파이프라인 ── */
  const runPipeline = async () => {
    const imageFiles = files.filter((f) => f.type === "image");
    if (imageFiles.length === 0) {
      setErrorMsg("이미지 파일이 필요합니다.");
      setStep("error");
      return;
    }

    setErrorMsg(null);
    setResult(null);
    setBlogUrl(null);

    try {
      // Step 1 & 2: Gemini 분석 + 본문 생성
      setStep("analyzing");
      const genForm = new FormData();
      genForm.append("guide", guide);
      imageFiles.forEach((f) => genForm.append("images", f.file));
      const blogData = await generateBlog(genForm);
      setStep("writing");
      // writing 단계는 generateBlog 내부에서 동시 처리되므로 잠시 대기 후 result 저장
      await new Promise((r) => setTimeout(r, 600));
      setResult(blogData);

      // Step 3: 네이버 블로그 전송
      setStep("posting");
      const postForm = new FormData();
      postForm.append("title", blogData.title);
      postForm.append("content", blogData.content);
      imageFiles.forEach((f) => postForm.append("images", f.file));
      const postRes = await postToNaverBlog(postForm);

      if (!postRes.success) throw new Error(postRes.error ?? "전송 실패");

      setBlogUrl(postRes.blogUrl ?? "https://blog.naver.com");
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      setStep("error");
    }
  };

  const allUploaded = files.length > 0 && files.every((f) => f.progress >= 100);
  const isRunning   = step === "analyzing" || step === "writing" || step === "posting";
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">

      {/* 드래그 앤 드롭 */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isRunning && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center transition-all
          ${isRunning ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          ${isDragging
            ? "border-green-500 bg-green-50"
            : "border-gray-200 bg-gray-50 hover:border-green-400 hover:bg-green-50/50"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => { if (e.target.files) processFiles(Array.from(e.target.files)); }}
        />
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">
              사진 / 동영상을 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG, MP4 등 여러 파일 동시 업로드 가능</p>
          </div>
        </div>
      </div>

      {/* 미리보기 */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {files.map((f) => (
            <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
              {f.type === "image"
                ? <img src={f.url} alt={f.file.name} className="w-full h-32 object-cover" />
                : <video src={f.url} className="w-full h-32 object-cover" muted />
              }
              {f.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200">
                  <div className="h-full bg-green-500 transition-all duration-150" style={{ width: `${f.progress}%` }} />
                </div>
              )}
              {f.progress >= 100 && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">완료</div>
              )}
              {!isRunning && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <p className="text-xs text-gray-500 truncate px-2 py-1.5">{f.file.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* 가이드 입력 */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          블로그 가이드 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          disabled={isRunning}
          placeholder="이 게시글에 꼭 들어갔으면 하는 내용이나 상황을 알려주세요"
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none transition disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 text-right">{guide.length}자</p>
      </div>

      {/* 파이프라인 버튼 */}
      <button
        onClick={runPipeline}
        disabled={!allUploaded || isRunning || step === "done"}
        className={`
          w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2
          ${allUploaded && !isRunning && step !== "done"
            ? "bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        {isRunning ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            처리 중...
          </>
        ) : step === "done" ? (
          "✅ 완료됐어요!"
        ) : files.length === 0 ? (
          "파일을 먼저 업로드해주세요"
        ) : !allUploaded ? (
          "업로드 중..."
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
            </svg>
            자동 생성 및 임시저장
          </>
        )}
      </button>

      {/* 파이프라인 진행 상태 */}
      {isRunning && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6 space-y-4">
          {STEPS.filter((s) => s.key !== "done").map((s, i) => {
            const isDone    = currentStepIndex > i;
            const isCurrent = currentStepIndex === i;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all
                  ${isDone    ? "bg-green-500 text-white"
                  : isCurrent ? "bg-white border-2 border-green-500 text-green-600"
                  :             "bg-gray-200 text-gray-400"}
                `}>
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-sm font-medium ${isCurrent ? "text-green-700" : isDone ? "text-green-600" : "text-gray-400"}`}>
                  {s.label}
                  {isCurrent && <span className="ml-1 animate-pulse">...</span>}
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
          <button
            onClick={() => setStep("idle")}
            className="text-xs text-red-400 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 완료 결과 */}
      {step === "done" && result && (
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          {/* 성공 배너 */}
          <div className="bg-green-500 px-6 py-5">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-100 text-xs font-medium">네이버 블로그 임시저장 완료</p>
            </div>
            <h3 className="text-white font-bold text-lg leading-snug">{result.title}</h3>
          </div>

          {/* 태그 */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            {result.tags.map((tag) => (
              <span key={tag} className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full">
                #{tag}
              </span>
            ))}
          </div>

          {/* 본문 미리보기 */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 mb-3">생성된 본문 미리보기</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {result.content}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="px-6 pb-6 space-y-3">
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(result.content)}
                className="flex-1 py-2.5 rounded-xl border border-green-500 text-green-600 text-sm font-semibold hover:bg-green-50 transition-colors"
              >
                본문 복사
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(
                  `제목: ${result.title}\n\n${result.content}\n\n태그: ${result.tags.map((t) => `#${t}`).join(" ")}`
                )}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm"
              >
                전체 복사
              </button>
            </div>
            <a
              href={blogUrl ?? "https://blog.naver.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#03C75A] hover:bg-[#02b350] text-white font-bold text-sm transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버 블로그에서 확인하기
            </a>
            <button
              onClick={() => {
                setFiles([]);
                setGuide("");
                setResult(null);
                setBlogUrl(null);
                setStep("idle");
              }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              새 글 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
