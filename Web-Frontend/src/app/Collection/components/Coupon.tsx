"use client";
import { FunctionComponent, useCallback, useState, useContext } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ToastContext } from "@/app/components/providers/ToastProvider";
import { generateShareLink } from "@/app/Collection/utils/couponUtils";
import type { CouponType } from "@/app/Collection/utils/types";

interface CouponProps extends Partial<CouponType> {
  className?: string;
}

const Coupon: FunctionComponent<CouponProps> = ({
  className = "",
  couponName,
  description,
  storeName,
  expiryDate,
  id,
  imageUrl,
}) => {
  const router = useRouter();
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Use the ToastContext to access global toast notifications
  const { showToast } = useContext(ToastContext);

  const onCouponClick = useCallback(() => {
    router.push(`/EasyUse/${id}?source=collection`);
  }, [router, id]);

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent the coupon click handler from firing if event exists
    setIsSharing(true);
    setShareError(null);

    if (!id) {
      setShareError("無法分享：優惠券ID不存在");
      setIsSharing(false);
      return;
    }

    try {
      const link = await generateShareLink(id);

      if (link && navigator.share) {
        try {
          await navigator.share({
            title: `分享優惠券`,
            text: `🎁 來自 CouPro 的 ${storeName} 優惠券，點擊領取 !\n`,
            url: link,
          });
          showToast("成功分享優惠券", "success");
        } catch (shareError) {
          console.error("Error sharing:", shareError);
          // Fall back to clipboard copy if sharing fails
          if (link) {
            await fallbackCopyToClipboard(link);
          }
        }
      } else if (link) {
        // No Web Share API support, use clipboard fallback
        await fallbackCopyToClipboard(link);
      } else {
        setShareError("無法建立分享連結");
      }
    } catch (err: any) {
      console.error("Error sharing coupon:", err);
      setShareError(err?.response?.data?.error || "分享失敗，請稍後再試。");
    } finally {
      setIsSharing(false);
    }
  };

  // Fallback method to copy to clipboard
  const fallbackCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已複製分享連結到剪貼簿", "success");
    } catch (err) {
      console.error("Failed to copy:", err);
      setShareError("複製失敗，請手動分享。");
    }
  };

  return (
    <div
      className={`self-stretch drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] flex flex-row items-start justify-start shrink-0 max-w-full text-left text-xs text-sec-black font-jost ${className}`}
      onClick={onCouponClick}
    >
      <div className="flex-1 flex flex-col items-start justify-start pt-[65px] px-2 pb-5 box-border relative max-w-full">
        <div className="h-full w-full absolute !m-[0] top-[0px] right-[0px] bottom-[0px] left-[0px] rounded-xl bg-bg-white" />
        <h2 className="left-[119px] absolute top-[32px] text-xl tracking-[-0.43px] leading-[22px] font-bold font-[inherit] z-[2] inline-block">
          {storeName}
        </h2>
        <div className="bottom-[5px] left-[111px] w-[204px] relative tracking-[-0.43px] leading-[23px] flex shrink-0 z-[1]">
          {couponName}
        </div>
        <div className="bottom-[5px] left-[111px] w-[204px] relative tracking-[-0.43px] leading-[23px] flex shrink-0 z-[1]">
          有效期限 : {expiryDate ? expiryDate.toLocaleDateString() : ""}
        </div>
        <div className="h-[70px] w-[70px] absolute !m-[0] top-[50%] translate-y-[-50%] left-[22px] z-[2]">
          <Image
            className="absolute h-full w-full top-[0%] right-[0%] bottom-[0%] left-[0%] max-w-full overflow-hidden max-h-full object-cover rounded-[8px]"
            alt="Coupon image"
            src={imageUrl || "/coupon_placeholder.png"}
            width={70}
            height={70}
          />
        </div>
        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-act-yellow rounded-[10px] p-2 z-10"
          aria-label="Share coupon"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
        </button>
        {/* Error message */}
        {shareError && (
          <div className="absolute bottom-[5px] right-[15px] text-red-500 text-xs">
            {shareError}
          </div>
        )}
      </div>
    </div>
  );
};

export default Coupon;
