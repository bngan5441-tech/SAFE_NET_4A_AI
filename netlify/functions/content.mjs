/**
 * SAFE NET 4A — Content API (công khai)
 * GET /.netlify/functions/content
 * Trả về: thông tin ban tư vấn (2 mục), danh sách chia sẻ mới nhất.
 */

import { db } from "../../db/index.js";
import { siteContent, shares } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";

const TEAM_KEY = "counseling_team";
const GROUP_KEY = "counseling_group";

export const DEFAULT_TEAM = {
  title: "Thầy Nguyễn Hữu Hải",
  role: "Chuyên gia tư vấn tâm lý · Ban tư vấn trường THPT Mộ Đức",
  body:
    "Người chịu trách nhiệm chuyên môn của ban tư vấn tâm lý. Thầy trực tiếp lắng nghe, " +
    "định hướng hỗ trợ cho học sinh trong các trường hợp liên quan đến áp lực học tập, " +
    "mâu thuẫn bạn bè, bắt nạt — bạo lực học đường và an toàn trên không gian mạng. " +
    "Mọi tình huống nhạy cảm mà AI nhận diện sẽ được kết nối đến thầy và ban tư vấn để xử lý trực tiếp.",
};

export const DEFAULT_GROUP = {
  title: "👥 Ban tư vấn tâm lý",
  desc: "Nhóm giáo viên thuộc ban tư vấn của trường, cùng thầy Hữu Hải đồng hành với học sinh.",
  items: [
    "Nghe chia sẻ riêng tư, giữ bí mật trong phạm vi trách nhiệm.",
    "Phối hợp với gia đình, giáo viên chủ nhiệm khi cần thiết.",
    "Hỗ trợ các bạn đang bị ảnh hưởng, người chứng kiến và cả người muốn thay đổi hành vi của mình.",
  ],
  note: "📮 Muốn gặp trực tiếp? Đăng ký qua lớp, qua giáo viên chủ nhiệm, hoặc gửi chia sẻ tại Trạm Lắng Nghe — thầy cô sẽ chủ động liên hệ bạn.",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function getTeamContent() {
  const rows = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.key, TEAM_KEY));
  const groupRows = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.key, GROUP_KEY));

  let team = { ...DEFAULT_TEAM };
  const teamRow = rows[0];
  if (teamRow) {
    team = {
      title: teamRow.title || DEFAULT_TEAM.title,
      role: teamRow.role || DEFAULT_TEAM.role,
      body: teamRow.body || DEFAULT_TEAM.body
    };
  }

  let group = { ...DEFAULT_GROUP };
  const groupRow = groupRows[0];
  if (groupRow) {
    let parsed = {};
    try {
      parsed = JSON.parse(groupRow.body || "{}");
    } catch {
      parsed = {};
    }
    group = {
      title: groupRow.title || DEFAULT_GROUP.title,
      desc: parsed.desc || DEFAULT_GROUP.desc,
      items: Array.isArray(parsed.items) ? parsed.items : DEFAULT_GROUP.items,
      note: parsed.note || DEFAULT_GROUP.note
    };
  }

  return { team, group };
}

export default async function handler(req) {
  if (req.method !== "GET") {
    return jsonResponse({ error: "Phương thức không được hỗ trợ." }, 405);
  }

  try {
    const { team, group } = await getTeamContent();

    const recentShares = await db
      .select({
        id: shares.id,
        name: shares.name,
        message: shares.message,
        createdAt: shares.createdAt
      })
      .from(shares)
      .where(eq(shares.hidden, false))
      .orderBy(desc(shares.createdAt))
      .limit(30);

    return jsonResponse({ team, group, shares: recentShares });
  } catch (error) {
    console.error("Content API error:", error?.message || "Unknown error");
    return jsonResponse({ error: "Không tải được nội dung lúc này." }, 500);
  }
}
