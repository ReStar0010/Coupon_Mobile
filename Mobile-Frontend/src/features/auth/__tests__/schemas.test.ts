import { loginSchema, type LoginInput } from '../schemas';

describe('loginSchema', () => {
  it('accepts a valid TW mobile + password', () => {
    const input: LoginInput = { phone: '0912345678', password: 'pw123456' };
    const parsed = loginSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('strips dashes/spaces from the phone before validation', () => {
    const parsed = loginSchema.safeParse({
      phone: '0912-345-678',
      password: 'pw123456',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // The schema must normalise so the BE receives "0912345678".
      expect(parsed.data.phone).toBe('0912345678');
    }
  });

  it('rejects a phone with the wrong prefix', () => {
    const parsed = loginSchema.safeParse({ phone: '0812345678', password: 'pw123456' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'phone');
      expect(issue?.message).toMatch(/手機/);
    }
  });

  it('rejects a phone with too few digits', () => {
    const parsed = loginSchema.safeParse({ phone: '091234567', password: 'pw123456' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a password shorter than 6 characters', () => {
    const parsed = loginSchema.safeParse({ phone: '0912345678', password: 'pw1' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'password');
      expect(issue?.message).toMatch(/密碼/);
    }
  });

  it('reports both errors when phone and password are both invalid', () => {
    const parsed = loginSchema.safeParse({ phone: 'abc', password: '' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('phone');
      expect(fields).toContain('password');
    }
  });
});
