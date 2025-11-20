import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { View, ScrollView, SafeAreaView } from "react-native";
import { ResetFormContainer } from "./components/ResetFormContainer";
import { fetchAPI } from "app/utils/authAPI";
import { devLog, devError } from "app/utils/devLogger";
import { toastConfig } from "app/config/toastConfig";

export default function Index() {
  const [password, setPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const searchParams = useLocalSearchParams()
  const token = searchParams?.token as string;
  const email = searchParams?.email as string;  
  const router = useRouter();

  useEffect(() => {
    if (!token || !email) {
      devError("無效的密碼重設連結。請重新嘗試忘記密碼流程。");
    }
  }, [token, email]);

  const handleResetPassword = async () => {
    if (password !== verifyPassword) {
      devError("兩次輸入的密碼不一致");
      Toast.show({
        type: 'failRed',
        text1: '兩次輸入的密碼不一致',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      return;
    }

    if (password.length < 8) {
      devError("密碼長度至少需要8個字元");
      Toast.show({
        type: 'failRed',
        text1: '密碼長度至少需要8個字元',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      return;
    }
    try {
      const response = await fetchAPI('/reset-password/', {
        method: 'POST',
        data: {
          email,
          token,
          new_password: password,
        },
      });
      devLog("密碼重設成功", response.data);
      Toast.show({
        type: 'successGreen',
        text1: '密碼重設成功',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace(`/Login?email=${encodeURIComponent(email || "")}`);
    } catch (err) {
      // Handle axios errors
      devError("密碼重設失敗:", err);
      Toast.show({
        type: 'failRed',
        text1: '密碼重設失敗，請稍後再試',
        position: 'bottom',
        visibilityTime: 2000,
        autoHide: true,
      });
      router.replace("/Login");
    }
  };

  return (
    <SafeAreaView className="min-h-screen bg-login-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-[320px] mx-auto">
            <ResetFormContainer
              password={password}
              setPassword={setPassword}
              verifyPassword={verifyPassword}
              setVerifyPassword={setVerifyPassword}
              handleReset={handleResetPassword}
            />
          </View>
          <Toast config={toastConfig} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


// import React, { useState, useEffect, useRef } from "react";
// import { 
//   View, 
//   Text, 
//   TextInput, 
//   TouchableOpacity, 
//   SafeAreaView, 
//   ScrollView,
//   Alert,
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform
// } from "react-native";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import { Stack } from "expo-router";
// import { Header } from "../Login/components/Header";
// import axios from "axios";

// const ResetPasswordPage: React.FC = () => {
//   const [password, setPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState(false);
//   const searchParams = useLocalSearchParams();
//   const router = useRouter();
//   const confirmPasswordInputRef = useRef<TextInput>(null);

//   const token = searchParams?.token as string;
//   const email = searchParams?.email as string;

//   useEffect(() => {
//     if (!token || !email) {
//       setError("無效的密碼重設連結。請重新嘗試忘記密碼流程。");
//     }
//   }, [token, email]);

//   const handleSubmit = async () => {
//     if (password !== confirmPassword) {
//       setError("兩次輸入的密碼不一致");
//       return;
//     }

//     if (password.length < 8) {
//       setError("密碼長度至少需要8個字元");
//       return;
//     }

//     setIsLoading(true);
//     setError(null);

//     try {
//       const response = await axios.post(
//         `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'}/api/reset-password/`,
//         {
//           email,
//           token,
//           new_password: password,
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//           },
//           withCredentials: true,
//         }
//       );

//       // Handle successful reset
//       setSuccess(true);
      
//       // Show success alert and redirect after user confirms
//       Alert.alert(
//         "密碼重設成功",
//         "您的密碼已成功重設，現在可以使用新密碼登入。",
//         [
//           {
//             text: "前往登入",
//             onPress: () => {
//               router.replace(`/Login?email=${encodeURIComponent(email || "")}`);
//             }
//           }
//         ]
//       );
//     } catch (err) {
//       // Handle axios errors
//       if (axios.isAxiosError(err)) {
//         if (err.response?.data) {
//           const errorData = err.response.data;
//           if (errorData.error) {
//             setError(errorData.error);
//           } else if (errorData.message) {
//             setError(errorData.message);
//           } else {
//             setError("密碼重設失敗。請稍後再試。");
//           }
//         } else {
//           setError("無法連接到伺服器，請稍後再試。");
//         }
//       } else {
//         setError(err instanceof Error ? err.message : "發生錯誤");
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleBackToLogin = () => {
//     router.replace("/Login");
//   };

//   return (
//     <>
//       <Stack.Screen options={{ headerShown: false }} />
//       <SafeAreaView className="flex-1 bg-bg-grey">
//         <KeyboardAvoidingView 
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           className="flex-1"
//         >
//           <ScrollView 
//             className="flex-1"
//             showsVerticalScrollIndicator={false}
//             contentContainerStyle={{ 
//               flexGrow: 1,
//               justifyContent: 'center',
//               alignItems: 'center',
//               paddingHorizontal: 40,
//               paddingVertical: 20,
//             }}
//           >
//             <Header />

//             <View className="flex flex-col items-center w-full max-w-[400px]" style={{ gap: 20 }}>
//               <Text className="text-xl text-sec-black mb-2 font-bold text-center">
//                 重設您的密碼
//               </Text>

//               {success ? (
//                 <View className="bg-green-100 p-4 rounded-md w-full">
//                   <Text className="text-green-600 text-sm font-medium text-center">
//                     密碼已成功重設！請點擊確認按鈕前往登入頁面。
//                   </Text>
//                 </View>
//               ) : error && (!token || !email) ? (
//                 <View className="bg-red-100 p-4 rounded-md w-full">
//                   <Text className="text-red-600 text-sm font-medium text-center mb-4">
//                     {error}
//                   </Text>
//                   <TouchableOpacity 
//                     onPress={handleBackToLogin} 
//                     className="w-full"
//                     activeOpacity={0.7}
//                   >
//                     <View className="bg-act-yellow rounded-3xl h-[54px] items-center justify-center">
//                       <Text className="text-sec-black font-bold text-base">
//                         返回登入頁面
//                       </Text>
//                     </View>
//                   </TouchableOpacity>
//                 </View>
//               ) : (
//                 <>
//                   <View className="w-full">
//                     <TextInput
//                       value={password}
//                       onChangeText={setPassword}
//                       placeholder="輸入新密碼"
//                       secureTextEntry
//                       className="bg-bg-white text-base border-[none] text-sec-black rounded-3xl h-[54px] px-4"
//                       autoCapitalize="none"
//                       returnKeyType="next"
//                       onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
//                       blurOnSubmit={false}
//                     />
//                   </View>

//                   <View className="w-full">
//                     <TextInput
//                       ref={confirmPasswordInputRef}
//                       value={confirmPassword}
//                       onChangeText={setConfirmPassword}
//                       placeholder="確認新密碼"
//                       secureTextEntry
//                       className="bg-bg-white text-base border-[none] text-sec-black rounded-3xl h-[54px] px-4"
//                       autoCapitalize="none"
//                       returnKeyType="done"
//                       onSubmitEditing={handleSubmit}
//                     />
//                   </View>

//                   {error && (
//                     <View className="bg-red-100 p-3 rounded-md w-full">
//                       <Text className="text-red-600 text-sm font-medium text-center">
//                         {error}
//                       </Text>
//                     </View>
//                   )}

//                   <TouchableOpacity
//                     onPress={handleSubmit}
//                     disabled={isLoading || !token || !email}
//                     className={`w-full rounded-3xl h-[54px] items-center justify-center ${
//                       isLoading || !token || !email ? "bg-act-yellow opacity-70" : "bg-act-yellow"
//                     }`}
//                     activeOpacity={0.7}
//                   >
//                     {isLoading ? (
//                       <ActivityIndicator size="small" color="#000" />
//                     ) : (
//                       <Text className="text-sec-black font-bold text-base">
//                         重設密碼
//                       </Text>
//                     )}
//                   </TouchableOpacity>
//                 </>
//               )}
//             </View>
//           </ScrollView>
//         </KeyboardAvoidingView>
//       </SafeAreaView>
//     </>
//   );
// };

// export default ResetPasswordPage;
