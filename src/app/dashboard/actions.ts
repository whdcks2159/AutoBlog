"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/lib/auth";
import { deductPoints, POINT_COSTS } from "@/lib/points";

interface BlogResult {
  title: string;
  content: string;
  tags: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/** URL 배열 → Gemini inlineData 파트 변환 */
async function urlsToImageParts(imageUrls: string[]) {
  return Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = res.headers.get("content-type") || "image/jpeg";
      return { inlineData: { data: base64, mimeType } };
    })
  );
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  return JSON.parse(cleaned) as T;
}

/* ── 네이버 블로그 ── */

export interface BlogGenerateResult {
  blog: BlogResult;
  remainingPoints: number;
}

export async function generateBlog(
  guide: string,
  imageUrls: string[]
): Promise<BlogGenerateResult> {
  const session = await auth();
  if (!session?.user || !session.userId) throw new Error("로그인이 필요합니다.");
  if (imageUrls.length === 0) throw new Error("이미지를 업로드해주세요.");

  // 포인트 차감 (잔액 부족 시 INSUFFICIENT_POINTS throw)
  const remainingPoints = await deductPoints(
    session.userId,
    POINT_COSTS.BASIC_GENERATE,
    "네이버 블로그 콘텐츠 생성"
  );

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const imageParts = await urlsToImageParts(imageUrls);

  const prompt = `당신은 네이버 블로그 전문 작가입니다. 업로드된 이미지들을 분석하고 아래 지침에 따라 블로그 포스팅을 작성해주세요.

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
}`;

  const result = await model.generateContent([...imageParts, prompt]);
  try {
    const blog = parseJson<BlogResult>(result.response.text());
    return { blog, remainingPoints };
  } catch {
    throw new Error("AI 응답 파싱 실패. 다시 시도해주세요.");
  }
}

/* ── 트위터 ── */

export interface TweetResult {
  text: string;
}

export interface TweetGenerateResult {
  tweet: TweetResult;
  remainingPoints: number;
}

export async function generateTweet(
  guide: string,
  imageUrls: string[]
): Promise<TweetGenerateResult> {
  const session = await auth();
  if (!session?.user || !session.userId) throw new Error("로그인이 필요합니다.");
  if (imageUrls.length === 0) throw new Error("이미지를 업로드해주세요.");

  const remainingPoints = await deductPoints(
    session.userId,
    POINT_COSTS.BASIC_GENERATE,
    "트위터 콘텐츠 생성"
  );

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const imageParts = await urlsToImageParts(imageUrls);

  const prompt = `당신은 트위터(X) 바이럴 전문 작가입니다. 업로드된 이미지들을 분석해 트윗을 작성해주세요.

[사용자 가이드]
${guide || "없음 (이미지 내용을 바탕으로 자유롭게 작성해주세요)"}

[작성 지침]
1. 반드시 240자 이내 (해시태그 포함 총 280자 이하)
2. 위트 있고 공감 가는 B급 감성 말투 사용
3. 첫 문장에서 바로 눈길을 사로잡아야 함
4. 해시태그 2~3개를 본문 끝에 자연스럽게 삽입
5. 줄바꿈을 적절히 활용해 가독성 향상
6. 이모지를 1~2개 활용 (과하지 않게)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "text": "트윗 본문 (해시태그 포함, 280자 이하)"
}`;

  const result = await model.generateContent([...imageParts, prompt]);
  try {
    const tweet = parseJson<TweetResult>(result.response.text());
    return { tweet, remainingPoints };
  } catch {
    throw new Error("AI 응답 파싱 실패. 다시 시도해주세요.");
  }
}

/* ── 릴스 / 숏폼 ── */

export interface ReelsConcept {
  type: "감성 스토리형" | "정보성 꿀팁형" | "병맛 유머형";
  title: string;
  description: string;
  bgm: string;
}

export interface ReelsConceptsResult {
  concepts: [ReelsConcept, ReelsConcept, ReelsConcept];
}

export interface ReelsScript {
  hook: string;
  scenes: string[];
  editingPoints: string[];
  memeCaption: string;
  cta: string;
}

export interface ReelsScriptResult {
  script: ReelsScript;
  remainingPoints: number;
}

