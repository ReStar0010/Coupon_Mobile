'use client';

function getAppStoreUrl(): string {
  if (typeof navigator === 'undefined') return process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#';
  return process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#';
}

export default function SoftSellPage() {
  const appStoreUrl = getAppStoreUrl();

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
      <div className="text-6xl">🏆</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">進到 App，查看累積點數</h1>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          下載 CouPro App，追蹤您的優惠使用紀錄、累積點數，並在達標後領取現金券！
        </p>
      </div>
      <a
        href={appStoreUrl}
        className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg text-center block"
      >
        立即下載 CouPro
      </a>
    </div>
  );
}
