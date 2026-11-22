import { asc, eq } from "drizzle-orm";
import { formFieldConfigs, formSections } from "../drizzle/schema";
import { getDb } from "./db";

export async function getFormBuilderConfig() {
  const db = await getDb();
  if (!db) return { sections: [], fields: [] };
  const sections = await db.select().from(formSections).orderBy(asc(formSections.sortOrder));
  const fields = await db.select().from(formFieldConfigs).orderBy(asc(formFieldConfigs.sourceColumn));
  return { sections, fields };
}

export async function saveFormSection(input: typeof formSections.$inferInsert) {
  const db = await getDb();
  if (!db) return { persisted: false };
  await db.insert(formSections).values(input).onDuplicateKeyUpdate({ set: { displayLabel: input.displayLabel, sortOrder: input.sortOrder, visible: input.visible, updatedBy: input.updatedBy } });
  return { persisted: true };
}

export async function saveFormField(input: typeof formFieldConfigs.$inferInsert) {
  const db = await getDb();
  if (!db) return { persisted: false };
  await db.insert(formFieldConfigs).values(input).onDuplicateKeyUpdate({ set: { displayLabel: input.displayLabel, sectionKey: input.sectionKey, visible: input.visible, required: input.required, updatedBy: input.updatedBy } });
  return { persisted: true };
}
