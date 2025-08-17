import React, { useState } from "react";
import axios from "axios";
import { View, ScrollView, SafeAreaView } from "react-native";
import { LoginFormContainer } from "./components/LoginFormContainer";
import { storeLoginData } from "app/utils/authAPI";
import { devDebug, devLog, devError } from "app/utils/devLogger";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<'login' | 'register' | 'forgotPassword'>('login');

  const handleLogin = async () => {
    // Login logic would go here
    console.log("Login attempted", { email, password });
    try{
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/login/`,
         {email, password},
        {
            headers: {
              "Content-Type": "application/json",
            },
            withCredentials: true, // This ensures cookies are sent with the request
        });
      devDebug("Login successful", response.data);
      await storeLoginData(response.data);
      devLog("Store login data successfully");

    }catch (err) {
      devError("Login error:", err);
    }
  };
  const handleRegister = () => {
    console.log("Register attempted", {email, password});
  }
  const handleForgotPassword = () => {
    console.log("Forgot Password attempted", {email});
  }
  const handleLoginPress = () =>{
    console.log("Navigate to login");
    setMode('login');
  }
  const handleRegisterPress = () => {
    // Navigate to register screen
    console.log("Navigate to register");
    setMode('register');
  };
  const handleForgotPasswordPress = () => {
    // Navigate to forgot password screen
    console.log("Navigate to forgot password");
    setMode('forgotPassword');
  };

  return (
    <SafeAreaView className="min-h-screen bg-login-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-[320px] mx-auto">
            <LoginFormContainer
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              handleLogin={handleLogin}
              handleForgotPassword={handleForgotPassword}
              handleRegister={handleRegister}
              onLoginPress={handleLoginPress}
              onRegisterPress={handleRegisterPress}
              onForgotPasswordPress={handleForgotPasswordPress}
              mode = {mode}
              setMode={setMode}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}