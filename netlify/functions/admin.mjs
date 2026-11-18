/**
 * SAFE NET 4A — Admin API
 * POST /.netlify/functions/admin
 *
 * Hai khu vực, mỗi khu có mật khẩu riêng (kiểm tra phía server):
 * - Khu tài liệu "nội dung trả lời" cho AI: mật khẩu đặt qua biến môi trường
 *   ADMIN_PASS_DOCS (mặc định theo cấu hình ban đầu của dự án).
 * - Khu thông tin ban tư vấn: ADMIN_PASS_TEAM (mặc định tương tự).
 *
 * Actions:
 *  - { action: "list_docs", pass }            → danh sách tài liệu
 *  - { action: "add_doc", pass, title, content }
 *  - { action: "delete_doc", pass, id }
 *  - { action: "save_team", pass, team, group }
 */

import { db } from "../../db/index.js";
import { siteContent, docs } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";

const TEAM_KEY = "counseling_team";
const GROUP_KEY = "counseling_group";

const MAX_TITLE = 120;
const MAX_CONTENT = 12000;
const MAX_TEAM_FIELD = 4000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function timedEqual(a, b) {
  const aBytes = Buffer.from(String(a || ""));
  const bBytes = Buffer.from(String(b || ""));
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function checkDocsPass(pass) {
  return timedEqual(pass, process.env.ADMIN_PASS_DOCS || "1234");
}

function checkTeamPass(pass) {
  return timedEqual(pass, process.env.ADMIN_PASS_TEAM || "4567");
}

function clean(text, max) {
  return String(text ?? "").trim().slice(0, max);
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

  const action = String(body?.action || "");
  const pass = String(body?.pass || "");

  try {
    if (action === "list_docs") {
      if (!checkDocsPass(pass)) return jsonResponse({ error: "Mật khẩu không đúng." }, 401);

      const rows = await db
        .select({ id: docs.id, title: docs.title, createdAt: docs.createdAt })
        .from(docs)
        .orderBy(desc(docs.createdAt))
        .limit(100);

      return jsonResponse({ docs: rows });
    }

    if (action === "add_doc") {
      if (!checkDocsPass(pass)) return jsonResponse({ error: "Mật khẩu không đúng." }, 401);

      const title = clean(body?.title, MAX_TITLE);
      const content = clean(body?.content, MAX_CONTENT);

      if (!title || !content) {
        return jsonResponse({ error: "Cần nhập đủ tiêu đề và nội dung tài liệu." }, 400);
      }

      const [created] = await db
        .insert(docs)
        .values({ title, content })
        .returning({ id: docs.id, title: docs.title, createdAt: docs.createdAt });

      return jsonResponse({ doc: created }, 201);
    }

    if (action === "delete_doc") {
      if (!checkDocsPass(pass)) return jsonResponse({ error: "Mật khẩu không đúng." }, 401);

      const id = Number(body?.id);
      if (!Number.isInteger(id) || id <= 0) {
        return jsonResponse({ error: "Tài liệu không hợp lệ." }, 400);
      }

      await db.delete(docs).where(eq(docs.id, id));
      return jsonResponse({ ok: true });
    }

    if (action === "save_team") {
      if (!checkTeamPass(pass)) return jsonResponse({ error: "Mật khẩu không đúng." }, 401);

      const team = body?.team || {};
      const group = body?.group || {};

      const teamValues = {
        title: clean(team.title, MAX_TEAM_FIELD) || "Thầy Nguyễn Hữu Hải",
        role: clean(team.role, MAX_TEAM_FIELD),
        body: clean(team.body, MAX_TEAM_FIELD),
        updatedAt: new Date()
      };

      const groupValues = {
        title: clean(group.title, MAX_TEAM_FIELD) || "👥 Ban tư vấn tâm lý",
        body: JSON.stringify({
          desc: clean(group.desc, MAX_TEAM_FIELD),
          items: Array.isArray(group.items)
            ? group.items.map((item) => clean(item, 500)).filter(Boolean).slice(0, 8)
            : [],
          note: clean(group.note, MAX_TEAM_FIELD)
        }),
        updatedAt: new Date()
      };

      for (const [key, values] of [[TEAM_KEY, teamValues], [GROUP_KEY, groupValues]]) {
        const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.key, key));
        if (existing[0]) {
          await db.update(siteContent).set(values).where(eq(siteContent.key, key));
        } else {
          await db.insert(siteContent).values({ key, ...values });
        }
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Yêu cầu không hợp lệ." }, 400);
  } catch (error) {
    console.error("Admin API error:", error?.message || "Unknown error");
    return jsonResponse({ error: "Không thực hiện được yêu cầu lúc này." }, 500);
  }
}
