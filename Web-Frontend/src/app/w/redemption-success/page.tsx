'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const POINTS_ENABLED = process.env.NEXT_PUBLIC_WEB_FLOW_POINTS_ENABLED === 'true';

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

function RedemptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session') ?? '';
  const couponName = searchParams.get('couponName') ?? '';
  const redeemedAt = searchParams.get('redeemedAt') ?? '';
  const already = searchParams.get('already') === '1';
  const mode = searchParams.get('mode') ?? '';
  const isDonate = mode === 'donate';

  const onAccumulatePoints = () => {
    const params = new URLSearchParams();
    if (session) params.set('session', session);
    if (couponName) params.set('couponName', couponName);
    if (redeemedAt) params.set('redeemedAt', redeemedAt);

    if (POINTS_ENABLED) {
      const query = params.toString();
      router.push(`/w/points${query ? `?${query}` : ''}`);
    } else {
      router.push('/w/soft-sell');
    }
  };

  const onSelectCharity = () => {
    const params = new URLSearchParams();
    if (session) params.set('session', session);
    if (couponName) params.set('couponName', couponName);
    if (redeemedAt) params.set('redeemedAt', redeemedAt);
    const query = params.toString();
    router.push(`/w/charity-select${query ? `?${query}` : ''}`);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
      <div className="text-6xl">✅</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
          {already ? '已核銷' : '核銷成功！'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
          {already
            ? '此優惠券已於先前核銷。'
            : '優惠券已成功核銷，請向店員出示此畫面。'}
        </p>
      </div>
      {(couponName || redeemedAt) && (
        <div className="w-full rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80 px-4 py-3 text-left">
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400">本次核銷資訊</p>
          {couponName && (
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">品項：{couponName}</p>
          )}
          {redeemedAt && (
            <p className="mt-1 text-sm text-gray-700 dark:text-zinc-300">
              時間：<RedemptionTimeText value={redeemedAt} />
            </p>
          )}
        </div>
      )}
      {isDonate ? (
        <button
          onClick={onSelectCharity}
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
        >
          選擇捐贈機構
        </button>
      ) : (
        <button
          onClick={onAccumulatePoints}
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
        >
          累積點數
        </button>
      )}
    </div>
  );
}

export default function RedemptionSuccessPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <RedemptionSuccessContent />
    </Suspense>
  );
}
