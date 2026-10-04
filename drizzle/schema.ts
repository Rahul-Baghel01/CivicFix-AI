import {
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reportId: varchar("reportId", { length: 32 }).notNull().unique(),
  userId: int("userId"),
  issueType: varchar("issueType", { length: 80 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 6 }).notNull(),
  address: text("address").notNull(),
  severity: mysqlEnum("severity", [
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
  ]).notNull(),
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull(),
  potentialRisk: text("potentialRisk").notNull(),
  priority: mysqlEnum("priority", [
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
  ]).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  assignedOfficer: varchar("assignedOfficer", { length: 120 }),
  status: mysqlEnum("status", [
    "Submitted",
    "Under Review",
    "Assigned",
    "In Progress",
    "Resolved",
  ])
    .notNull()
    .default("Submitted"),
  isDemo: int("isDemo").notNull().default(0),
  resolutionNote: text("resolutionNote"),
  resolutionImageUrl: text("resolutionImageUrl"),
  resolutionImageKey: text("resolutionImageKey"),
  verificationScore: decimal("verificationScore", { precision: 5, scale: 2 }),
  verificationExplanation: text("verificationExplanation"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reportEvents = mysqlTable("reportEvents", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  status: mysqlEnum("status", [
    "Submitted",
    "Under Review",
    "Assigned",
    "In Progress",
    "Resolved",
  ]).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  reportId: int("reportId"),
  message: text("message").notNull(),
  type: varchar("type", { length: 64 }).notNull().default("status_update"),
  isRead: int("isRead").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description").notNull(),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reportAssignments = mysqlTable("reportAssignments", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  departmentId: int("departmentId").notNull(),
  officerName: varchar("officerName", { length: 120 }),
  assignedByUserId: int("assignedByUserId"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

export const authSessions = mysqlTable("authSessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
