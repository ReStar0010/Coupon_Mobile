'use client';

import { getAppStoreUrl } from '../utils/appStoreUrl';

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
        className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg text-center block hover:brightness-[0.96] active:brightness-[0.92]"
      >
        立即下載 CouPro
      </a>
    </div>
  );
}
