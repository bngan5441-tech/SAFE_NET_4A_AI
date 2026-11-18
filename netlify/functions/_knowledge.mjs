/**
 * SAFE NET 4A — Knowledge helper (dùng chung)
 * Nạp tài liệu "nội dung trả lời" do quản trị viên upload (mật khẩu khu tài liệu)
 * để làm ngữ cảnh bổ sung khi AI trả lời. Trả về chuỗi rỗng nếu lỗi/empty.
 */

import { db } from "../../db/index.js";
import { docs } from "../../db/schema.js";
import { desc } from "drizzle-orm";

const MAX_DOCS = 12;
const MAX_TOTAL_LENGTH = 12000;

export async function loadKnowledge() {
  try {
    const rows = await db
      .select({ title: docs.title, content: docs.content })
      .from(docs)
      .orderBy(desc(docs.createdAt))
      .limit(MAX_DOCS);

    if (rows.length === 0) return "";

    const parts = [];
    let total = 0;

    for (const row of rows) {
      const block = `### ${row.title}\n${row.content}`;
      if (total + block.length > MAX_TOTAL_LENGTH) break;
      parts.push(block);
      total += block.length;
    }

    return parts.join("\n\n");
  } catch (error) {
    console.error("Knowledge load error:", error?.message || "Unknown error");
    return "";
  }
}
