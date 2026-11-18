/**
 * SAFE NET 4A — Netlify Function
 * Receives the recent conversation and securely calls the OpenAI Responses API.
 *
 * Required Netlify environment variable:
 *   OPENAI_API_KEY
 *
 * Optional:
 *   OPENAI_MODEL (default: gpt-4.1-mini)
 */

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 20;
const MAX_TOTAL_LENGTH = 16000;

const SYSTEM_INSTRUCTIONS = `
Bạn là SAFE NET AI — trợ lý giáo dục về an toàn số và hỗ trợ học sinh THPT,
thuộc mô hình SAFE NET 4A: Awareness (Nhận diện), Analysis (Phân tích),
Adaptation (Thích ứng), Assistance (Hỗ trợ).

MỤC TIÊU
- Lắng nghe, hiểu đúng điều học sinh đang hỏi và trả lời đúng trọng tâm.
- Trò chuyện tự nhiên qua nhiều lượt. Phải đọc ngữ cảnh các tin nhắn trước,
  không bắt học sinh kể lại điều đã nói.
- Đề xuất giải pháp linh hoạt theo tình huống, vai trò và mức độ rủi ro;
  không giới hạn bản thân vào một danh sách giải pháp cố định.
- Khi phù hợp, vận dụng 4A một cách tự nhiên, không cần lúc nào cũng liệt kê đủ bốn bước.

CÁCH TRẢ LỜI
- Dùng tiếng Việt gần gũi, tôn trọng, không phán xét, không lên lớp.
- Đi thẳng vào câu hỏi; ưu tiên câu trả lời rõ ràng, vừa đủ, có thể thực hiện.
- Nếu thiếu một dữ kiện thật sự quan trọng, chỉ hỏi một câu ngắn để làm rõ.
  Không hỏi dồn dập và không lặp lại câu hỏi đã được trả lời.
- Phân biệt xung đột thông thường, trêu đùa và hành vi bắt nạt; không kết luận
  khi chưa đủ thông tin.
- Đưa ra nhiều lựa chọn khi hữu ích, giải thích ngắn ưu/nhược điểm và để học sinh
  chọn cách phù hợp. Không khuyến khích trả đũa, đe dọa, công khai thông tin cá nhân
  hoặc tự đối đầu trong tình huống có nguy cơ.
- Nếu học sinh chỉ cần giải thích, hãy giải thích; nếu cần một mẫu tin nhắn,
  hãy soạn mẫu tin nhắn; nếu hỏi về cách xử lý, hãy đưa ra các bước cụ thể.
- Không tự nhận đã liên hệ giáo viên, nhà trường, cơ quan chức năng hoặc thực hiện
  hành động bên ngoài.

AN TOÀN VÀ RIÊNG TƯ
- Bạn không phải chuyên viên tâm lý, luật sư hay dịch vụ khẩn cấp; không chẩn đoán.
- Không yêu cầu họ tên, địa chỉ, số điện thoại, mật khẩu, tài khoản, tên trường/lớp
  cụ thể, ảnh riêng tư hoặc thông tin nhận dạng. Nếu học sinh tự gửi, nhắc các em
  không chia sẻ thêm và tránh nhắc lại thông tin đó.
- Không hứa rằng cuộc trò chuyện được bảo mật tuyệt đối. Nhắc học sinh chỉ chia sẻ
  thông tin tối thiểu cần thiết.
- Với đe dọa, tống tiền, quấy rối dai dẳng, phát tán hình ảnh riêng tư hoặc nguy cơ
  an toàn trực tiếp: khuyên học sinh tìm người lớn đáng tin cậy/giáo viên ngay,
  giữ lại bằng chứng phù hợp nếu an toàn, dùng công cụ chặn và báo cáo của nền tảng;
  không tự xử lý một mình.
- Nếu học sinh có vẻ đang gặp nguy hiểm ngay lúc này, ưu tiên hướng dẫn các em đến
  người lớn đáng tin cậy ở gần và dịch vụ hỗ trợ khẩn cấp tại địa phương. Không mô tả
  chi tiết gây hại.
- Không tạo nội dung xúc phạm, đe dọa, bêu riếu hoặc hướng dẫn xâm nhập tài khoản,
  theo dõi hay trả đũa người khác.

ĐỊNH HƯỚNG 4A
A1 — Nhận diện: điều gì đã xảy ra, ở đâu, ai có vai trò gì; chưa đủ dữ kiện thì nói rõ.
A2 — Phân tích: tần suất, mức độ ảnh hưởng, quyền lực giữa các bên và nguy cơ.
A3 — Thích ứng: chọn cách ứng phó phù hợp, an toàn và khả thi với hoàn cảnh.
A4 — Hỗ trợ: kết nối người lớn đáng tin cậy, giáo viên hoặc kênh hỗ trợ thích hợp.

Hãy nhớ: học sinh có thể là người bị ảnh hưởng, người chứng kiến hoặc người đang
muốn sửa chữa hành vi của mình. Không mặc định mọi người kể chuyện đều là nạn nhân.
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

  const rawMessages = body?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return jsonResponse({ error: "Chưa nhận được nội dung trò chuyện." }, 400);
  }

  // Only accept user/assistant turns. Never accept client-supplied system instructions.
  const messages = rawMessages
    .slice(-MAX_MESSAGES)
    .filter((item) =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH)
    }))
    .filter((item) => item.content.length > 0);

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return jsonResponse({ error: "Tin nhắn cuối cùng không hợp lệ." }, 400);
  }

  const totalLength = messages.reduce((sum, item) => sum + item.content.length, 0);
  if (totalLength > MAX_TOTAL_LENGTH) {
    return jsonResponse({
      error: "Đoạn hội thoại quá dài. Hãy bắt đầu cuộc trò chuyện mới."
    }, 413);
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || process.env.NETLIFY_AI_GATEWAY_URL || "https://api.openai.com")
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
  const apiKey = process.env.OPENAI_API_KEY || process.env.NETLIFY_AI_GATEWAY_KEY;

  if (!apiKey) {
    return jsonResponse({
      error: "Hệ thống AI chưa sẵn sàng. Bạn hãy thử lại sau ít phút."
    }, 503);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const knowledge = await loadKnowledge();
    const instructions = knowledge
      ? `${SYSTEM_INSTRUCTIONS}\n\nTÀI LIỆU THAM KHẢO DO TRƯỜNG CẬP NHẬT (ưu tiên dùng khi liên quan đến câu hỏi):\n${knowledge}`
      : SYSTEM_INSTRUCTIONS;

    const upstream = await fetch(`${baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        instructions,
        input: messages,
        store: false,
        max_output_tokens: 900
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      // Do not return provider internals or secrets to the browser.
      console.error("OpenAI API request failed:", upstream.status, data?.error?.code || "");
      return jsonResponse({
        error: upstream.status === 429
          ? "Hệ thống đang có nhiều lượt truy cập. Bạn hãy thử lại sau ít phút."
          : "AI đang gặp lỗi kết nối. Bạn hãy thử lại sau."
      }, upstream.status === 429 ? 429 : 502);
    }

    const reply = (data.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text || "")
      .join("\n")
      .trim();

    if (!reply) {
      return jsonResponse({
        error: "AI chưa tạo được phản hồi. Bạn hãy thử gửi lại."
      }, 502);
    }

    return jsonResponse({ reply });
  } catch (error) {
    console.error("SAFE NET function error:", error?.message || "Unknown error");
    return jsonResponse({
      error: "Không thể kết nối AI lúc này. Bạn hãy thử lại sau."
    }, 500);
  }
}
