'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStoreDownloadHref } from '../utils/useAppStoreDownloadHref';
import { webPost } from '../utils/webAPI';

interface PointsLookupResponse {
  phone_number: string;
  total_points: number;
  threshold_reached: boolean;
}

function formatRedemptionTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const utc8Ms = parsed.getTime() + 8 * 60 * 60 * 1000;
  const utc8Date = new Date(utc8Ms);
  const pad2 = (num: number): string => String(num).padStart(2, '0');

  const year = utc8Date.getUTCFullYear();
  const month = pad2(utc8Date.getUTCMonth() + 1);
  const day = pad2(utc8Date.getUTCDate());
  const hour = pad2(utc8Date.getUTCHours());
  const minute = pad2(utc8Date.getUTCMinutes());
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function RedemptionTimeText({ value }: { value: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <>{formatRedemptionTime(value)}</>;
}

function RedemptionSummary({ couponName, redeemedAt }: { couponName: string; redeemedAt: string }) {
  if (!couponName && !redeemedAt) return null;

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left">
      <p className="text-xs font-semibold text-gray-500">本次核銷資訊</p>
      {couponName && <p className="mt-1 text-sm font-semibold text-gray-900">品項：{couponName}</p>}
      {redeemedAt && (
        <p className="mt-1 text-sm text-gray-700">
          時間：<RedemptionTimeText value={redeemedAt} />
        </p>
      )}
    </div>
  );
}
function PointsContent() {
  const searchParams = useSearchParams();
  const session = searchParams.get('session') ?? '';
  const couponName = searchParams.get('couponName') ?? '';
  const redeemedAt = searchParams.get('redeemedAt') ?? '';

  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<PointsLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await webPost<PointsLookupResponse>('/api/web/v1/points/lookup/', {
        phone_number: phone.trim(),
        ...(session ? { session_token: session } : {}),
      });
      setResult(data);
    } catch (e: unknown) {
      const data = e && typeof e === 'object' && 'data' in e ? (e as { data?: { error?: string } }).data : undefined;
      const msg = data?.error;
      setError(
        typeof msg === 'string' && msg.length > 0
          ? msg
          : '查詢失敗，請確認手機號碼後再試。',
      );
    } finally {
      setLoading(false);
    }
  };

  const appStoreUrl = useAppStoreDownloadHref();

  // Show result branch
  if (result) {
    const reached = result.threshold_reached;
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
        <div className="text-5xl">{reached ? '🎉' : '⭐'}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
            {reached ? '打開 CouPro，領取你的十元現金券' : `目前累積：${result.total_points} 點`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-3 leading-relaxed">
            {reached
              ? '恭喜！您已累積足夠點數，下載 CouPro App 即可查看並領取現金券。'
              : `再累積 ${3 - result.total_points} 次核銷即可解鎖現金券獎勵。下載 CouPro App 追蹤您的進度！`}
          </p>
        </div>
        <RedemptionSummary couponName={couponName} redeemedAt={redeemedAt} />
        <a
          href={appStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg text-center block cursor-pointer hover:brightness-[0.96] active:brightness-[0.92]"
        >
          立即下載 CouPro
        </a>
      </div>
    );
  }

  // Phone input screen
  return (
    <div className="flex flex-col flex-1 px-6 py-12 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">要累積點數嗎？</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">輸入手機號碼查看您的累積點數。</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-3 leading-relaxed px-1">
          註冊或登入 App 時請使用相同手機號碼，累積點數才會與您的帳號合併計算。
        </p>
      </div>
      <RedemptionSummary couponName={couponName} redeemedAt={redeemedAt} />

      <div className="flex flex-col gap-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09XXXXXXXX"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 caret-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-act-yellow focus:ring-2 focus:ring-act-yellow/30 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:caret-zinc-100 dark:placeholder:text-zinc-400"
          inputMode="numeric"
        />
        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !phone.trim()}
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg disabled:opacity-50 hover:brightness-[0.96] active:brightness-[0.92] enabled:cursor-pointer"
        >
          {loading ? '查詢中…' : '確認'}
        </button>
      </div>
    </div>
  );
}

export default function PointsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <PointsContent />
    </Suspense>
  );
}
