import { z } from 'zod';
import { UserRole } from '../enums.js';

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
  .email('Enter a valid email address')
  .max(254)
  .transform((v) => v.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Use at most 128 characters');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Tell us what to call you').max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export interface ForgotPasswordResult {
  /** False when the server can't actually send email (the link is only logged). */
  emailDeliveryConfigured: boolean;
}

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal(DELETE_CONFIRMATION),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: UserRole.schema,
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authSessionSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/** Claims carried by StudyThinker access tokens. */
export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  sid: string;
  typ: 'access';
}
