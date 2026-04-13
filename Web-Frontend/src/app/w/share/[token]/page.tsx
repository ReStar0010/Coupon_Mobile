'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { webGet } from '../../utils/webAPI';

interface ShareDetailResponse {
  coupon_id: number;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  image_url?: string;
  expiry_date: string;
  estimated_savings?: string;
  template_id?: number;
  store: { id: number; name: string };
}

export default function ShareLandingPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ShareDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    webGet<ShareDetailResponse>(`/api/web/v1/shares/${params.token}/`)
      .then((d) => {
        if (d.template_id) {
          router.replace(`/w/coupon/${d.template_id}`);
        } else {
          setData(d);
        }
      })
      .catch(() => setError('連結已失效或優惠券不存在。'));
  }, [params.token, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-zinc-100 mb-2">連結無效</h1>
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

  // Fallback: coupon has no template FK — render inline
  return (
    <div className="flex flex-col flex-1 px-4 py-6 gap-4">
      {data.image_url && (
        <div className="relative w-full h-44 rounded-xl overflow-hidden">
          <Image src={data.image_url} alt={data.coupon_name} fill className="object-cover" />
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-zinc-400">{data.store.name}</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{data.coupon_name}</h1>
      <p className="text-sm text-gray-700 dark:text-zinc-200 whitespace-pre-wrap">{data.coupon_detail}</p>
      {data.important_notes && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 whitespace-pre-wrap">{data.important_notes}</p>
      )}
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        有效期限：{new Date(data.expiry_date).toLocaleDateString('zh-TW')}
      </p>
      <button
        onClick={() => router.push(`/w/scanner`)}
        className="mt-auto py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
      >
        核銷優惠券
      </button>
    </div>
  );
}
