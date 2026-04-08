"use server";

import { auth } from "@/lib/auth";

interface PostResult {
  success: boolean;
  blogUrl?: string;
  error?: string;
}

/** 마크다운 → 네이버 블로그용 HTML 변환 */
function markdownToHtml(markdown: string, imageUrls: string[]): string {
  let html = markdown
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  html = `<p>${html}</p>`;

  if (imageUrls.length > 0) {
    const imgBlock = imageUrls
      .map((url) => `<p><img src="${url}" style="max-width:100%;border-radius:8px;margin:8px 0;" /></p>`)
      .join("\n");
    html = html.replace("</p>", `</p>${imgBlock}`);
  }

  return html;
}

export async function postToNaverBlog(
  title: string,
  content: string,
  imageUrls: string[]
): Promise<PostResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "로그인이 필요합니다." };

  const accessToken = session.naverAccessToken;
  if (!accessToken)
    return { success: false, error: "네이버 액세스 토큰이 없습니다. 다시 로그인해주세요." };

  try {
    const htmlContent = markdownToHtml(content, imageUrls);

    const response = await fetch("https://openapi.naver.com/v1/blog/post", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        contents: htmlContent,
        isPublic: 0,
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
    return { success: true, blogUrl: data.blogUrl ?? "https://blog.naver.com" };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.",
    };
  }
}
