import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addAuditEvent, createRegistration, listRegistrations, updateRegistration } from "./registrationDb";
import { getFormBuilderConfig, saveFormField, saveFormSection } from "./formBuilderDb";

const registrationInput = z.object({
  reference: z.string().min(6).max(32),
  role: z.string().min(1).max(80),
  dateOfBirth: z.string().min(8).max(10),
  isMinor: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["Draft", "Submitted", "Needs correction", "Approved", "Exported"]).default("Draft"),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  registrations: router({
    saveDraft: publicProcedure.input(registrationInput).mutation(async ({ input, ctx }) => {
      const result = await createRegistration({ ...input, isMinor: input.isMinor ? 1 : 0, payload: JSON.stringify(input.payload), participantUserId: ctx.user?.id ?? null });
      await addAuditEvent({ registrationId: result.registration?.id ?? null, actorUserId: ctx.user?.id ?? null, action: "draft_saved", detail: JSON.stringify({ reference: input.reference }) });
      return { ...result, reference: input.reference };
    }),
    submit: publicProcedure.input(registrationInput).mutation(async ({ input, ctx }) => {
      const result = await createRegistration({ ...input, status: "Submitted", isMinor: input.isMinor ? 1 : 0, payload: JSON.stringify(input.payload), participantUserId: ctx.user?.id ?? null });
      await addAuditEvent({ registrationId: result.registration?.id ?? null, actorUserId: ctx.user?.id ?? null, action: "submitted", detail: JSON.stringify({ reference: input.reference }) });
      return { ...result, reference: input.reference };
    }),
    myDrafts: protectedProcedure.query(async ({ ctx }) => listRegistrations()),
    cmtQueue: adminProcedure.query(async () => listRegistrations()),
    setStatus: adminProcedure.input(z.object({ reference: z.string(), status: z.enum(["Draft", "Submitted", "Needs correction", "Approved", "Exported"]), detail: z.string().optional() })).mutation(async ({ input, ctx }) => {
      await updateRegistration(input.reference, { status: input.status });
      await addAuditEvent({ actorUserId: ctx.user.id, action: "status_changed", detail: JSON.stringify(input) });
      return { success: true } as const;
    }),
  }),
  formBuilder: router({
    get: adminProcedure.query(() => getFormBuilderConfig()),
    saveConfig: adminProcedure.input(z.object({ sections: z.array(z.object({ sectionKey: z.string(), displayLabel: z.string().min(1), sortOrder: z.number().int(), visible: z.boolean() })), fields: z.array(z.object({ sourceColumn: z.number().int(), displayLabel: z.string().min(1), sectionKey: z.string(), visible: z.boolean(), required: z.boolean() })) })).mutation(async ({ input, ctx }) => {
      for (const section of input.sections) await saveFormSection({ ...section, sectionKey: section.sectionKey, visible: section.visible ? 1 : 0, updatedBy: ctx.user.id });
      for (const field of input.fields) await saveFormField({ ...field, visible: field.visible ? 1 : 0, required: field.required ? 1 : 0, updatedBy: ctx.user.id });
      return { success: true } as const;
    }),
    saveSection: adminProcedure.input(z.object({ sectionKey: z.string(), displayLabel: z.string().min(1), sortOrder: z.number().int(), visible: z.boolean() })).mutation(({ input, ctx }) => saveFormSection({ ...input, visible: input.visible ? 1 : 0, updatedBy: ctx.user.id })),
    saveField: adminProcedure.input(z.object({ sourceColumn: z.number().int(), displayLabel: z.string().min(1), sectionKey: z.string(), visible: z.boolean(), required: z.boolean() })).mutation(({ input, ctx }) => saveFormField({ ...input, visible: input.visible ? 1 : 0, required: input.required ? 1 : 0, updatedBy: ctx.user.id })),
  }),
});

export type AppRouter = typeof appRouter;
