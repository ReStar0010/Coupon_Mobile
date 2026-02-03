"use client";

import React, { useState, useEffect } from "react";
import SuccessPopup from "../../EasyUse/[id]/redeem/SuccessPopup";
import { DailyDrawResult } from "@/app/Collection/utils/types";

interface DailyDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDraw: () => void;
  onDrawComplete: () => void;
  result: DailyDrawResult | null;
  isLoading: boolean;
  templatesAvailable: number;
}

const DailyDrawModal: React.FC<DailyDrawModalProps> = ({
  isOpen,
  onClose,
  onDraw,
  onDrawComplete,
  result,
  isLoading,
  templatesAvailable,
}) => {
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  useEffect(() => {
    if (isOpen && templatesAvailable === 0) {
      setIsLoadingTemplates(true);
      const timer = setTimeout(() => {
        setIsLoadingTemplates(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, templatesAvailable]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl max-w-[90%] w-[350px] text-center">
        {!result ? (
          <>
            <h3 className="text-xl font-bold mb-4">每日抽獎</h3>
            {isLoading ? (
              <p className="mb-4">抽獎中，請稍候...</p>
            ) : templatesAvailable === 0 && isLoadingTemplates ? (
              <p className="mb-4">正在載入可用優惠，請稍候...</p>
            ) : templatesAvailable === 0 ? (
              <p className="mb-4">目前沒有可用的優惠券</p>
            ) : (
              <p className="mb-4 text-sm text-gray-600">
                目前有 {templatesAvailable} 個優惠可抽
              </p>
            )}
            <button
              onClick={onDraw}
              disabled={isLoading || templatesAvailable === 0}
              className={`rounded-lg px-6 py-3 text-lg font-semibold w-full ${
                isLoading || templatesAvailable === 0
                  ? "bg-gray-300"
                  : "bg-act-yellow"
              }`}
            >
              {isLoading
                ? "抽獎中..."
                : templatesAvailable === 0 && !isLoadingTemplates
                  ? "無可用優惠"
                  : "立即抽獎"}
            </button>
            <button onClick={onClose} className="mt-4 text-gray-500 text-sm">
              下次再抽
            </button>
          </>
        ) : (
          <SuccessPopup
            isOpen={true}
            onClose={() => {
              onDrawComplete();
            }}
            storeName={result.success ? "恭喜抽中" : "明天再加油"}
            couponName={
              result.success && result.coupon
                ? result.coupon.name
                : "今天沒有抽中"
            }
            titleType={result.success ? "抽獎成功" : "抽獎結果"}
          />
        )}
      </div>
    </div>
  );
};

export default DailyDrawModal;
