"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "../Login/Header";
import axios from "axios";

// Client component that uses useSearchParams
const ResetPasswordClient = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams?.get("token");
  const email = searchParams?.get("email");

  useEffect(() => {
    if (!token || !email) {
      setError("無效的密碼重設連結。請重新嘗試忘記密碼流程。");
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }

    if (password.length < 8) {
      setError("密碼長度至少需要8個字元");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/reset-password/`,
        {
          email,
          token,
          new_password: password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      // Handle successful reset
      setSuccess(true); // Automatically redirect to login page after 3 seconds
      setTimeout(() => {
        router.push(`/Login?email=${encodeURIComponent(email || "")}`);
      }, 3000);
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
            setError("密碼重設失敗。請稍後再試。");
          }
        } else {
          setError("無法連接到伺服器，請稍後再試。");
        }
      } else {
        setError(err instanceof Error ? err.message : "發生錯誤");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <Header />

      <div className="flex flex-col items-center gap-5 w-[80%] max-w-[400px] max-sm:max-w-full">
        <h2 className="text-xl text-sec-black mb-2">重設您的密碼</h2>

        {success ? (
          <div className="text-green-600 bg-green-100 p-4 rounded-md text-sm font-medium mb-4 w-full">
            密碼已成功重設！3秒後將自動跳轉到登入頁面...
          </div>
        ) : error && (!token || !email) ? (
          <div className="text-red-600 bg-red-100 p-4 rounded-md text-sm font-medium mb-4 w-full">
            {error}
            <div className="mt-4">
              <button
                onClick={() => router.push("/Login")}
                className="text-act-yellow no-underline border-none bg-transparent cursor-pointer"
              >
                返回登入頁面
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            <div className="px-8 py-5 bg-bg-white rounded-3xl h-[71px]">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="輸入新密碼"
                className="w-full bg-bg-white text-base border-[none] text-sec-black"
                required
                minLength={8}
              />
            </div>

            <div className="px-8 py-5 bg-bg-white rounded-3xl h-[71px]">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="確認新密碼"
                className="w-full bg-bg-white text-base border-[none] text-sec-black"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !token || !email}
              className={`text-base font-bold bg-act-yellow rounded-3xl cursor-pointer border-[none] h-[71px] text-sec-black ${
                isLoading || !token || !email ? "opacity-70" : ""
              }`}
            >
              {isLoading ? "處理中..." : "重設密碼"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

// Page component with suspense boundary
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
