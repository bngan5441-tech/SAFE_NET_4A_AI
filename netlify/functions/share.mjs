/**
 * SAFE NET 4A — Share API
 * POST /.netlify/functions/share
 * Người dùng gửi chia sẻ (tên tùy chọn + nội dung). Nội dung không ẩn danh bắt buộc,
 * nhắc người dùng không nhập thông tin nhận dạng cá nhân.
 */

import { db } from "../../db/index.js";
import { shares } from "../../db/schema.js";

const MAX_NAME_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 2000;

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

  const name = String(body?.name || "").trim().slice(0, MAX_NAME_LENGTH);
  const message = String(body?.message || "").trim().slice(0, MAX_MESSAGE_LENGTH);

  if (!message) {
    return jsonResponse({ error: "Chưa nhập nội dung chia sẻ." }, 400);
  }

  try {
    const [created] = await db
      .insert(shares)
      .values({ name, message })
      .returning({ id: shares.id, name: shares.name, message: shares.message, createdAt: shares.createdAt });

    return jsonResponse({ share: created }, 201);
  } catch (error) {
    console.error("Share API error:", error?.message || "Unknown error");
    return jsonResponse({ error: "Chưa gửi được chia sẻ lúc này. Bạn hãy thử lại." }, 500);
  }
}
