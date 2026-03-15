import {
  FunctionComponent,
  useCallback,
  useMemo,
  type CSSProperties,
  useState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import SuccessPopup from "../EasyUse/[id]/redeem/SuccessPopup";
import { isUserLoggedIn, fetchAPI } from "@/app/utils/authAPI";
import { devLog } from "@/app/utils/devLogger";

export type GiftType = {
  className?: string;
  description?: string;
  GiftType?: string;
  ReceiveType?: string;
  token?: string;
  couponInfo?: {
    id: number;
    name: string;
    fromUser: string;
  };
  onAccepted?: () => void;
};

const Gift: FunctionComponent<GiftType> = ({
  className = "",
  description,
  GiftType,
  ReceiveType,
  token,
  couponInfo,
  onAccepted,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const router = useRouter();

  // Handle accepting a shared coupon
  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!token) return; // No token, can't accept

    // Check if the user is logged in before accepting the gift
    if (!isUserLoggedIn()) {
      devLog("User not logged in. Redirecting to login page with token");
      // Redirect to login page with the token in the URL for returning after login
      const returnUrl = `/Collection?token=${token}`;
      router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const response = await fetchAPI(`/coupon/share/${token}/accept/`, {
        method: "POST",
        withCredentials: true,
      });
      // devDebug("API response:", response.data);

      devLog("Gift accepted:", response.data);

      // Mark as successful but don't call onAccepted yet
      setAcceptSuccess(true);

      // Show success popup
      setShowSuccessPopup(true);
    } catch (err: any) {
      console.error("Error accepting gift:", err);
      setError(err?.response?.data?.error || "領取失敗，請稍後再試。");
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle closing the success popup
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);

    // Only now call the callback to remove the Gift component
    if (acceptSuccess && onAccepted) {
      onAccepted();
    }

    // Navigate to collection and refresh data without full page reload
    router.push("/Collection");
    router.refresh();
  };

  // This function handles the click on the yellow button
  const onReceiveButtonClick = token ? handleAccept : undefined;

  return (
    <>
      {/* Only show the gift card if no success yet */}
      {!acceptSuccess && (
        <div
          className={`self-stretch drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] flex flex-row items-start justify-start shrink-0 max-w-full text-left text-xs text-sec-black font-jost ${className}`}
        >
          <div className="flex-1 flex flex-row items-start justify-start pt-[73px] px-2 pb-5 box-border relative max-w-full">
            <div className="h-full w-full absolute !m-[0] top-[0px] right-[0px] bottom-[0px] left-[0px] rounded-xl bg-bg-white"></div>

            {/* From user message */}
            <div className="left-[22px] absolute z-[2] top-[50%] -translate-y-1/2 max-w-[50%] flex flex-col gap-1">
              <h2 className="text-xl tracking-[-0.43px] </div>leading-[22px] font-bold font-[inherit] truncate w-full">
                {GiftType ||
                  (couponInfo ? `來自 ${couponInfo.fromUser} 的優惠券` : "")}
              </h2>

              {/* Coupon name with fixed spacing from the fromUse</h2>r text */}
              {/*</h2> {couponInfo && (
                <div className="text-sm tracking-[0.43px] leading-[22px] text-sec-black truncate">
                  {couponInfo.name}
                </div>
              )} */}
            </div>

            <div
              className={`bg-act-yellow w-[25%] h-[60%] rounded-xl absolute top-[50%] -translate-y-1/2 right-[22px] cursor-pointer ${
                isAccepting ? "opacity-70" : ""
              }`}
              onClick={onReceiveButtonClick}
            >
              <h2 className="text-xl absolute tracking-[-0.43px] leading-[22px] font-bold font-[inherit] z-[2] inline-block top-[53%] left-[50%] translate-y-[-50%] translate-x-[-50%]">
                {isAccepting ? "處理中..." : ReceiveType || "領取"}
              </h2>
            </div>

            {error && (
              <div className="absolute bottom-[5px] left-[22px] text-red-500 text-xs">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={couponInfo?.fromUser || "好友"}
        couponName={couponInfo?.name || "優惠券"}
        titleType="領取成功"
      />
    </>
  );
};

export default Gift;
