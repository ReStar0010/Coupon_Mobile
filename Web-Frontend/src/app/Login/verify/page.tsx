"use client";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "../Header";
import { devDebug } from "@/app/utils/devLogger";

// Client component that uses useSearchParams
const VerifyEmailClient: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState<string>("驗證中...");
  const [error, setError] = useState<string | null>(null);
  const verifyRequestSent = useRef(false);

  useEffect(() => {
    if (!token || verifyRequestSent.current) return;

    verifyRequestSent.current = true; // 確保請求只發送一次
    setMessage("驗證中...");
    setError(null);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/verify-email/?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        devDebug("verify-email API 回傳:", data);
        if (res.ok) {
          setMessage(
            data.message
              ? data.message
                  .replace(
                    "Email verified successfully",
                    "驗證成功！請手動返回 CouPro App 登入。",
                  )
                  .replace(
                    "Email already verified",
                    "此信箱已驗證過，請手動開啟 CouPro App 登入。",
                  )
              : "驗證成功！",
          );
          setError(null);
        } else {
          setError(
            data.error
              ? data.error
                  .replace(
                    "Invalid or expired token",
                    "驗證碼無效或已過期，請重新註冊。",
                  )
                  .replace("Missing token", "驗證連結錯誤，缺少驗證碼。")
              : "驗證失敗，請確認連結是否正確。",
          );
          setMessage("");
        }
      })
      .catch(() => {
        setError("伺服器連線失敗，請稍後再試。");
        setMessage("");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // searchParams intentionally omitted to avoid unnecessary re-renders

  return (
    <main className="flex flex-col items-center px-8 py-24 min-h-screen bg-stone-50 max-md:px-6 max-md:py-16 max-sm:px-4 max-sm:py-10">
      <Header />
      <div className="flex flex-col items-center justify-center w-full max-w-[330px] bg-white rounded-3xl shadow-md p-8 mt-8 min-h-[200px]">
        <div className="flex items-center justify-center flex-grow w-full">
          {!token ? (
            <div className="text-red-600 text-base font-medium text-center">
              驗證連結錯誤，缺少驗證碼。
            </div>
          ) : error ? (
            <div className="text-red-600 text-base font-medium text-center">
              {error}
            </div>
          ) : (
            message && (
              <div className="text-green-700 text-base font-medium text-center">
                {message}
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
};

// Page component with suspense boundary
const VerifyEmailPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
};

export default VerifyEmailPage;