// 콘셉트 3가지 생성 — 무료
export async function generateReelsConcepts(
  guide: string,
  imageUrls: string[],
  platform: "instagram" | "tiktok"
): Promise<ReelsConceptsResult> {
  const session = await auth();
  if (!session?.user) throw new Error("로그인이 필요합니다.");
  if (imageUrls.length === 0) throw new Error("이미지를 업로드해주세요.");

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const imageParts = await urlsToImageParts(imageUrls);
  const platformLabel = platform === "instagram" ? "인스타그램 릴스" : "틱톡";

  const prompt = `당신은 ${platformLabel} 전문 숏폼 크리에이터입니다. 업로드된 이미지들을 분석해 3가지 영상 콘셉트를 제안해주세요.

[사용자 가이드]
${guide || "없음 (이미지 내용을 바탕으로 자유롭게 제안해주세요)"}

[3가지 콘셉트 유형 — 반드시 아래 순서대로]
1. 감성 스토리형: 따뜻하고 공감 가는 감성 스토리
2. 정보성 꿀팁형: 실용적이고 유익한 정보 전달
3. 병맛 유머형: 위트 있고 웃긴 B급 유머 감성

[작성 지침]
- title: 영상의 핵심 훅이 담긴 한 문장 (30자 이내)
- description: 영상의 전체 흐름과 분위기 2~3문장
- bgm: 분위기에 맞는 음악 스타일 (예: "잔잔한 어쿠스틱 팝")
- 실제 이미지 내용에 기반한 구체적인 제안

반드시 아래 JSON 형식으로만 응답하세요:
{
  "concepts": [
    { "type": "감성 스토리형", "title": "...", "description": "...", "bgm": "..." },
    { "type": "정보성 꿀팁형", "title": "...", "description": "...", "bgm": "..." },
    { "type": "병맛 유머형",   "title": "...", "description": "...", "bgm": "..." }
  ]
}`;

  const result = await model.generateContent([...imageParts, prompt]);
  try {
    return parseJson<ReelsConceptsResult>(result.response.text());
  } catch {
    throw new Error("AI 응답 파싱 실패. 다시 시도해주세요.");
  }
}

// 상세 대본 생성 — 300포인트 차감
export async function generateReelsScript(
  concept: ReelsConcept,
  guide: string,
  imageUrls: string[],
  platform: "instagram" | "tiktok"
): Promise<ReelsScriptResult> {
  const session = await auth();
  if (!session?.user || !session.userId) throw new Error("로그인이 필요합니다.");

  // 포인트 차감 (잔액 부족 시 INSUFFICIENT_POINTS throw)
  const remainingPoints = await deductPoints(
    session.userId,
    POINT_COSTS.REELS_SCRIPT,
    `${platform === "instagram" ? "인스타그램" : "틱톡"} 릴스 대본 — ${concept.title}`
  );

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const imageParts = await urlsToImageParts(imageUrls);
  const platformLabel = platform === "instagram" ? "인스타그램 릴스 (15~30초)" : "틱톡 (15~60초)";

  const prompt = `당신은 ${platformLabel} 전문 숏폼 대본 작가입니다.

[선택된 콘셉트]
유형: ${concept.type}
제목: ${concept.title}
설명: ${concept.description}
BGM: ${concept.bgm}

[사용자 가이드]
${guide || "없음"}

[작성 지침]
- hook: 첫 3초를 사로잡을 강력한 오프닝 멘트 (1문장)
- scenes: 장면별 대본 3~5개
- editingPoints: 편집 포인트 3~5개 (컷 타이밍, 효과, 자막 위치 등)
- memeCaption: 밈 감성 자막 1개 (짧고 임팩트 있게)
- cta: 마무리 Call-to-Action

반드시 아래 JSON 형식으로만 응답하세요:
{
  "hook": "...",
  "scenes": ["장면1: ...", "장면2: ...", "장면3: ..."],
  "editingPoints": ["...", "...", "..."],
  "memeCaption": "...",
  "cta": "..."
}`;

  const result = await model.generateContent([...imageParts, prompt]);
  try {
    const script = parseJson<ReelsScript>(result.response.text());
    return { script, remainingPoints };
  } catch {
    throw new Error("AI 응답 파싱 실패. 다시 시도해주세요.");
  }
}
