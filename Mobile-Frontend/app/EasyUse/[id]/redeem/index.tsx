import React, { useState, useEffect, useCallback } from "react";
import { 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import SuccessPopup from "./SuccessPopup";
import { devLog } from "../../../utils/devLogger";
import { fetchAPI } from "../../../utils/authAPI";

// Define the coupon interface
interface Coupon {
  id: number;
  store_name: string;
  coupon_detail: string;
  coupon_type: "store" | "exclusive";
  // Add other properties as needed
}

export default function RedeemPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
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
        const response = await fetchAPI(`/coupons/${id}/`, { 
          method: "GET" 
        }); 

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
    
    if (id) {
      fetchCoupon();
    }
  }, [id, router]);

  const handleSubmitCode = async () => {
    setInputError(false);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetchAPI(
        `/redeem/${id}/`,
        {
          method: "POST",
          data: { redeem_code: redeemCode },
        }
      );

      // Process the successful response
      devLog("兌換成功", response.data);
      setInputError(false);
      setShowSuccessConfirmation(true);
      setRedeemCode("");
    } catch (error) {
      console.error("處理錯誤:", error);

      let errorMessage = "發生錯誤，請稍後再試";
      
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          errorMessage = "登入已過期或未登入，請重新登入";
          setTimeout(() => {
            router.push("/Login");
          }, 2000);
        } else if (error.message.includes("400")) {
          errorMessage = "兌換碼錯誤或已使用";
        } else if (error.message.includes("404")) {
          errorMessage = "找不到此優惠券";
        } else {
          errorMessage = error.message;
        }
      }

      setMessage(errorMessage);
      setInputError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    const filteredText = text.slice(0, 6).toUpperCase();
    setRedeemCode(filteredText);
    if (inputError) {
      setInputError(false);
    }
    setMessage("");
  };

  if (!coupon && !message) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 justify-center items-center">
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text className="text-sec-black mt-4">載入中...</Text>
      </SafeAreaView>
    );
  }

  if (!coupon && message) {
    return (
      <SafeAreaView className="flex-1 bg-gray-100 justify-center items-center px-4">
        <Text className="text-red-500 text-center text-lg">{message}</Text>
        <TouchableOpacity 
          onPress={onGoBackContainerClick}
          className="mt-4 bg-gray-300 px-4 py-2 rounded-lg"
        >
          <Text className="text-gray-700 font-semibold">返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-start pt-[35px] px-4">
          {/* Back Button */}
          <TouchableOpacity
            onPress={onGoBackContainerClick}
            className="flex flex-row items-center gap-2 mb-10 self-start"
            activeOpacity={0.7}
          >
            <Image
              source={require("../../../../assets/forward.png")}
              style={{ width: 16, height: 16 }}
              className="w-4 h-4"
            />
            <Text className="text-sec-black text-sm">返回</Text>
          </TouchableOpacity>

          {/* Redeem Code Input Card */}
          <View className="flex-1 justify-center items-center">
            <View className="bg-white shadow-md rounded-xl w-full max-w-md p-6 items-center justify-center">
              <Text className="text-2xl font-bold text-sec-black mb-6 text-center">
                輸入兌換碼
              </Text>
              
              <Text className="text-lg font-semibold text-sec-black mb-2 text-center">
                {coupon?.store_name}
              </Text>
              
              <Text className="text-sm text-gray-600 mb-6 text-center">
                {coupon?.coupon_detail}
              </Text>

              <View className="w-full">
                <TextInput
                  value={redeemCode}
                  onChangeText={handleInputChange}
                  placeholder="請輸入6位兌換碼"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!isLoading}
                  className={`w-full border rounded-lg py-3 px-4 text-center text-lg bg-gray-100 text-sec-black ${
                    inputError ? "border-red-500" : "border-gray-300"
                  }`}
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    letterSpacing: 2,
                  }}
                />
                
                {/* Error message */}
                {inputError && message && (
                  <Text className="text-red-500 text-sm mt-2 text-center">
                    {message}
                  </Text>
                )}
                
                <TouchableOpacity
                  onPress={handleSubmitCode}
                  disabled={
                    redeemCode.length !== 6 || showSuccessConfirmation || isLoading
                  }
                  className={`py-3 px-6 rounded-lg shadow mt-4 w-full items-center justify-center ${
                    redeemCode.length === 6 && !showSuccessConfirmation && !isLoading
                      ? "bg-act-yellow"
                      : "bg-gray-400"
                  }`}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator 
                        size="small" 
                        color="#000" 
                        className="mr-2"
                      />
                      <Text className="text-sec-black font-bold">處理中...</Text>
                    </View>
                  ) : (
                    <Text className="text-sec-black font-bold text-lg">確認</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Success Confirmation Popup */}
      <SuccessPopup
        isOpen={showSuccessConfirmation}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponDetail={coupon?.coupon_detail}
        titleType="核銷成功"
      />
    </SafeAreaView>
  );
}
