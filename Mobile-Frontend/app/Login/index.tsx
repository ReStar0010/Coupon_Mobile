import 'global.css';
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { LoginInput } from './LoginInput';
import { LoginButton } from './LoginButton';
import { LinkText } from './LinkText';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // Handle login logic here
    console.log('Login pressed', { email, password });
  };

  const handleRegister = () => {
    // Handle navigation to register screen
    console.log('Register pressed');
  };

  const handleForgotPassword = () => {
    // Handle forgot password logic
    console.log('Forgot password pressed');
  };

  return (
    <View className="flex-1 bg-white px-6 py-8">
      <View className="mb-8">
        <View className="mb-6">
          <Text className="text-2xl font-semibold text-gray-900 text-center">
            登入
          </Text>
        </View>
      </View>

      <LoginInput
        label="輸入 Email"
        placeholder="請輸入您的電子郵件"
        value={email}
        onChangeText={setEmail}
      />

      <LoginInput
        label="輸入密碼"
        placeholder="請輸入您的密碼"
        secureTextEntry={true}
        value={password}
        onChangeText={setPassword}
      />

      <View className="mt-4">
        <LoginButton
          title="登入"
          onPress={handleLogin}
        />
      </View>

      <LinkText
        normalText="還沒有帳號嗎 ?"
        linkText="註冊"
        onLinkPress={handleRegister}
      />

      <LinkText
        normalText="忘記密碼 ?"
        linkText="重設"
        onLinkPress={handleForgotPassword}
        normalTextColor="text-gray-600"
      />
    </View>
  );
};

export default LoginForm;



// import "../../global.css"
// import React, { useState, useEffect } from "react";
// import { View, Text, SafeAreaView, ScrollView } from "react-native";
// import { useRouter, useLocalSearchParams } from "expo-router";
// import { Header } from "./components/Header";
// import { LoginForm } from "./components/LoginForm";
// import { RegisterForm } from "./components/RegisterForm";
// import { ForgotPasswordForm } from "./components/ForgotPasswordForm";

// export default function Login() {
//   const [isRegistering, setIsRegistering] = useState(false);
//   const [isForgotPassword, setIsForgotPassword] = useState(false);
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const router = useRouter();
//   const params = useLocalSearchParams();

//   // Check if user was just registered or verified
//   useEffect(() => {
//     // 自動填入 email/password (對應原本的 useSearchParams)
//     const urlEmail = params.email as string;
//     const urlPassword = params.password as string;
//     const returnUrl = params.returnUrl as string;

//     if (urlEmail) setEmail(urlEmail);
//     if (urlPassword) setPassword(urlPassword);
//     if (
//       params.registered === "true" ||
//       params.verified === "true"
//     ) {
//       setIsRegistering(false);
//       setIsForgotPassword(false);
//     }

//     // Log if returnUrl is present
//     if (returnUrl) {
//       console.log("Login page loaded with returnUrl:", returnUrl);
//     }
//   }, [params]);

//   return (
//     <SafeAreaView className="flex-1 bg-stone-50">
//       <ScrollView 
//         contentContainerStyle={{ flexGrow: 1 }}
//         className="flex-1 px-8 py-16"
//       >
//         <View className="flex-1 items-center justify-center">
//           <Header />

//           {isRegistering ? (
//             <>
//               <RegisterForm
//                 email={email}
//                 setEmail={setEmail}
//                 password={password}
//                 setPassword={setPassword}
//               />
//               <View className="mt-10 items-center">
//                 <Text className="text-base text-sec-black">
//                   已經有帳號了 ? 
//                 </Text>
//                 <Text
//                   onPress={() => setIsRegistering(false)}
//                   className="text-act-yellow text-base font-medium"
//                 >
//                   登入
//                 </Text>
//               </View>
//             </>
//           ) : isForgotPassword ? (
//             <>
//               <ForgotPasswordForm email={email} setEmail={setEmail} />
//               <View className="mt-10 items-center">
//                 <Text className="text-base text-sec-black">
//                   想記起密碼了 ? 
//                 </Text>
//                 <Text
//                   onPress={() => setIsForgotPassword(false)}
//                   className="text-act-yellow text-base font-medium"
//                 >
//                   返回登入
//                 </Text>
//               </View>
//             </>
//           ) : (
//             <>
//               <LoginForm
//                 email={email}
//                 setEmail={setEmail}
//                 password={password}
//                 setPassword={setPassword}
//               />
//               <View className="mt-6 items-center gap-4">
//                 <View className="flex-row items-center">
//                   <Text className="text-base text-sec-black">還沒有帳號嗎 ? </Text>
//                   <Text
//                     onPress={() => setIsRegistering(true)}
//                     className="text-act-yellow text-base font-medium"
//                   >
//                     註冊
//                   </Text>
//                 </View>
//                 <View className="flex-row items-center">
//                   <Text className="text-base text-sec-black">忘記密碼 ? </Text>
//                   <Text
//                     onPress={() => setIsForgotPassword(true)}
//                     className="text-act-yellow text-base font-medium"
//                   >
//                     重設
//                   </Text>
//                 </View>
//               </View>
//             </>
//           )}
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }