"use client";
import React, { useEffect, useState } from "react";
import { FunctionComponent, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import SuccessPopup from "./redeem/SuccessPopup";
import { isUserLoggedIn, fetchAPI } from "@/app/utils/authAPI";
import { devLog } from "@/app/utils/devLogger";

export type CouponDetailType = {
  id: number;
  store_name: string;
  store_id: number;
  store_location: {
    lat: number;
    lng: number;
  };
  address: string;
  active_coupon_count: number;
  has_active_coupons: boolean;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: "store" | "exclusive";
  last_holder_email?: string; // For exclusive coupons, the last holder's name
  is_redeemed: boolean;
  can_use_today: boolean;
};

const Verify: FunctionComponent = () => {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");
  const [coupon, setCoupon] = useState<CouponDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const fetchCouponDetail = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetchAPI(`/coupons/${id}/`, {
            method: "GET",
            withCredentials: true,
          });

          devLog("Fetched coupon details:", response.data);

          setCoupon(response.data);
        } catch (err) {
          console.error("Error fetching coupon details:", err);
          let errorMessage = "無法載入優惠券詳情。";
          if (axios.isAxiosError(err)) {
            if (err.response?.status === 404) {
              errorMessage = "找不到此優惠券。";
            } else if (err.response?.status === 401) {
              errorMessage = "請先登入以查看此優惠券。";
            } else {
              errorMessage = `載入錯誤: ${err.message}`;
            }
          } else if (err instanceof Error) {
            errorMessage = err.message;
          }
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCouponDetail();
    } else {
      setError("無效的優惠券 ID。");
      setIsLoading(false);
    }
  }, [id]);

  const onGoBackContainerClick = useCallback(() => {
    // Navigate based on source parameter
    if (sourceParam === "collection") {
      router.push("/Collection");
    } else {
      router.push("/EasyUse");
    }
  }, [router, sourceParam]);

  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const onButtonClick = async () => {
    if (coupon) {
      if (coupon.coupon_type === "store") {
        // Track the store visit before opening Google Maps

        // Open Google Maps regardless of tracking success
        if (coupon.store_location) {
          const { lat, lng } = coupon.store_location;
          const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
          window.open(url, "_blank");
        }

        // This works for both authenticated and anonymous users
        try {
          await fetchAPI(`/visit-store/${coupon.id}/`, {
            method: "POST",
          });
          devLog("Store visit tracked successfully");
        } catch (error) {
          // Don't block the Google Maps navigation if tracking fails
          console.warn("Failed to track store visit:", error);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">載入中...</div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen p-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={onGoBackContainerClick}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          返回
        </button>
      </div>
    );
  }

  const onRedeemClick = async () => {
    if (coupon) {
      if (coupon.coupon_type === "store") {
        // Check if the user is logged in before redeeming
        if (!isUserLoggedIn()) {
          devLog("User not logged in. Redirecting to login page");
          const returnUrl = `/EasyUse/${coupon.id}/redeem`;
          router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
          return;
        }

        // For store coupons, redeem directly without a code
        try {
          setIsRedeeming(true);
          await fetchAPI(`/redeem/${coupon.id}/`, {
            method: "POST",
            withCredentials: true,
          });

          // Update the coupon state to show it as redeemed
          setCoupon({ ...coupon, is_redeemed: true });

          // Show success popup instead of alert
          setShowSuccessPopup(true);
        } catch (err) {
          console.error("Error redeeming coupon:", err);
          let errorMessage = "兌換失敗，請稍後再試。";
          if (axios.isAxiosError(err) && err.response?.data?.error) {
            errorMessage = err.response.data.error;
          }

          alert(errorMessage);
          setIsRedeeming(false);
        }
      } else {
        // For exclusive coupons, navigate to the redemption page to enter code
        router.push(`/EasyUse/${coupon.id}/redeem`);
      }
    }
  };

  // Handler to close the success popup and redirect
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    setIsRedeeming(false);
    router.push("/EasyUse"); // Redirect back to main page
  };

  if (!coupon) {
    return (
      <div className="flex justify-center items-center h-screen">
        找不到優惠券資料。
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      // Add 1 to month since getMonth() returns 0-11
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      return `${year}
${month}/${day}`;
    } catch (e) {
      return "無效日期";
    }
  };

  return (
    <div
      className={`bg-bg-grey max-w-full overflow-y-auto flex flex-col items-start justify-start pt-[35px] px-[31px] pb-4 box-border gap-[10px] leading-[normal] tracking-[normal] text-center text-base text-sec-black font-jost`}
    >
      {" "}
      <div className="flex flex-col items-start justify-start gap-[22px]">
        <div className="flex flex-row items-start justify-start gap-[9px]">
          <div className="flex flex-col items-start justify-start pt-[4.5px] px-0 pb-0">
            <Image
              className="w-[15px] h-[15px] relative object-contain"
              width={15}
              height={15}
              alt="Back arrow"
              src="/forward@2x.png"
            />
          </div>
          <div
            className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[32px]"
            onClick={onGoBackContainerClick}
          >
            返回
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-[25px] w-full h-[75%] self-stretch overflow-auto px-[19px] pt-[23px] pb-[13em]">
        <div className="w-full h-[13em] drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex justify-center items-center">
          <div className="flex flex-col justify-center items-center gap-[10px] w-full my-[10%]">
            <h2 className="text-3xl md:text-4xl lg:text-5xl tracking-[-0.43px] leading-tight font-bold font-[inherit] z-[2] inline-block w-[80%] text-center truncate">
              {coupon.store_name}
            </h2>
            <h2 className="text-base md:text-lg tracking-[-0.43px] leading-snug font-bold font-[inherit] z-[2] inline-block w-[80%] text-center truncate">
              {coupon.coupon_name}
            </h2>
          </div>
        </div>

        <div className="w-full flex flex-row justify-between gap-[15px]">
          <div className="w-[48%] aspect-square drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex justify-center items-center">
            <div className="flex flex-col justify-center items-center gap-[10px] w-full p-[10%]">
              <h2 className="text-sm md:text-lg tracking-[-0.43px] leading-[22px] font-[inherit] z-[2] inline-block">
                到期日期
              </h2>
              <h2 className="text-xl md:text-2xl lg:text-3xl tracking-[-0.43px] leading-normal font-bold font-[inherit] z-[2] inline-block whitespace-pre-line">
                {formatDate(coupon.expiry_date)}
              </h2>
            </div>
          </div>

          <div className="w-[48%] aspect-square drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex justify-center items-center">
            <div className="flex flex-col justify-center items-center gap-[10px] w-full p-[10%]">
              <h2 className="text-sm md:text-lg tracking-[-0.43px] leading-[22px] font-[inherit] z-[2] inline-block">
                來自
              </h2>
              <h2 className="text-lg md:text-xl lg:text-xl tracking-[-0.43px] leading-normal font-bold font-[inherit] z-[2] inline-block max-w-full text-xs sm:text-sm overflow-hidden break-words">
                {coupon.coupon_type === "store"
                  ? coupon.store_name
                  : coupon.coupon_type === "exclusive" &&
                      coupon.last_holder_email
                    ? coupon.last_holder_email
                    : "CouPro"}
              </h2>
            </div>
          </div>
        </div>

        <div className="w-full h-[16em] drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl h-[300px] bg-bg-white flex justify-center items-center h-full">
          <div className="flex flex-col justify-center items-start gap-[30px] w-[80%] my-[10%]">
            <h2 className="text-xl text-left font-bold font-[inherit] z-[2] inline-block">
              {coupon.coupon_detail.split("\n").map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </h2>
            {coupon.important_notes && (
              <h2 className="text-lg font-[inherit] z-[2] inline-block text-left">
                <div className="mb-[1em]">
                  <strong>注意事項 :</strong>
                </div>
                {coupon.important_notes
                  .split(/\r?\n/) // normalize Windows/macOS/Linux newlines
                  .map((rawLine, index) => {
                    const line = rawLine.trim(); // trim whitespace and \r

                    const match = line.match(/^(\d+)\.\s*(.*)$/);

                    if (!match) {
                      return (
                        <div key={index} className="flex">
                          <span className="pl-[2em]">{line}</span>
                        </div>
                      );
                    }

                    const [, number, text] = match;

                    return (
                      <div
                        key={index}
                        className="flex items-start mb-1 leading-relaxed"
                      >
                        <span className="w-[1.5em] shrink-0">{number}.</span>
                        <span>{text}</span>
                      </div>
                    );
                  })}
              </h2>
            )}
          </div>
        </div>

        {coupon.is_redeemed && coupon.coupon_type == "exclusive" && (
          <p className="text-center text-red-500 mt-4">此優惠券已被兌換</p>
        )}
      </div>
      {/* Sticky Buttons Container */}
      <div className="fixed bottom-0 left-0 right-0 px-12 py-4 z-50 flex flex-col gap-5">
        {!coupon.is_redeemed && (
          <div
            className={`drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] h-[5em] rounded-xl flex flex-col items-center justify-center ${isRedeeming || !coupon.can_use_today ? "opacity-50 bg-act-yellow" : "bg-act-yellow cursor-pointer"}`}
            onClick={
              isRedeeming || !coupon.can_use_today ? undefined : onRedeemClick
            }
          >
            <h2 className="text-[32px] tracking-[-0.43px] leading-[22px] font-bold font-[inherit] z-[2] inline-block">
              {isRedeeming
                ? "處理中..."
                : !coupon.can_use_today
                  ? "今日已使用"
                  : coupon.coupon_type === "store"
                    ? "使用"
                    : "核銷"}
            </h2>
          </div>
        )}

        {coupon.coupon_type == "store" && (
          <div
            className={`drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] h-[5em] rounded-xl flex flex-col items-center justify-center bg-act-yellow cursor-pointer}`}
            onClick={onButtonClick}
          >
            <h2 className="text-[32px] tracking-[-0.43px] leading-[22px] font-bold font-[inherit] z-[2] inline-block">
              {"Let's GOOOO !"}
            </h2>
          </div>
        )}
      </div>
      {/* Success Popup for redeeming store coupons */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponName={coupon?.coupon_name}
        couponDetail={coupon?.coupon_detail}
        titleType="使用成功"
      />
    </div>
  );
};

export default Verify;
