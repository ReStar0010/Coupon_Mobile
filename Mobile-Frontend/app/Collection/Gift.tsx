import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import SuccessPopup from "../EasyUse/[id]/redeem/SuccessPopup";
import { isUserLoggedIn, fetchAPI } from "../utils/authAPI";
import { devLog } from "../utils/devLogger";

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

const { width } = Dimensions.get('window');

const Gift: React.FC<GiftType> = ({
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
  const handleAccept = async () => {
    if (!token) return;

    // Check if the user is logged in before accepting the gift
    if (!isUserLoggedIn()) {
      devLog("User not logged in. Redirecting to login page with token");
      const returnUrl = `/Collection?token=${token}`;
      router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const response = await fetchAPI(
        `/coupon/share/${token}/accept/`,
        {
          method: "POST",
        }
      );

      devLog("Gift accepted:", response.data);
      setAcceptSuccess(true);
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

    if (acceptSuccess && onAccepted) {
      onAccepted();
    }

    router.push("/Collection");
  };

  // Don't render if already accepted
  if (acceptSuccess && !showSuccessPopup) {
    return null;
  }

  return (
    <>
      <View
        className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl ${className}`}
        style={{
          minHeight: 120,
          backgroundColor: '#fff',
          marginVertical: 5,
        }}
      >
        <View className="flex-1 flex-row items-center justify-between px-6 py-4">
          {/* Left side - Gift info */}
          <View className="flex-1 mr-4">
            <Text 
              className="text-lg font-bold text-sec-black mb-1"
              numberOfLines={2}
            >
              {GiftType || (couponInfo ? `來自 ${couponInfo.fromUser} 的優惠券` : "")}
            </Text>

            {couponInfo && (
              <Text 
                className="text-sm text-gray-600"
                numberOfLines={2}
              >
                {couponInfo.name}
              </Text>
            )}

            {error && (
              <Text className="text-red-500 text-xs mt-2">{error}</Text>
            )}
          </View>

          {/* Right side - Action button */}
          <TouchableOpacity
            className="bg-act-yellow rounded-xl px-6 py-3 min-w-[80px] items-center justify-center"
            onPress={token ? handleAccept : undefined}
            disabled={isAccepting || !token}
            activeOpacity={0.7}
            style={{
              opacity: isAccepting ? 0.7 : 1,
            }}
          >
            {isAccepting ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#000" />
                <Text className="text-sm font-bold text-sec-black ml-2">處理中</Text>
              </View>
            ) : (
              <Text className="text-base font-bold text-sec-black">
                {ReceiveType || "領取"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={couponInfo?.fromUser || "好友"}
        couponDetail={couponInfo?.name || "優惠券"}
        titleType="領取成功"
      />
    </>
  );
};

export default Gift;
