'use client';
import { useRouter } from 'next/navigation';

export default function ScanErrorPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-6">
      <div className="text-6xl">❌</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">核銷失敗</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-3 leading-relaxed">
          無法完成核銷，請向店員出示此頁面，由店員協助手動核銷。
        </p>
      </div>
      <button
        onClick={() => {
          if (window.history.length > 2) {
            router.back();
          } else {
            window.close();
          }
        }}
        className="w-full py-4 rounded-2xl border-2 border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-200 font-semibold text-base"
      >
        關閉
      </button>
    </div>
  );
}
