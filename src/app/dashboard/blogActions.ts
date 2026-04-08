"use server";

import { auth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";

interface PostResult {
  success: boolean;
  blogUrl?: string;
  error?: string;
}

/** 마크다운 → 네이버 블로그용 HTML 변환 */
function markdownToHtml(markdown: string, imageUrls: string[]): string {
  let html = markdown
    // H2 제목
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    // H3 제목
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    // 굵게
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 빈 줄 → 문단 구분
    .replace(/\n\n/g, "</p><p>")
    // 줄바꿈
    .replace(/\n/g, "<br>");

  html = `<p>${html}</p>`;

  // 이미지 삽입: 서론 뒤에 전체 이미지 블록 추가
  if (imageUrls.length > 0) {
    const imgBlock = imageUrls
      .map(
        (url) =>
          `<p><img src="${url}" style="max-width:100%;border-radius:8px;margin:8px 0;" /></p>`
      )
      .join("\n");
    // 첫 번째 </p> 뒤에 이미지 삽입
    html = html.replace("</p>", `</p>${imgBlock}`);
  }

  return html;
}

/** Supabase Storage에 이미지 업로드 후 공개 URL 반환 */
async function uploadImagesToStorage(files: File[]): Promise<string[]> {
  const supabase = createServiceClient();
  const urls: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `blog-images/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("autoblog")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);

    const { data } = supabase.storage.from("autoblog").getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function postToNaverBlog(formData: FormData): Promise<PostResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "로그인이 필요합니다." };

  const accessToken = session.naverAccessToken;
  if (!accessToken)
    return {
      success: false,
      error: "네이버 액세스 토큰이 없습니다. 다시 로그인해주세요.",
    };

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const imageFiles = formData.getAll("images") as File[];

  try {
    // 1. 이미지를 Supabase Storage에 업로드
    const imageUrls =
      imageFiles.length > 0 ? await uploadImagesToStorage(imageFiles) : [];

    // 2. 마크다운 → HTML 변환 (이미지 URL 포함)
    const htmlContent = markdownToHtml(content, imageUrls);

    // 3. 네이버 블로그 API로 임시저장 포스팅
    const response = await fetch("https://openapi.naver.com/v1/blog/post", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        contents: htmlContent,
        isPublic: 0, // 0: 임시저장, 1: 공개, 2: 이웃공개
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Naver Blog API error:", response.status, errorBody);
      return {
        success: false,
        error: `네이버 블로그 API 오류 (${response.status}). 네이버 앱 권한을 확인해주세요.`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      blogUrl: data.blogUrl ?? "https://blog.naver.com",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
