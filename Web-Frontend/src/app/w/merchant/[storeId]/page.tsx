'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { webGet } from '../../utils/webAPI';

interface Coupon {
  id: number;
  coupon_name: string;
  coupon_detail: string;
  image_url?: string;
  expiry_date: string;
  estimated_savings?: string;
}

interface MerchantCouponsResponse {
  store: { id: number; name: string; image_url?: string; address?: string };
  coupons: Coupon[];
}

function CouponCard({
  coupon,
  onTap,
}: {
  coupon: Coupon;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm dark:shadow-none border border-transparent dark:border-zinc-700 p-3 text-left"
    >
      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-zinc-700">
        {coupon.image_url ? (
          <Image src={coupon.image_url} alt={coupon.coupon_name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">🎟</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">{coupon.coupon_name}</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{coupon.coupon_detail}</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          期限：{new Date(coupon.expiry_date).toLocaleDateString('zh-TW')}
        </p>
      </div>
      {coupon.estimated_savings && (
        <span className="shrink-0 text-sm font-bold text-act-yellow">
          省 {coupon.estimated_savings}
        </span>
      )}
    </button>
  );
}

function MerchantContent({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = searchParams.get('session') ?? '';
  const fixedSession = searchParams.get('fixedSession') ?? '';

  const [data, setData] = useState<MerchantCouponsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    webGet<MerchantCouponsResponse>(`/api/web/v1/merchants/${params.storeId}/coupons/`)
      .then(setData)
      .catch(() => setError('無法載入店家資訊，請稍後再試。'));
  }, [params.storeId]);

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
    ? `?session=${session}`
    : fixedSession
      ? `?fixedSession=${fixedSession}`
      : '';

  return (
    <div className="flex flex-col flex-1 bg-bg-grey dark:bg-transparent">
      {/* Store header */}
      <div className="bg-white dark:bg-zinc-900 px-4 pt-8 pb-4 flex items-center gap-3 shadow-sm border-b border-gray-100 dark:border-zinc-800">
        {data.store.image_url && (
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <Image src={data.store.image_url} alt={data.store.name} fill className="object-cover" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{data.store.name}</h1>
          {data.store.address && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{data.store.address}</p>
          )}
        </div>
      </div>

      {/* Coupon list */}
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="text-sm font-semibold text-gray-600 dark:text-zinc-300">可用優惠券</p>
        {data.coupons.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">目前沒有可用的優惠券。</p>
        ) : (
          data.coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onTap={() => router.push(`/w/coupon/${c.id}${sessionParam}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function MerchantPage({ params }: { params: { storeId: string } }) {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <MerchantContent params={params} />
    </Suspense>
  );
}
