'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { webGet } from '../../utils/webAPI';

interface FixedSessionResolveResponse {
  store_id: number;
  store_name: string;
}

export default function ClaimFixedLandingPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    webGet<FixedSessionResolveResponse>(`/api/web/v1/fixed-sessions/${params.token}/resolve/`)
      .then((data) => {
        router.replace(`/w/merchant/${data.store_id}?fixedSession=${params.token}`);
      })
      .catch(() => {
        setError('此 QR Code 已失效，請向店員確認。');
      });
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

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow mb-4" />
      <p className="text-gray-500 dark:text-zinc-400 text-sm">載入中…</p>
    </div>
  );
}
