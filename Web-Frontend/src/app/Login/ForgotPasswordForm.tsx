"use client";
import React, { useState } from "react";
import axios from "axios";
import { devLog } from "@/app/utils/devLogger";

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  setEmail,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/forgot-password/`,
        { email },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        },
      );

      // Handle successful request
      devLog("Password reset request successful", response.data);
      setSuccess(true);
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
            setError("密碼重設請求失敗。請稍後再試。");
          }
        } else {
          setError("密碼重設請求失敗。請稍後再試。");
        }
      } else {
        setError(err instanceof Error ? err.message : "發生錯誤");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-[80%] max-w-[400px] max-sm:max-w-full">
      <h2 className="text-xl text-sec-black mb-2">重設密碼</h2>
      {success ? (
        <div className="text-green-600 bg-green-100 p-4 rounded-md text-sm font-medium mb-4 w-full">
          重設密碼連結已發送到您的電子郵件。請檢查您的收件箱。
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          <div className="px-8 py-5 bg-bg-white rounded-3xl h-[71px] flex items-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="輸入您的 Email"
              className="w-full bg-bg-white text-base border-[none] text-sec-black"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`text-base font-bold bg-act-yellow rounded-3xl cursor-pointer border-[none] h-[71px] text-sec-black ${
              isLoading ? "opacity-70" : ""
            }`}
          >
            {isLoading ? "處理中..." : "發送重設密碼連結"}
          </button>
        </form>
      )}
    </div>
  );
};
