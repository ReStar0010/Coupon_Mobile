import React, { useState, useEffect, useRef } from "react";

interface SavingsGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goalName: string, goalAmount: number, goalImage: string) => void;
  currentGoalName?: string;
  currentGoalAmount?: number;
  currentGoalImage?: string;
}

const SavingsGoalModal: React.FC<SavingsGoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentGoalName = "",
  currentGoalAmount = 0,
  currentGoalImage = "",
}) => {
  const [customGoalName, setCustomGoalName] = useState("");
  const [customGoalAmount, setCustomGoalAmount] = useState("");
  const [customGoalImage, setCustomGoalImage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const defaultImage = "/Info.png"; // Default image URL

  useEffect(() => {
    if (isOpen) {
      // If there's a current goal, set it as the custom goal
      if (currentGoalName) {
        setCustomGoalName(currentGoalName);
        setCustomGoalAmount(currentGoalAmount.toString());
        setCustomGoalImage(currentGoalImage || defaultImage);
      } else {
        // Reset fields if no current goal
        setCustomGoalName("");
        setCustomGoalAmount("");
        setCustomGoalImage("");
      }
    }
  }, [isOpen, currentGoalName, currentGoalAmount, currentGoalImage]);

  // Handle click outside to close the modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    // Add the event listener when the modal is open
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    if (!customGoalName || !customGoalAmount) {
      alert("請輸入目標名稱和金額");
      return;
    }

    const amount = parseFloat(customGoalAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("請輸入有效的金額");
      return;
    }

    onSave(customGoalName, amount, customGoalImage || defaultImage);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">設定儲蓄目標</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-2">請輸入你想要達成的目標名稱（如：音樂平台訂閱），範例名稱僅供參考，與該品牌無直接合作關係。</p>

          <div className="space-y-3 pt-3">
            <div>
              <label className="block text-sm font-medium text-sec-black mb-1">
          目標名稱
              </label>
              <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sec-black"
          placeholder="例如：Spotify"
          value={customGoalName}
          onChange={(e) => setCustomGoalName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sec-black mb-1">
          金額 (元)
              </label>
              <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sec-black"
          placeholder="例如：50"
          value={customGoalAmount}
          onChange={(e) => setCustomGoalAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sec-black mb-1">
          圖片網址 (選填)
              </label>
              <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sec-black"
          placeholder="例如：https://th.bing.com/th/id/OIP.bjKovNUdme74NCNt3MOPNgHaEK?w=296&h=180&c=7&r=0&o=7&cb=iwp1&pid=1.7&rm=3"
          value={customGoalImage}
          onChange={(e) => setCustomGoalImage(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sec-black bg-act-yellow rounded-md hover:scale-[1.02]"
          >
            儲存目標
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavingsGoalModal;
