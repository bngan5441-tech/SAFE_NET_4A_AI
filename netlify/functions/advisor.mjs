/**
 * SAFE NET 4A — Advisor AI Netlify Function
 * Tự động trả lời các câu hỏi về đội ngũ tư vấn tâm lý của trường
 * (thầy Nguyễn Hữu Hải cùng ban tư vấn) qua Netlify AI Gateway.
 *
 * Không cần cấu hình API key: Netlify tự inject
 *   NETLIFY_AI_GATEWAY_URL / NETLIFY_AI_GATEWAY_KEY
 */

const MAX_QUESTION_LENGTH = 500;
const MAX_OUTPUT_TOKENS = 500;

const COUNSELOR_CONTEXT = `
- Chuyên gia tư vấn tâm lý chính: Thầy Nguyễn Hữu Hải, chịu trách nhiệm
  chuyên môn của Ban tư vấn tâm lý trường THPT Mộ Đức.
- Ban tư vấn tâm lý: nhóm giáo viên của trường, cùng thầy Hữu Hải đồng hành
  với học sinh; nghe chia sẻ riêng tư và giữ bí mật trong phạm vi trách nhiệm.
- Cách gặp: đăng ký qua lớp / giáo viên chủ nhiệm, hoặc gửi chia sẻ tại
  "Trạm Lắng Nghe" của dự án để thầy cô chủ động liên hệ.
- AI (SAFE NET AI) hỗ trợ trò chuyện trước, nhưng không thay thế buổi tư vấn
  trực tiếp; các tình huống nhạy cảm sẽ được khuyên kết nối thầy cô ngay.
`;

const SYSTEM_INSTRUCTIONS = `
Bạn là trợ lý AI của SAFE NET 4A (dự án an toàn số trường THPT Mộ Đức).
Nhiệm vụ: tự động trả lời các câu hỏi của học sinh về đội ngũ tư vấn tâm lý
của trường và về cách tìm hỗ trợ.

THÔNG TIN ĐỘI NGŨ (chỉ dựa vào đây, không bịa thêm thông tin liên hệ):
${COUNSELOR_CONTEXT}

CÁCH TRẢ LỜI
- Tiếng Việt gần gũi, tôn trọng, ngắn gọn (2–6 câu), đi thẳng vào câu hỏi.
- Khi cần viết công thức toán, dùng LaTeX với dấu \\( ... \\) cho công thức
  trong dòng và \\[ ... \\] cho công thức riêng một dòng; không dùng Markdown.
- Nếu câu hỏi nằm ngoài chủ đề đội ngũ tư vấn / tìm hỗ trợ, trả lời ngắn rằng
  bạn hỗ trợ tốt nhất ở khung chat chính SAFE NET AI, và mời học sinh trò
  chuyện ở đó hoặc gặp trực tiếp thầy cô.
- Không tự bịa ra số điện thoại, email, phòng làm việc hay lịch trực cụ thể.
- Không chẩn đoán tâm lý, không tư vấn sâu như chuyên viên; khi câu hỏi mang
  tính cá nhân, nhắc nhẹ rằng gặp trực tiếp thầy cô sẽ phù hợp hơn.
- Nếu câu hỏi có dấu hiệu nguy hiểm (bị đe dọa, tống tiền, tổn thương nghiêm
  trọng): ưu tiên nhắc học sinh tìm ngay người lớn đáng tin cậy / thầy cô
  ban tư vấn, không trì hoãn.
`;

import { loadKnowledge } from "./_knowledge.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function callGateway(question, systemPrompt) {
  const baseUrl = (process.env.NETLIFY_AI_GATEWAY_URL || process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");
  const apiKey = process.env.NETLIFY_AI_GATEWAY_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return { skipped: true };
  }

  const response = await fetch(
    `${baseUrl}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        store: false
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("AI Gateway request failed:", response.status, data?.error?.code || "");
    return { error: true, status: response.status };
  }

  const reply = (data.choices?.[0]?.message?.content || "").trim();
  return { reply };
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Phương thức không được hỗ trợ." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Dữ liệu gửi lên không hợp lệ." }, 400);
  }

  const question = String(body?.question || "").trim().slice(0, MAX_QUESTION_LENGTH);

  if (!question) {
    return jsonResponse({ error: "Chưa nhận được câu hỏi." }, 400);
  }

  try {
    const knowledge = await loadKnowledge();
    const systemPrompt = knowledge
      ? `${SYSTEM_INSTRUCTIONS}\n\nTÀI LIỆU THAM KHẢO DO TRƯỜNG CẬP NHẬT (ưu tiên dùng khi liên quan):\n${knowledge}`
      : SYSTEM_INSTRUCTIONS;

    const result = await callGateway(question, systemPrompt);

    if (result.skipped) {
      return jsonResponse({
        error: "Hệ thống AI chưa sẵn sàng. Bạn hãy thử lại sau ít phút."
      }, 503);
    }

    if (result.error) {
      return jsonResponse({
        error: result.status === 429
          ? "Hệ thống đang có nhiều lượt truy cập. Bạn hãy thử lại sau ít phút."
          : "AI đang gặp lỗi kết nối. Bạn hãy thử lại sau."
      }, result.status === 429 ? 429 : 502);
    }

    if (!result.reply) {
      return jsonResponse({ error: "AI chưa tạo được câu trả lời. Bạn hãy thử lại." }, 502);
    }

    return jsonResponse({ reply: result.reply });
  } catch (error) {
    console.error("Advisor function error:", error?.message || "Unknown error");
    return jsonResponse({
      error: "Không thể kết nối AI lúc này. Bạn hãy thử lại sau."
    }, 500);
  }
}
