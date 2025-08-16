import React, { useState } from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { LoginFormContainer } from "./components/LoginFormContainer";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // Login logic would go here
    console.log("Login attempted", { email, password });
  };

  const handleRegisterPress = () => {
    // Navigate to register screen
    console.log("Navigate to register");
  };

  const handleForgotPasswordPress = () => {
    // Navigate to forgot password screen
    console.log("Navigate to forgot password");
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
              onRegisterPress={handleRegisterPress}
              onForgotPasswordPress={handleForgotPasswordPress}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}