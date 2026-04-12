const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function webGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function webPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = Object.assign(new Error(String(res.status)), { status: res.status, data });
    throw err;
  }
  return res.json();
}
