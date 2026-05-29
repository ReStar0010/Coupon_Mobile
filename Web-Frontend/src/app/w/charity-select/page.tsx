'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Charity {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

const CHARITIES: Charity[] = [
  {
    id: 'taiwan-fund-children',
    name: '台灣兒童暨家庭扶助基金會',
    description: '幫助弱勢兒童與家庭，提供生活、教育及心理輔導支持。',
    emoji: '🧒',
  },
  {
    id: 'tzu-chi',
    name: '佛教慈濟慈善事業基金會',
    description: '全球急難救助與醫療、教育、環保慈善服務。',
    emoji: '🙏',
  },
  {
    id: 'world-vision',
    name: '台灣世界展望會',
    description: '資助貧困地區兒童與社區，促進永續發展。',
    emoji: '🌍',
  },
  {
    id: 'taiwan-red-cross',
    name: '中華民國紅十字會',
    description: '緊急救援、血液服務及人道關懷援助。',
    emoji: '🏥',
  },
];

function CharitySelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const couponName = searchParams.get('couponName') ?? '';

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
  };

  if (confirmed) {
    const charity = CHARITIES.find((c) => c.id === selected);
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
        <div className="text-6xl">❤️</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">感謝您的愛心！</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
            您的捐贈將送往
          </p>
          <p className="text-base font-semibold text-gray-800 dark:text-zinc-200 mt-1">
            {charity?.emoji} {charity?.name}
          </p>
          {couponName && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-3">
              優惠券：{couponName}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push('/w/soft-sell')}
          className="w-full py-4 rounded-2xl bg-act-yellow text-sec-black font-bold text-lg hover:brightness-[0.96] active:brightness-[0.92]"
        >
          立即下載 CouPro
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 px-4 py-6 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">選擇捐贈對象</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          您的消費將捐贈給以下慈善機構
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {CHARITIES.map((charity) => {
          const isSelected = selected === charity.id;
          return (
            <button
              key={charity.id}
              type="button"
              onClick={() => setSelected(charity.id)}
              className={[
                'w-full text-left rounded-2xl border-2 px-4 py-4 transition-colors',
                isSelected
                  ? 'border-act-yellow bg-act-yellow/10 dark:bg-act-yellow/10'
                  : 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/80 hover:border-act-yellow/50',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none mt-0.5">{charity.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      'font-semibold text-sm leading-snug',
                      isSelected
                        ? 'text-gray-900 dark:text-zinc-100'
                        : 'text-gray-800 dark:text-zinc-200',
                    ].join(' ')}
                  >
                    {charity.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {charity.description}
                  </p>
                </div>
                <span
                  className={[
                    'mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    isSelected
                      ? 'border-act-yellow bg-act-yellow'
                      : 'border-gray-300 dark:border-zinc-600',
                  ].join(' ')}
                >
                  {isSelected && (
                    <span className="block h-2 w-2 rounded-full bg-sec-black" />
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <button
          onClick={handleConfirm}
          disabled={!selected}
          className={[
            'w-full py-4 rounded-2xl font-bold text-lg transition-opacity',
            selected
              ? 'bg-act-yellow text-sec-black hover:brightness-[0.96] active:brightness-[0.92]'
              : 'bg-act-yellow/40 text-sec-black/50 cursor-not-allowed',
          ].join(' ')}
        >
          確認捐贈
        </button>
      </div>
    </div>
  );
}

export default function CharitySelectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" />
        </div>
      }
    >
      <CharitySelectContent />
    </Suspense>
  );
}
