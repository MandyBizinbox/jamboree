import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { auditEvents, InsertRegistration, registrations } from "../drizzle/schema";

export async function createRegistration(input: InsertRegistration) {
  const db = await getDb();
  if (!db) return { persisted: false, reference: input.reference };
  await db.insert(registrations).values(input);
  const rows = await db.select().from(registrations).where(eq(registrations.reference, input.reference)).limit(1);
  return { persisted: true, registration: rows[0] };
}

export async function updateRegistration(reference: string, patch: Partial<InsertRegistration>) {
  const db = await getDb();
  if (!db) return { persisted: false };
  await db.update(registrations).set(patch).where(eq(registrations.reference, reference));
  return { persisted: true };
}

export async function listRegistrations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(registrations).orderBy(desc(registrations.updatedAt));
}

export async function addAuditEvent(input: typeof auditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values(input);
}
