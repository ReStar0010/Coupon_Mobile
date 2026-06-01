import {
  loginSchema,
  phoneResetSchema,
  resetFieldErrorsFrom,
  type LoginInput,
} from '../schemas';

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

  it('accepts a short non-empty password (registration allows any non-empty)', () => {
    // Login must not reject what registration permits, or short-password
    // users would be locked out. Only an empty password is invalid.
    const parsed = loginSchema.safeParse({ phone: '0912345678', password: 'pw1' });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const parsed = loginSchema.safeParse({ phone: '0912345678', password: '' });
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

describe('phoneResetSchema', () => {
  it('accepts a valid phone + 6-digit OTP + 8-char password', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: '0912345678',
      otp: '123456',
      newPassword: 'pw123456',
    });
    expect(parsed.success).toBe(true);
  });

  it('normalises the phone before validation', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: '0912-345-678',
      otp: '123456',
      newPassword: 'pw123456',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe('0912345678');
    }
  });

  it('rejects an OTP that is not exactly 6 digits', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: '0912345678',
      otp: '12345',
      newPassword: 'pw123456',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'otp');
      expect(issue?.message).toMatch(/驗證碼/);
    }
  });

  it('rejects a password shorter than 8 characters (stricter than login)', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: '0912345678',
      otp: '123456',
      newPassword: 'pw12345',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'newPassword');
      expect(issue?.message).toMatch(/密碼/);
    }
  });

  it('rejects a phone with the wrong prefix', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: '0812345678',
      otp: '123456',
      newPassword: 'pw123456',
    });
    expect(parsed.success).toBe(false);
  });

  it('resetFieldErrorsFrom surfaces a message per field', () => {
    const parsed = phoneResetSchema.safeParse({
      phone: 'abc',
      otp: '12',
      newPassword: 'x',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = resetFieldErrorsFrom(parsed.error);
      expect(fields.phone).toBeDefined();
      expect(fields.otp).toBeDefined();
      expect(fields.newPassword).toBeDefined();
    }
  });
});
