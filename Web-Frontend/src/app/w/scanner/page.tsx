'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { webPost } from '../utils/webAPI';

type ScanState = 'scanning' | 'processing' | 'error_retry' | 'error_fatal' | 'denied';

interface RedemptionResponse {
  redemption_id: number;
  coupon_name: string;
  store_name: string;
  redeemed_at: string;
}

interface ScanControls {
  stop: () => void;
}

function extractSessionToken(text: string): string | null {
  const match = text.match(/\/(?:w\/)?claim(?:-fixed)?\/([^/?#]+)\/?/);
  if (match) return match[1];

  // Backward-compatible fallback for deep links like coupro://claim?token=...
  const queryToken = text.match(/[?&]token=([^&#]+)/);
  return queryToken ? decodeURIComponent(queryToken[1]) : null;
}

/** Prefer rear/environment camera when labels are missing (common on Safari before/without permission). */
function pickPreferredVideoDeviceId(
  devices: Array<{ deviceId: string; label: string }>,
): string | undefined {
  if (devices.length === 0) return undefined;
  const score = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('後')) {
      return 0;
    }
    if (
      l.includes('front') ||
      l.includes('user') ||
      l.includes('facetime') ||
      l.includes('自拍') ||
      l.includes('前')
    ) {
      return 2;
    }
    return 1;
  };
  const sorted = [...devices].sort((a, b) => score(a.label) - score(b.label));
  return sorted[0]?.deviceId;
}

/** Only for repeatedly scanning a different table QR than the one from the claim flow (actionable user error). */
const WRONG_ENTRY_QR_BEFORE_FATAL = 8;
const API_FAILS_BEFORE_FATAL = 3;

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadedSession = searchParams.get('session') ?? '';
  const fixedSession = searchParams.get('fixedSession') ?? '';
  const selectedTemplateRaw = searchParams.get('template') ?? '';
  const selectedTemplateId = Number(selectedTemplateRaw);
  const expectedSessionToken = fixedSession || preloadedSession;

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScanControls | null>(null);
  const mountedRef = useRef(true);
  const handledRef = useRef(false);

  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMsg, setErrorMsg] = useState('');
  const scanFailCountRef = useRef(0);
  const apiFailCountRef = useRef(0);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback(
    async (sessionToken: string) => {
      if (!mountedRef.current || handledRef.current) return;
      if (!Number.isInteger(selectedTemplateId) || selectedTemplateId <= 0) {
        setErrorMsg('缺少優惠券資訊，請返回上一頁重新選擇。');
        setScanState('error_retry');
        return;
      }
      handledRef.current = true;
      setScanState('processing');
      stopScanner();
      try {
        const redemption = await webPost<RedemptionResponse>('/api/web/v1/redemptions/', {
          ...(fixedSession ? { fixed_session_token: sessionToken } : { session_token: sessionToken }),
          template_id: selectedTemplateId,
        });
        const params = new URLSearchParams();
        params.set('session', sessionToken);
        params.set('couponName', redemption.coupon_name);
        params.set('redeemedAt', redemption.redeemed_at);
        router.push(`/w/redemption-success?${params.toString()}`);
      } catch (err: unknown) {
        handledRef.current = false;
        const status = (err as { status?: number }).status;
        if (status === 409) {
          router.push(`/w/redemption-success?session=${sessionToken}&already=1`);
          return;
        }
        const n = ++apiFailCountRef.current;
        if (n >= API_FAILS_BEFORE_FATAL) {
          setScanState('error_fatal');
        } else {
          setErrorMsg('核銷失敗，請再試一次。');
          setScanState('error_retry');
        }
      }
    },
    [fixedSession, router, selectedTemplateId, stopScanner],
  );

  const handleWrongEntryToken = useCallback((message: string) => {
    if (handledRef.current) return;
    const n = ++scanFailCountRef.current;
    if (n >= WRONG_ENTRY_QR_BEFORE_FATAL) {
      stopScanner();
      setScanState('error_fatal');
    } else {
      setErrorMsg(message);
      setScanState('error_retry');
    }
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    if (!mountedRef.current || !videoRef.current) return;
    handledRef.current = false;

    const { BrowserQRCodeReader } = await import('@zxing/browser');
    if (!mountedRef.current) return;

    const reader = new BrowserQRCodeReader();

    const onDecode = (result: { getText: () => string } | undefined, _err: Error | undefined) => {
      if (!mountedRef.current || handledRef.current) return;
      if (result) {
        const token = extractSessionToken(result.getText());
        if (token) {
          if (expectedSessionToken && token !== expectedSessionToken) {
            handleWrongEntryToken('請掃描同一張入場 QR Code 才能完成核銷。');
            return;
          }
          handleSuccess(token);
          return;
        }
        return;
      }
      // Continuous scan: ignore decode noise between frames (NotFoundException and others).
    };

    try {
      const videoEl = videoRef.current;
      let controls: ScanControls;

      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoEl,
          onDecode,
        );
      } catch (constraintErr: unknown) {
        const cname = (constraintErr as { name?: string }).name;
        if (cname === 'NotAllowedError' || cname === 'PermissionDeniedError') {
          throw constraintErr;
        }
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        const deviceId = pickPreferredVideoDeviceId(devices);
        controls = await reader.decodeFromVideoDevice(deviceId, videoEl, onDecode);
      }

      controlsRef.current = controls;
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      const name = (e as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setScanState('denied');
      } else {
        setScanState('error_fatal');
      }
    }
  }, [expectedSessionToken, handleSuccess, handleWrongEntryToken]);

  useEffect(() => {
    if (scanState !== 'error_fatal') return;
    router.replace('/w/error');
  }, [scanState, router]);

  useEffect(() => {
    mountedRef.current = true;
    startScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    scanFailCountRef.current = 0;
    apiFailCountRef.current = 0;
    setScanState('scanning');
    startScanner();
  };

  if (scanState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-4">
        <div className="text-5xl">📷</div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-zinc-100">需要相機權限</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          請在瀏覽器設定中允許存取相機，然後重新整理頁面。
        </p>
      </div>
    );
  }

  if (scanState === 'error_fatal') {
    return null;
  }

  if (scanState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-act-yellow" />
        <p className="text-gray-600 dark:text-zinc-300 font-medium">核銷中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-black relative">
      <video ref={videoRef} className="w-full flex-1 object-cover" muted playsInline />

      {/* Overlay frame */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="w-56 h-56 border-4 border-act-yellow rounded-2xl opacity-90" />
        <p className="text-white text-sm mt-4 bg-black/40 px-3 py-1 rounded-full">
          對準店家桌上的 QR Code
        </p>
        <p className="text-white/80 text-xs mt-2 bg-black/40 px-3 py-1 rounded-full max-w-[90%] text-center leading-snug">
          {'系統會優先使用背面相機。若畫面是自拍鏡頭，請翻轉手機或重新整理頁面。'}
        </p>
      </div>

      {/* Retry toast */}
      {scanState === 'error_retry' && (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 px-6 py-5 flex flex-col gap-3 rounded-t-2xl shadow-lg border-t border-gray-200 dark:border-zinc-700">
          <p className="text-sm text-gray-700 dark:text-zinc-200 text-center">{errorMsg}</p>
          <button
            onClick={retry}
            className="py-3 rounded-2xl bg-act-yellow text-sec-black font-semibold text-base hover:brightness-[0.96] active:brightness-[0.92]"
          >
            再試一次
          </button>
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-act-yellow" /></div>}>
      <ScannerContent />
    </Suspense>
  );
}
