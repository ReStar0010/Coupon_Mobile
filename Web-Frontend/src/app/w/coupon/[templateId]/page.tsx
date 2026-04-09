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
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800 mb-4" />
        <p className="text-gray-500 text-sm">載入中…</p>
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

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{data.store.name}</p>
      <h1 className="text-2xl font-bold text-gray-900 leading-tight">{data.coupon_name}</h1>

      <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.coupon_detail}</p>
        {data.important_notes && (
          <>
            <hr className="border-gray-200" />
            <p className="text-xs text-gray-400 whitespace-pre-wrap">{data.important_notes}</p>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>有效期限：{new Date(data.expiry_date).toLocaleDateString('zh-TW')}</span>
        {data.estimated_savings && (
          <span className="text-orange-500 font-semibold">預計省 NT${data.estimated_savings}</span>
        )}
      </div>

      <button
        onClick={() => router.push(`/w/scanner${sessionParam}`)}
        className="mt-auto py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg"
      >
        核銷優惠券
      </button>
    </div>
  );
}

export default function CouponDetailPage({ params }: { params: { templateId: string } }) {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" /></div>}>
      <CouponDetailContent params={params} />
    </Suspense>
  );
}
