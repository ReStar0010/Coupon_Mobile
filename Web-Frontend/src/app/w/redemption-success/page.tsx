'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const POINTS_ENABLED = process.env.NEXT_PUBLIC_WEB_FLOW_POINTS_ENABLED === 'true';

function RedemptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session') ?? '';
  const already = searchParams.get('already') === '1';

  const onAccumulatePoints = () => {
    if (POINTS_ENABLED) {
      router.push(`/w/points${session ? `?session=${session}` : ''}`);
    } else {
      router.push('/w/soft-sell');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
      <div className="text-6xl">✅</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {already ? '已核銷' : '核銷成功！'}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {already
            ? '此優惠券已於先前核銷。'
            : '優惠券已成功核銷，請向店員出示此畫面。'}
        </p>
      </div>
      <button
        onClick={onAccumulatePoints}
        className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
      >
        累積點數
      </button>
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
