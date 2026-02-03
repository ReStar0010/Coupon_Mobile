"use client";
import React from "react";
import { SuccessIcon } from "./SuccessIcon"; // 確認路徑正確
import { ConfirmationCard } from "./ConfirmationCard"; // 確認路徑正確

interface SuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  couponDetail?: string;
  couponName?: string;
  titleType?: string; // 標題類型
}

const SuccessPopup: React.FC<SuccessPopupProps> = ({
  isOpen,
  onClose,
  storeName = "店家名稱", // 提供預設值
  couponDetail = "優惠詳情", // 提供預設值
  couponName = "優惠名稱", // 預設為空字串
  titleType = "核銷成功",
}) => {
  if (!isOpen) return null;

  return (
    // Modal 遮罩層
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="relative max-w-sm w-full">
        <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
           <SuccessIcon />
        </div>
        <ConfirmationCard
          title = {titleType} // 標題類型
          // message={[storeName, `「 ${couponDetail} 」`]} // 動態顯示店家和優惠內容
          message={[storeName, `「 ${couponName} 」`]} // 動態顯示店家和優惠內容
          onConfirm={onClose} // OK 按鈕觸發關閉彈窗
        />
      </div>
    </div>
  );
};

export default SuccessPopup;
