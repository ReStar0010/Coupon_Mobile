'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { webGet } from '../../utils/webAPI';

interface CouponDetailResponse {
  id: number;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  image_url?: string;
  expiry_date: string;
  estimated_savings?: string;
  store: { id: number; name: string; image_url?: string };
}

function CouponDetailContent({ params }: { params: { templateId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session') ?? '';
  const fixedSession = searchParams.get('fixedSession') ?? '';

  const [data, setData] = useState<CouponDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    webGet<CouponDetailResponse>(`/api/web/v1/coupons/${params.templateId}/`)
      .then(setData)
      .catch(() => setError('無法載入優惠券資訊，請稍後再試。'));
  }, [params.templateId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-gray-500 dark:text-zinc-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow mb-4" />
        <p className="text-gray-500 dark:text-zinc-400 text-sm">載入中…</p>
      </div>
    );
  }

  const sessionParam = session
    ? `?session=${session}&template=${params.templateId}`
    : fixedSession
      ? `?fixedSession=${fixedSession}&template=${params.templateId}`
      : `?template=${params.templateId}`;

  return (
    <div className="flex flex-col flex-1 px-4 py-6 gap-4">
      {data.image_url && (
        <div className="relative w-full h-44 rounded-2xl overflow-hidden">
          <Image src={data.image_url} alt={data.coupon_name} fill className="object-cover" />
        </div>
      )}

      <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{data.store.name}</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">{data.coupon_name}</h1>

      <div className="bg-gray-50 dark:bg-zinc-800/80 rounded-2xl p-4 flex flex-col gap-2 border border-transparent dark:border-zinc-700">
        <p className="text-sm text-gray-700 dark:text-zinc-200 whitespace-pre-wrap">{data.coupon_detail}</p>
        {data.important_notes && (
          <>
            <hr className="border-gray-200 dark:border-zinc-600" />
            <p className="text-xs text-gray-400 dark:text-zinc-500 whitespace-pre-wrap">{data.important_notes}</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500 px-1">
        <span>有效期限：{new Date(data.expiry_date).toLocaleDateString('zh-TW')}</span>
        {data.estimated_savings && (
          <span className="text-act-yellow font-semibold">預計省 NT${data.estimated_savings}</span>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => router.push(`/w/scanner${sessionParam}`)}
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
        >
          核銷優惠券
        </button>
        <button
          onClick={() => {
            const donateParam = sessionParam.includes('?')
              ? `${sessionParam}&mode=donate`
              : `${sessionParam}?mode=donate`;
            router.push(`/w/scanner${donateParam}`);
          }}
          className="w-full py-4 rounded-2xl border-2 border-act-yellow text-act-yellow font-bold text-lg hover:bg-act-yellow/10 active:bg-act-yellow/20"
        >
          捐贈
        </button>
      </div>
    </div>
  );
}

export default function CouponDetailPage({ params }: { params: { templateId: string } }) {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <CouponDetailContent params={params} />
    </Suspense>
  );
}
