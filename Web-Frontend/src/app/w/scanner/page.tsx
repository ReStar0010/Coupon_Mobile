'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { webPost } from '../utils/webAPI';

type ScanState = 'scanning' | 'processing' | 'error_retry' | 'error_fatal' | 'denied';

interface RedemptionResponse {
  redemption_id: number;
  coupon_name: string;
  store_name: string;
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
  const attemptRef = useRef(0);

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
        await webPost<RedemptionResponse>('/api/web/v1/redemptions/', {
          ...(fixedSession ? { fixed_session_token: sessionToken } : { session_token: sessionToken }),
          template_id: selectedTemplateId,
        });
        router.push(`/w/redemption-success?session=${sessionToken}`);
      } catch (err: unknown) {
        handledRef.current = false;
        const status = (err as { status?: number }).status;
        if (status === 409) {
          router.push(`/w/redemption-success?session=${sessionToken}&already=1`);
          return;
        }
        const attempt = ++attemptRef.current;
        if (attempt >= 2) {
          setScanState('error_fatal');
        } else {
          setErrorMsg('核銷失敗，請再試一次。');
          setScanState('error_retry');
        }
      }
    },
    [fixedSession, router, selectedTemplateId, stopScanner],
  );

  const handleScanFailure = useCallback((message?: string) => {
    if (handledRef.current) return;
    const attempt = ++attemptRef.current;
    if (attempt >= 2) {
      stopScanner();
      setScanState('error_fatal');
    } else {
      setErrorMsg(message ?? '未能識別 QR Code，請對準後再試一次。');
      setScanState('error_retry');
    }
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    if (!mountedRef.current || !videoRef.current) return;
    handledRef.current = false;

    const { BrowserQRCodeReader } = await import('@zxing/browser');
    if (!mountedRef.current) return;

    const reader = new BrowserQRCodeReader();

    try {
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const backCamera = devices.find(
        (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'),
      );
      const deviceId = backCamera?.deviceId ?? devices[0]?.deviceId;

      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (!mountedRef.current || handledRef.current) return;
          if (result) {
            const token = extractSessionToken(result.getText());
            if (token) {
              // If session is preloaded from the claim flow, enforce scanning the same QR token.
              if (expectedSessionToken && token !== expectedSessionToken) {
                handleScanFailure('請掃描同一張入場 QR Code 才能完成核銷。');
                return;
              }
              handleSuccess(token);
            } else {
              handleScanFailure();
            }
          } else if (err && err.name !== 'NotFoundException') {
            handleScanFailure();
          }
        },
      );
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
  }, [expectedSessionToken, handleSuccess, handleScanFailure]);

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
    attemptRef.current = 0;
    setScanState('scanning');
    startScanner();
  };

  if (scanState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-4">
        <div className="text-5xl">📷</div>
        <h2 className="text-lg font-bold text-gray-800">需要相機權限</h2>
        <p className="text-sm text-gray-500">
          請在瀏覽器設定中允許存取相機，然後重新整理頁面。
        </p>
      </div>
    );
  }

  if (scanState === 'error_fatal') {
    router.replace('/w/error');
    return null;
  }

  if (scanState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        <p className="text-gray-600 font-medium">核銷中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-black relative">
      <video ref={videoRef} className="w-full flex-1 object-cover" muted playsInline />

      {/* Overlay frame */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="w-56 h-56 border-4 border-white rounded-2xl opacity-70" />
        <p className="text-white text-sm mt-4 bg-black/40 px-3 py-1 rounded-full">
          對準店家桌上的 QR Code
        </p>
      </div>

      {/* Retry toast */}
      {scanState === 'error_retry' && (
        <div className="absolute bottom-0 left-0 right-0 bg-white px-6 py-5 flex flex-col gap-3 rounded-t-2xl shadow-lg">
          <p className="text-sm text-gray-700 text-center">{errorMsg}</p>
          <button
            onClick={retry}
            className="py-3 rounded-2xl bg-gray-900 text-white font-semibold text-base"
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
    <Suspense fallback={<div className="flex flex-col items-center justify-center flex-1"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" /></div>}>
      <ScannerContent />
    </Suspense>
  );
}
