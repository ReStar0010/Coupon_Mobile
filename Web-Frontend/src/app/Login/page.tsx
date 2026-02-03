"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "./Header";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { devLog } from "@/app/utils/devLogger";

// Client Component that uses useSearchParams
const LoginPageClient: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check if user was just registered or verified
  useEffect(() => {
    // 自動填入 email/password
    const urlEmail = searchParams?.get("email");
    const urlPassword = searchParams?.get("password");
    const returnUrl = searchParams?.get("returnUrl");

    if (urlEmail) setEmail(urlEmail);
    if (urlPassword) setPassword(urlPassword);
    if (
      searchParams?.get("registered") === "true" ||
      searchParams?.get("verified") === "true"
    ) {
      setIsRegistering(false);
      setIsForgotPassword(false);
    }

    // Log if returnUrl is present
    if (returnUrl) {
      devLog("Login page loaded with returnUrl:", returnUrl);
    }
  }, [searchParams]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <Header />

      {isRegistering ? (
        <>
          <RegisterForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
          />
          <footer className="mt-10 text-base text-center text-sec-black">
            <span>已經有帳號了 ? </span>
            <button
              onClick={() => setIsRegistering(false)}
              className="text-act-yellow no-underline border-none bg-transparent cursor-pointer"
            >
              登入
            </button>
          </footer>
        </>
      ) : isForgotPassword ? (
        <>
          <ForgotPasswordForm email={email} setEmail={setEmail} />
          <footer className="mt-10 text-base text-center text-sec-black">
            <span>想記起密碼了 ? </span>
            <button
              onClick={() => setIsForgotPassword(false)}
              className="text-act-yellow no-underline border-none bg-transparent cursor-pointer"
            >
              返回登入
            </button>
          </footer>
        </>
      ) : (
        <>
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
          />
          <footer className="mt-6 flex flex-col items-center gap-4 text-base text-sec-black">
            <div>
              <span>還沒有帳號嗎 ? </span>
              <button
                onClick={() => setIsRegistering(true)}
                className="text-act-yellow no-underline border-none bg-transparent cursor-pointer"
              >
                註冊
              </button>
            </div>
            <div>
              <span>忘記密碼 ? </span>
              <button
                onClick={() => setIsForgotPassword(true)}
                className="text-act-yellow no-underline border-none bg-transparent cursor-pointer"
              >
                重設
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
};

// Wrap the client component with Suspense in the default page export
const LoginPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
};

export default LoginPage;
