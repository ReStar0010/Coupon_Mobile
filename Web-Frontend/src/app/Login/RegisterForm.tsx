"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";

interface RegisterFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if redirected with registered=true parameter
  useEffect(() => {
    const registered = searchParams.get("registered");
    if (registered === "true") {
      setSuccessMessage("註冊成功！請登入您的帳號。");
    }
  }, [searchParams]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setVerificationLink(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/register/`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      ); // 顯示驗證訊息，通知用戶檢查電子郵件，並提醒可能需要等待
      setSuccessMessage(
        "註冊成功！請檢查您的電子郵件，我們已發送驗證連結至您的信箱。若未收到郵件，請稍候幾分鐘，並檢查垃圾郵件資料夾。"
      );
      // 不再設定驗證連結，因為已經通過電子郵件發送
      setVerificationLink(null);
    } catch (err) {
      // Handle axios errors
      if (axios.isAxiosError(err)) {
        if (err.response?.data) {
          const errorData = err.response.data;
          if (errorData.error) {
            setError(errorData.error);
          } else if (errorData.message) {
            setError(errorData.message);
          } else {
            setError("Registration failed. Please try again.");
          }
        } else {
          setError("Unable to connect to the server. Please try again later.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 w-[80%] max-w-[400px] max-sm:max-w-full"
    >
      {" "}
      {successMessage && (
        <div className="text-green-600 bg-green-100 p-3 rounded-md text-sm font-medium">
          {successMessage}
        </div>
      )}
      <div className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="輸入 Email"
          className="w-full bg-bg-white text-base border-[none] text-sec-black"
          required
        />
      </div>
      <div className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="設定密碼"
          className="w-full bg-bg-white text-base border-[none] text-sec-black"
          required
        />
      </div>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <button
        type="submit"
        disabled={isLoading}
        className={`text-base font-bold bg-act-yellow rounded-3xl cursor-pointer border-[none] h-[71px] text-sec-black ${
          isLoading ? "opacity-70" : ""
        }`}
      >
        {isLoading ? "註冊中..." : "註冊"}
      </button>
    </form>
  );
};
