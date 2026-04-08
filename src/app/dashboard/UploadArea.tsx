"use client";

import { useState, useRef, useCallback, useTransition } from "react";
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

export default function UploadArea() {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [guide, setGuide] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<BlogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPosting, startPosting] = useTransition();
  const [postResult, setPostResult] = useState<{ success: boolean; blogUrl?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    previews.forEach((preview) => {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 25;
        if (p >= 100) {
          p = 100;
          clearInterval(interval);
        }
        setFiles((prev) =>
          prev.map((f) => (f.id === preview.id ? { ...f, progress: p } : f))
        );
      }, 150);
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });
    setResult(null);
  };

  const handleGenerate = () => {
    setError(null);
    const imageFiles = files.filter((f) => f.type === "image");
    if (imageFiles.length === 0) {
      setError("이미지 파일이 필요합니다.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("guide", guide);
      imageFiles.forEach((f) => formData.append("images", f.file));

      try {
        const data = await generateBlog(formData);
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  };

  const allDone = files.length > 0 && files.every((f) => f.progress >= 100);

  return (
    <div className="space-y-6">
      {/* 드래그 앤 드롭 영역 */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
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
          onChange={onInputChange}
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
              사진 / 동영상을 여기에 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-400 mt-1">JPG, PNG, MP4 등 여러 파일 동시 업로드 가능</p>
          </div>
        </div>
      </div>

      {/* 미리보기 + 진행바 */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {files.map((f) => (
            <div key={f.id} className="relative rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
              {f.type === "image" ? (
                <img src={f.url} alt={f.file.name} className="w-full h-32 object-cover" />
              ) : (
                <video src={f.url} className="w-full h-32 object-cover" muted />
              )}
              {f.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200">
                  <div
                    className="h-full bg-green-500 transition-all duration-150"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              )}
              {f.progress >= 100 && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  완료
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-xs text-gray-500 truncate px-2 py-1.5">{f.file.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* 가이드 입력창 */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          블로그 가이드 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          placeholder="이 게시글에 꼭 들어갔으면 하는 내용이나 상황을 알려주세요"
          rows={4}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none transition"
        />
        <p className="text-xs text-gray-400 text-right">{guide.length}자</p>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        onClick={handleGenerate}
        disabled={!allDone || isPending}
        className={`
          w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all
          ${allDone && !isPending
            ? "bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        {isPending
          ? "AI가 글을 작성 중이에요..."
          : files.length === 0
          ? "파일을 먼저 업로드해주세요"
          : allDone
          ? "AI 블로그 글 생성하기"
          : "업로드 중..."}
      </button>

      {/* AI 생성 결과 */}
      {isPending && (
        <div className="rounded-2xl border border-green-100 bg-green-50 p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-green-700 font-medium">이미지를 분석하고 블로그 글을 작성하고 있어요</p>
          <p className="text-xs text-green-500">보통 10~30초 정도 걸려요</p>
        </div>
      )}

      {result && !isPending && (
        <div className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="bg-green-500 px-6 py-4">
            <p className="text-xs text-green-100 font-medium mb-1">생성된 블로그 제목</p>
            <h3 className="text-white font-bold text-lg leading-snug">{result.title}</h3>
          </div>

          {/* 태그 */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
            {result.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* 본문 */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-400 mb-3">생성된 본문</p>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {result.content}
            </div>
          </div>

          {/* 복사 버튼 */}
          <div className="px-6 pb-4 flex gap-3">
            <button
              onClick={() => navigator.clipboard.writeText(result.content)}
              className="flex-1 py-2.5 rounded-xl border border-green-500 text-green-600 text-sm font-semibold hover:bg-green-50 transition-colors"
            >
              본문 복사
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `제목: ${result.title}\n\n${result.content}\n\n태그: ${result.tags.map((t) => `#${t}`).join(" ")}`
                )
              }
              className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm"
            >
              전체 복사
            </button>
          </div>

          {/* 네이버 블로그 전송 */}
          <div className="px-6 pb-5">
            {!postResult ? (
              <button
                onClick={() => {
                  setPostResult(null);
                  startPosting(async () => {
                    const formData = new FormData();
                    formData.append("title", result.title);
                    formData.append("content", result.content);
                    files
                      .filter((f) => f.type === "image")
                      .forEach((f) => formData.append("images", f.file));
                    const res = await postToNaverBlog(formData);
                    setPostResult(res);
                  });
                }}
                disabled={isPosting}
                className="w-full py-3 rounded-xl bg-[#03C75A] hover:bg-[#02b350] disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isPosting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    네이버 블로그에 전송 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
                    </svg>
                    네이버 블로그 임시저장함에 올리기
                  </>
                )}
              </button>
            ) : postResult.success ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center space-y-3">
                <p className="text-green-700 font-semibold text-sm">임시저장함에 저장됐어요!</p>
                <p className="text-green-600 text-xs">네이버 블로그 글쓰기 → 임시저장에서 확인하세요.</p>
                <a
                  href="https://blog.naver.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full py-2.5 rounded-xl bg-[#03C75A] text-white text-sm font-semibold hover:bg-[#02b350] transition-colors"
                >
                  네이버 블로그에서 확인하기
                </a>
              </div>
            ) : (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-2">
                <p className="text-red-600 text-sm font-semibold">전송 실패</p>
                <p className="text-red-500 text-xs">{postResult.error}</p>
                <button
                  onClick={() => setPostResult(null)}
                  className="text-xs text-red-400 underline"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
