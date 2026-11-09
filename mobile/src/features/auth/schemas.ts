import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('auth.errEmail');

export const signInSchema = z.object({ email, password: z.string().min(1, 'auth.errPassword') });
export type SignInForm = z.infer<typeof signInSchema>;

export const registerSchema = z.object({
  email,
  password: z.string().min(8, 'auth.errPwLen').max(128),
  password2: z.string(),
  terms: z.boolean().refine(v => v, 'auth.errTerms'),
}).refine(v => v.password === v.password2, { path: ['password2'], message: 'auth.errPwMatch' });
export type RegisterForm = z.infer<typeof registerSchema>;

export const emailSchema = z.object({ email });
export const newPasswordSchema = z.object({ password: z.string().min(8, 'auth.errPwLen').max(128) });

/** Accepts either a raw token or a full zpot:// / http(s) link containing ?token=… */
export function extractToken(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]token=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : s;
}
