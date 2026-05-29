'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// TODO: restore real scanner — replaced with stub button for Vercel preview testing

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') ?? '';
  const template = searchParams.get('template') ?? '';

  const handleSimulate = () => {
    const params = new URLSearchParams();
    params.set('session', 'preview-stub-token');
    params.set('couponName', '買一送一咖啡優惠券');
    params.set('redeemedAt', new Date().toISOString());
    if (mode) params.set('mode', mode);
    router.push(`/w/redemption-success?${params.toString()}`);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-6 text-center">
      <div className="text-6xl">📷</div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">掃描器（測試模式）</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
          {mode === 'donate' ? '捐贈流程' : '核銷流程'} · 優惠券 #{template || '?'}
        </p>
      </div>
      <button
        onClick={handleSimulate}
        className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
      >
        模擬核銷成功
      </button>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <ScannerContent />
    </Suspense>
  );
}
