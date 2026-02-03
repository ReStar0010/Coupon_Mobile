"use client";
import { Suspense, useState, useEffect } from "react";
import { useRequireAuth } from "@/app/utils/authAPI";
import Gift from "./Gift";
import { filterCoupons } from "@/app/Collection/utils/couponUtils";

// Import custom hooks
import { useCoupons } from "./hooks/useCoupons";
import { useDailyDraw } from "./hooks/useDailyDraw";
import { useSharedCoupon } from "./hooks/useSharedCoupon";
import { useSearch } from "./hooks/useSearch";

// Import components
import Coupon from "./components/Coupon";
import DailyDrawBanner from "./components/DailyDrawBanner";
import DailyDrawModal from "./components/DailyDrawModal";
// import UnderDevelopmentModal from "./components/UnderDevelopmentModal";
import PageHeader from "../components/PageHeader";

const Collection = () => {
  // Use our auth hook to protect this route
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // State for under development modal
  // const [showUnderDevelopment, setShowUnderDevelopment] = useState(false);

  // Use custom hooks
  const { searchQuery, handleSearchChange, clearSearch } = useSearch();
  const { coupons, isLoading, error, fetchCoupons } = useCoupons(
    isAuthenticated,
    authLoading,
  );
  const {
    showDailyDraw,
    setShowDailyDraw,
    dailyDrawResult,
    isDailyDrawLoading,
    hasDailyDrawn,
    availableTemplates,
    handleDailyDraw,
    closeDailyDrawWithSuccess,
  } = useDailyDraw(isAuthenticated, authLoading, fetchCoupons);
  const { shareToken, sharedCoupon, showSharedGift, handleGiftAccepted } =
    useSharedCoupon(fetchCoupons);

  // Filter coupons based on search query
  const filteredCoupons = filterCoupons(coupons, searchQuery);

  // Show under development modal when no coupons are available
  // useEffect(() => {
  //   if (!isLoading && !error && filteredCoupons.length === 0) {
  //     setShowUnderDevelopment(true);
  //   }
  // }, [filteredCoupons.length, isLoading, error]);

  // Show loading state if auth is still loading
  if (authLoading) {
    return (
      <div className="w-full h-dvh flex justify-center items-center">
        <p className="text-lg text-gray-500">驗證身份中...</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-svh bg-bg-grey max-w-full flex flex-col items-end justify-start pt-[35px] px-[11px] gap-[10px] leading-[normal] tracking-[normal]`}
    >
      {" "}
      <PageHeader
        title="專屬酷胖"
        infoPopupTitle="什麼是專屬酷胖？"
        infoPopupContent={
          <>
            <p className="text-xs mb-2">
              「專屬酷胖」是屬於你個人帳號的優惠券，內容特別、折扣力度更大，還能分享給朋友！
            </p>
            <ul className="list-disc pl-4 text-xs space-y-1 mb-2">
              <li>
                <strong>專屬帳號：</strong> 每人每天限抽一次，有機會獲得專屬酷胖
              </li>
              <li>
                <strong>限時限量：</strong> 有效期限較短，必須把握時間使用
              </li>
              <li>
                <strong>分享轉讓：</strong> 中獎後如果想要，可直接一鍵分享給朋友
              </li>
              <li>
                <strong>內容特別：</strong>{" "}
                大多比「隨取即用」折扣更大，優惠設計也更有趣
              </li>
            </ul>
            <p className="text-xs">
              簡單來說，專屬酷胖是我們為你精心設計的「每日驚喜券」，讓你可以和朋友一起享受發掘優惠的樂趣並參與、分享，增添生活樂趣。
            </p>
          </>
        }
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        navbarProps={{ atCollection: true }}
        sourcePage="/Collection"
      />
      <section className="self-stretch flex-1 flex flex-col items-start justify-start pt-[23px] px-[19px] pb-[13px] box-border gap-[25px] max-w-full relative">
        {/* Daily Draw Banner */}
        {!hasDailyDrawn && !showSharedGift && (
          <DailyDrawBanner onClick={() => setShowDailyDraw(true)} />
        )}

        {/* Daily Draw Modal */}
        <DailyDrawModal
          isOpen={showDailyDraw}
          onClose={() => setShowDailyDraw(false)}
          onDraw={handleDailyDraw}
          onDrawComplete={closeDailyDrawWithSuccess}
          result={dailyDrawResult}
          isLoading={isDailyDrawLoading}
          templatesAvailable={availableTemplates.length}
        />

        {/* Show shared coupon as Gift if present */}
        {showSharedGift && sharedCoupon && (
          <Gift
            token={shareToken || undefined}
            couponInfo={{
              id: sharedCoupon.coupon_id,
              name: sharedCoupon.coupon_name,
              fromUser: sharedCoupon.from_user_email,
            }}
            ReceiveType="領取"
            onAccepted={handleGiftAccepted}
          />
        )}

        {/* Coupon List Section */}
        {isLoading ? (
          <div className="flex justify-center items-center w-full p-10">
            <p className="text-lg text-gray-500">載入中...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center w-full p-10 text-red-500">
            <p>{error}</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="flex justify-center items-center w-full p-10">
            <p className="text-gray-500">目前沒有可用的專屬優惠券。</p>
          </div>
        ) : (
          // <UnderDevelopmentModal
          //   isOpen={showUnderDevelopment}
          //   onClose={() => window.location.href = '/EasyUse'}
          // />
          <>
            {filteredCoupons.map((coupon) => (
              <Coupon
                key={coupon.id}
                couponName={coupon.couponName}
                storeName={coupon.storeName}
                expiryDate={coupon.expiryDate}
                id={coupon.id}
                imageUrl={coupon.imageUrl}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
};

// Wrap the client component with Suspense in the default page export
const CollectionPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Collection />
    </Suspense>
  );
};

export default CollectionPage;
