// lib/validation.ts
// Zod schemas for validating all API request bodies.
// Every API route must validate input before touching the database.

import { z } from 'zod'

// ── Reusable field definitions ──────────────────────────────────────────────

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(s => !isNaN(Date.parse(s)), 'Invalid date')

const positiveNumber = z.number().positive('Must be a positive number')

const safeString = (max = 255) =>
  z.string().min(1).max(max).transform(s => s.trim())

// ── Product schemas ─────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name:               safeString(200),
  barcode:            z.string().max(100).optional().nullable(),
  category:           z.enum(['Reagent', 'Disinfectant', 'Solvent', 'Chemical', 'Biological']),
  lot:                safeString(100),
  location:           safeString(200),
  quantity:           positiveNumber,
  unit:               safeString(50),
  expiry:             dateString,
  addedBy:            safeString(200),
  lowStockThreshold:  z.number().min(0).default(0),
  useWithinDays:      z.number().int().positive().optional().nullable(),
  openedOn:           dateString.optional().nullable(),
  openedBy:           safeString(200).optional().nullable(),
})

export const PatchProductSchema = z.object({
  // Fields that can be updated
  name:               safeString(200).optional(),
  barcode:            z.string().max(100).optional().nullable(),
  category:           z.enum(['Reagent', 'Disinfectant', 'Solvent', 'Chemical', 'Biological']).optional(),
  lot:                safeString(100).optional(),
  location:           safeString(200).optional(),
  quantity:           z.number().min(0).optional(),
  unit:               safeString(50).optional(),
  expiry:             dateString.optional(),
  lowStockThreshold:  z.number().min(0).optional(),
  useWithinDays:      z.number().int().positive().optional().nullable(),
  openedOn:           dateString.optional().nullable(),
  openedBy:           safeString(200).optional().nullable(),
  // Metadata
  actor:              safeString(200).optional(),
  action:             z.enum(['log_use', 'mark_opened', 'threshold', 'edit']).optional(),
})

// ── Usage log schemas ────────────────────────────────────────────────────────

export const CreateUsageLogSchema = z.object({
  productId:     z.number().int().positive(),
  productName:   safeString(200),
  barcode:       z.string().max(100).optional().nullable(),
  qty:           positiveNumber,
  unit:          safeString(50),
  usedBy:        safeString(200),
  teamMemberId:  z.number().int().positive().optional().nullable(),
  note:          z.string().max(500).optional().nullable(),
  openedProduct: z.boolean().default(false),
})

// ── Team member schemas ──────────────────────────────────────────────────────

export const CreateTeamMemberSchema = z.object({
  name:     safeString(200),
  email:    z.string().email('Invalid email address').max(255).toLowerCase(),
  role:     z.enum(['admin', 'technician', 'viewer']),
  location: safeString(100),
  actor:    safeString(200).optional(),
})

export const PatchTeamMemberSchema = z.object({
  name:     safeString(200).optional(),
  email:    z.string().email().max(255).toLowerCase().optional(),
  role:     z.enum(['admin', 'technician', 'viewer']).optional(),
  location: safeString(100).optional(),
  status:   z.enum(['active', 'inactive']).optional(),
  actor:    safeString(200).optional(),
})

// ── Auth schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email:    z.string().email().max(255).toLowerCase().transform(s => s.trim()),
  password: z.string().min(1).max(200),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword:     z.string().min(12).max(200),
  confirmPassword: z.string().min(1).max(200),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
})

export const MfaVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'MFA code must be 6 digits'),
})

export const MfaSetupConfirmSchema = z.object({
  secret: z.string().min(16).max(64),
  code:   z.string().length(6).regex(/^\d{6}$/, 'MFA code must be 6 digits'),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body against a schema.
 * Returns { data } on success or { error, status } on failure.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: string; status: number }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { error: 'Invalid JSON body', status: 400 }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    return { error: `Validation failed: ${messages}`, status: 422 }
  }

  return { data: result.data }
}
