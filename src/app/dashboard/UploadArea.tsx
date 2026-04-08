"use client";

import { useState, useRef, useCallback } from "react";

interface PreviewFile {
  id: string;
  file: File;
  url: string;
  type: "image" | "video";
  progress: number;
}

export default function UploadArea() {
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [guide, setGuide] = useState("");
  const [isDragging, setIsDragging] = useState(false);
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

    // 업로드 진행 시뮬레이션
    previews.forEach((preview) => {
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 20;
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

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });
  };

  const allDone = files.length > 0 && files.every((f) => f.progress >= 100);

  return (
    <div className="space-y-6">
      {/* 드래그 앤 드롭 영역 */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
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

              {/* 진행바 */}
              {f.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200">
                  <div
                    className="h-full bg-green-500 transition-all duration-150"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              )}

              {/* 완료 뱃지 */}
              {f.progress >= 100 && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  완료
                </div>
              )}

              {/* 삭제 버튼 */}
              <button
                onClick={() => removeFile(f.id)}
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

      {/* 제출 버튼 */}
      <button
        disabled={!allDone}
        className={`
          w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all
          ${allDone
            ? "bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }
        `}
      >
        {files.length === 0
          ? "파일을 먼저 업로드해주세요"
          : allDone
          ? "AI 블로그 글 생성하기"
          : "업로드 중..."}
      </button>
    </div>
  );
}
