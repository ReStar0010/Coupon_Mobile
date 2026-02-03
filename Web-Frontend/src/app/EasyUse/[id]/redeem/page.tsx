"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import SuccessPopup from "./SuccessPopup";
import { devDebug } from "@/app/utils/devLogger";
import { fetchAPI } from "@/app/utils/authAPI";

// Define the coupon interface
interface Coupon {
  id: number;
  store_name: string;
  coupon_detail: string;
  coupon_name: string;
  // Add other properties as needed
}

export default function Redeem({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [message, setMessage] = useState("");
  const [inputError, setInputError] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const onGoBackContainerClick = useCallback(() => {
    router.push(`/EasyUse/${id}`);
  }, [router, id]);

  const handleCloseSuccessPopup = useCallback(() => {
    setShowSuccessConfirmation(false);
    // Redirect to main EasyUse page after successful redemption
    router.push("/EasyUse");
  }, [router]);

  useEffect(() => {
    const fetchCoupon = async () => {
      setMessage("");
      try {

        const response = await fetchAPI(`/coupons/${id}/`, { method: "GET", withCredentials: true}); 

        if (response.data.coupon_type === "store") {
          router.push(`/EasyUse/${id}`);
          return;
        }

        setCoupon(response.data);
      } catch (error) {
        console.error("Failed to fetch coupon:", error);
        setMessage("無法載入優惠券資料");
        setCoupon(null);
      }
    };
    fetchCoupon();
  }, [id, router]);

  const handleSubmitCode = async () => {
    setInputError(false);
    setMessage("");
    setIsLoading(true);

    try {
      // Send the request with credentials included to ensure cookies are sent

      const response = await fetchAPI(
        `/redeem/${id}/`,
        {
          method: "POST",
          data: JSON.stringify({ redeem_code: redeemCode }),
          withCredentials: true,
        }
      );

      // Process the successful response
      devDebug("兌換成功", response.data);
      setInputError(false);
      setShowSuccessConfirmation(true);
      setRedeemCode("");
    } catch (error) {
      console.error("處理錯誤:", error);

      // Handle axios error responses
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with an error status
          if (error.response.status === 401) {
            setMessage("登入已過期或未登入，請重新登入");
            setTimeout(() => {
              router.push("/Login");
            }, 2000);
          } else if (error.response.data && error.response.data.error) {
            setMessage(error.response.data.error);
          } else {
            setMessage(`兌換失敗: ${error.response.statusText}`);
          }
        } else if (error.request) {
          // The request was made but no response was received
          setMessage("無法連接到伺服器，請檢查網路連接");
        } else {
          // Something happened in setting up the request
          setMessage("發生錯誤，請稍後再試");
        }
      } else {
        setMessage(error instanceof Error ? error.message : "發生錯誤，請稍後再試");
      }

      setInputError(true);
    } finally {
      setIsLoading(false);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRedeemCode(e.target.value.slice(0, 6));
    if (inputError) {
      setInputError(false);
    }
    setMessage("");
  };

  if (!coupon && !message)
    return <div className="text-center mt-10">載入中...</div>;
  if (!coupon && message)
    return <div className="text-center mt-10 text-red-500">{message}</div>;

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-start pt-[35px] px-4">
      {/* Back Button */}{" "}
      <div
        className="flex items-center gap-2 cursor-pointer mb-10 self-start"
        onClick={onGoBackContainerClick}
      >
        <Image
          src="/forward@2x.png"
          alt="返回"
          width={16}
          height={16}
          className="w-4 h-4 object-contain"
        />
        <span className="text-sec-black text-sm">返回</span>
      </div>
      {/* Redeem Code Input */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white shadow-md rounded-xl w-3/4 max-w-md p-6 flex flex-col items-center justify-center">
        <div className="w-full">
          <input
            type="text"
            value={redeemCode}
            onChange={handleInputChange}
            placeholder="請輸入6位兌換碼"
            maxLength={6}
            className={`w-full border rounded-lg py-2 px-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-act-yellow bg-gray-100 text-sec-black ${
              inputError ? "border-red-500" : "border-gray-300"
            }`}
            disabled={isLoading}
          />
          {/* Error message */}
          {inputError && message && (
            <p className="text-red-500 text-sm mt-1 text-center">{message}</p>
          )}
          <button
            onClick={handleSubmitCode}
            disabled={
              redeemCode.length !== 6 || showSuccessConfirmation || isLoading
            }
            className={`text-sec-black font-bold py-2 px-6 rounded-lg shadow transition mt-4 w-full ${
              redeemCode.length === 6 && !showSuccessConfirmation && !isLoading
                ? "bg-act-yellow hover:bg-act-yellow-dark"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? "處理中..." : "確認"}
          </button>
        </div>
      </div>
      {/* Success Confirmation Popup */}
      <SuccessPopup
        isOpen={showSuccessConfirmation}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponName={coupon?.coupon_name}
        couponDetail={coupon?.coupon_detail}
        titleType="核銷成功"
      />
    </div>
  );
}
