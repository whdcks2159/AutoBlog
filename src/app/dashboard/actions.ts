"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/lib/auth";

interface BlogResult {
  title: string;
  content: string;
  tags: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateBlog(
  guide: string,
  imageUrls: string[]
): Promise<BlogResult> {
  const session = await auth();
  if (!session?.user) throw new Error("로그인이 필요합니다.");
  if (imageUrls.length === 0) throw new Error("이미지를 업로드해주세요.");

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  // URL에서 이미지를 fetch → base64 변환
  const imageParts = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`이미지 fetch 실패: ${url}`);
      const buffer = await res.arrayBuffer();
      return {
        inlineData: {
          data: Buffer.from(buffer).toString("base64"),
          mimeType: res.headers.get("content-type") ?? "image/jpeg",
        },
      };
    })
  );

  const prompt = `
당신은 네이버 블로그 전문 작가입니다. 업로드된 이미지들을 분석하고 아래 지침에 따라 블로그 포스팅을 작성해주세요.

[사용자 가이드]
${guide || "없음 (이미지 내용을 바탕으로 자유롭게 작성해주세요)"}

[작성 지침]
1. 구조: 서론 → 본론(이미지별 소개) → 결론 형식
2. 소제목은 ## (H2), ### (H3) 마크다운 형식 사용
3. 적절한 이모지 활용으로 가독성 향상
4. 네이버 C-Rank에 유리한 자연스러운 구어체 말투 사용
5. 키워드를 자연스럽게 반복 배치
6. 총 분량: 800~1200자

반드시 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요:
{
  "title": "블로그 제목 (30자 이내, 핵심 키워드 포함)",
  "content": "블로그 본문 (마크다운 형식)",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"]
}
`;

  const result = await model.generateContent([prompt, ...imageParts]);
  const text = result.response.text().trim();
  const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    return JSON.parse(jsonText) as BlogResult;
  } catch {
    throw new Error("AI 응답 파싱 실패. 다시 시도해주세요.");
  }
}
