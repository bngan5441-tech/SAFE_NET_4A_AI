import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

// Nội dung trang do quản trị viên chỉnh sửa (khóa nội dung, ví dụ "counseling_team")
export const siteContent = pgTable("site_content", {
  id: serial().primaryKey(),
  key: text("key").notNull().unique(),
  title: text().notNull().default(""),
  role: text().notNull().default(""),
  body: text().notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tài liệu "nội dung trả lời" — ngữ cảnh bổ sung cho AI
export const docs = pgTable("docs", {
  id: serial().primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chia sẻ do học sinh / người dùng gửi
export const shares = pgTable("shares", {
  id: serial().primaryKey(),
  name: text().notNull().default(""),
  message: text().notNull(),
  hidden: boolean().notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
