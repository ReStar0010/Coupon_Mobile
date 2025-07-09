import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useToast } from "../../components/ToastContext";
import { generateShareLink } from "../utils/couponUtils";
import type { CouponType } from "../utils/types";

interface CouponProps extends Partial<CouponType> {
  className?: string;
}

const Coupon: React.FC<CouponProps> = ({
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
  const { showToast } = useToast();

  const onCouponClick = useCallback(() => {
    router.push(`/EasyUse/${id}?source=collection`);
  }, [router, id]);

  const handleShare = async () => {
    setIsSharing(true);
    setShareError(null);

    if (!id) {
      setShareError("無法分享：優惠券ID不存在");
      setIsSharing(false);
      return;
    }

    try {
      const link = await generateShareLink(id);

      if (link) {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          try {
            await Sharing.shareAsync(link, {
              dialogTitle: `分享優惠券 - ${storeName}`,
            });
            showToast("成功分享優惠券", "success");
          } catch (shareError) {
            console.error("Error sharing:", shareError);
            // Fall back to clipboard copy if sharing fails
            await fallbackCopyToClipboard(link);
          }
        } else {
          // No sharing support, use clipboard fallback
          await fallbackCopyToClipboard(link);
        }
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
      await Clipboard.setStringAsync(text);
      showToast("已複製分享連結到剪貼簿", "success");
    } catch (err) {
      console.error("Failed to copy:", err);
      setShareError("複製失敗，請手動分享。");
    }
  };

  return (
    <TouchableOpacity
      className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] flex flex-row items-start justify-start shrink-0 max-w-full ${className}`}
      onPress={onCouponClick}
      activeOpacity={0.7}
    >
      <View className="flex-1 flex flex-col items-start justify-start pt-[65px] px-2 pb-5 box-border relative max-w-full">
        <View className="h-full w-full absolute top-0 right-0 bottom-0 left-0 rounded-xl bg-bg-white" />
        
        <Text 
          className="absolute left-[119px] top-[32px] text-xl font-bold text-sec-black z-[2]"
          style={{ 
            letterSpacing: -0.43,
            lineHeight: 22,
          }}
          numberOfLines={1}
        >
          {storeName}
        </Text>
        
        <View className="absolute bottom-[25px] left-[111px] w-[204px] z-[1]">
          <Text 
            className="text-xs text-sec-black mb-1"
            style={{ 
              letterSpacing: -0.43,
              lineHeight: 23,
            }}
            numberOfLines={2}
          >
            {couponName}
          </Text>
          <Text 
            className="text-xs text-sec-black"
            style={{ 
              letterSpacing: -0.43,
              lineHeight: 23,
            }}
            numberOfLines={1}
          >
            有效期限 : {expiryDate ? expiryDate.toLocaleDateString() : ''}
          </Text>
        </View>
        
        <View 
          className="h-[70px] w-[70px] absolute left-[22px] z-[2]"
          style={{
            top: '50%',
            transform: [{ translateY: -35 }], // 70px / 2 = 35px
          }}
        >
          <Image
            className="h-full w-full rounded-[8px]"
            style={{ width: 70, height: 70 }}
            source={imageUrl ? { uri: imageUrl } : require("../../../assets/Info.png")}
            resizeMode="cover"
          />
        </View>
        
        {/* Share button */}
        <TouchableOpacity
          onPress={handleShare}
          disabled={isSharing}
          className="absolute right-4 bg-act-yellow rounded-[10px] p-2 z-10"
          style={{
            top: '50%',
            transform: [{ translateY: -18 }], // Approximate center
            opacity: isSharing ? 0.7 : 1,
          }}
          activeOpacity={0.7}
        >
          {isSharing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <View className="h-5 w-5 items-center justify-center">
              <Text className="text-black text-lg">📤</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Error message */}
        {shareError && (
          <View className="absolute bottom-[5px] right-[15px]">
            <Text className="text-red-500 text-xs">{shareError}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default Coupon;
