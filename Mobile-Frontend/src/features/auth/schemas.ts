import { z } from 'zod';

/**
 * Zod schemas for the consumer-app auth forms.
 *
 * Why Zod here:
 *   - Single source of truth for "what counts as a valid phone /
 *     password". Replaces a sprawl of ad-hoc `if (!field) setError(...)`
 *     checks that drifted between LoginScreen, RegisterScreen, and the
 *     normalizeTwPhone helper.
 *   - `safeParse` gives us per-field issues so the UI can surface
 *     them next to the relevant input.
 *
 * Phone format: Taiwan mobile `09XXXXXXXX` (10 digits). The schema
 * accepts user-typed dashes/spaces (`0912-345-678`) and `.transform`s
 * to the canonical form before downstream code sees it. The BE then
 * sees only the canonical shape, eliminating a class of validation
 * mismatch between client and server.
 */

const TW_MOBILE_PATTERN = /^09\d{8}$/;

function stripPhonePunctuation(raw: string): string {
  return raw.replace(/[-\s()]/g, '');
}

// Zod v4 dropped `required_error` / `invalid_type_error` in favour of a
// unified `error` option. The `.min(1, "msg")` line covers the
// missing-field case for both empty-string and undefined input, so we
// don't need a separate required marker here.
export const loginSchema = z.object({
  phone: z
    .string()
    .min(1, '請輸入手機號碼')
    .transform(stripPhonePunctuation)
    .refine((p) => TW_MOBILE_PATTERN.test(p), {
      message: '請輸入有效的台灣手機號碼 (09 開頭，共 10 碼)',
    }),
  password: z.string().min(6, '密碼至少 6 個字元'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginParsed = z.output<typeof loginSchema>;

// Min length for a reset password. Pinned to 8 to match the backend's
// `verify_password_reset_otp` check (`len(new_password) < 8` → error).
// Note this is deliberately stricter than loginSchema's min 6.
const RESET_PASSWORD_MIN_LENGTH = 8;
const OTP_LENGTH = 6;

/**
 * Schema for the phone-OTP password reset form. Reuses the same phone
 * normalization as loginSchema, plus a 6-digit OTP and an 8+ char new
 * password (BE-enforced minimum).
 */
export const phoneResetSchema = z.object({
  phone: z
    .string()
    .min(1, '請輸入手機號碼')
    .transform(stripPhonePunctuation)
    .refine((p) => TW_MOBILE_PATTERN.test(p), {
      message: '請輸入有效的台灣手機號碼 (09 開頭，共 10 碼)',
    }),
  otp: z
    .string()
    .min(1, '請輸入驗證碼')
    .refine((c) => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(c), {
      message: `請輸入 ${OTP_LENGTH} 位數驗證碼`,
    }),
  newPassword: z.string().min(RESET_PASSWORD_MIN_LENGTH, '密碼至少 8 個字元'),
});

export type PhoneResetInput = z.input<typeof phoneResetSchema>;
export type PhoneResetParsed = z.output<typeof phoneResetSchema>;

/**
 * Pull the first per-field error out of a phoneResetSchema parse failure.
 */
export function resetFieldErrorsFrom(error: z.ZodError<PhoneResetInput>): {
  phone?: string;
  otp?: string;
  newPassword?: string;
} {
  const out: { phone?: string; otp?: string; newPassword?: string } = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'phone' && !out.phone) out.phone = issue.message;
    if (field === 'otp' && !out.otp) out.otp = issue.message;
    if (field === 'newPassword' && !out.newPassword) out.newPassword = issue.message;
  }
  return out;
}

/**
 * Pull the first per-field error message out of a Zod parse failure.
 * Convenience for UI code that wants `{ phone?: string, password?: string }`.
 */
export function fieldErrorsFrom(error: z.ZodError<LoginInput>): {
  phone?: string;
  password?: string;
} {
  const out: { phone?: string; password?: string } = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'phone' && !out.phone) out.phone = issue.message;
    if (field === 'password' && !out.password) out.password = issue.message;
  }
  return out;
}
