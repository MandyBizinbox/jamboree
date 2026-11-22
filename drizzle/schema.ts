import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const registrations = mysqlTable("registrations", {
  id: int("id").autoincrement().primaryKey(),
  reference: varchar("reference", { length: 32 }).notNull().unique(),
  participantUserId: int("participantUserId"),
  guardianUserId: int("guardianUserId"),
  role: varchar("role", { length: 80 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 10 }).notNull(),
  isMinor: int("isMinor").notNull().default(0),
  status: mysqlEnum("status", ["Draft", "Submitted", "Needs correction", "Approved", "Exported"]).notNull().default("Draft"),
  payload: text("payload").notNull(),
  sourceRevision: varchar("sourceRevision", { length: 64 }).notNull().default("wsj-fields.json"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  registrationId: int("registrationId"),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 80 }).notNull(),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = typeof registrations.$inferInsert;

export const formSections = mysqlTable("formSections", {
  id: int("id").autoincrement().primaryKey(),
  sectionKey: varchar("sectionKey", { length: 80 }).notNull().unique(),
  displayLabel: varchar("displayLabel", { length: 180 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  visible: int("visible").notNull().default(1),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const formFieldConfigs = mysqlTable("formFieldConfigs", {
  id: int("id").autoincrement().primaryKey(),
  sourceColumn: int("sourceColumn").notNull().unique(),
  displayLabel: text("displayLabel").notNull(),
  sectionKey: varchar("sectionKey", { length: 80 }).notNull(),
  visible: int("visible").notNull().default(1),
  required: int("required").notNull().default(0),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
