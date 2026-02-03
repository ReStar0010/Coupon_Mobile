"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { devDebug, devLog } from "@/app/utils/devLogger";

interface LoginFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Get returnUrl from URL if available
  const returnUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnUrl")
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/login/`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true, // This ensures cookies are sent with the request
        },
      );

      // Handle successful login
      devDebug("Login successful", response.data);

      // If returnUrl is set, redirect there, otherwise go to EasyUse
      if (returnUrl) {
        devLog("Redirecting to:", returnUrl);
        router.push(returnUrl);
      } else {
        router.push("/EasyUse");
      }
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
            setError("Login failed. Please check your credentials.");
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
          placeholder="輸入密碼"
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
        {isLoading ? "登入中..." : "登入"}
      </button>
    </form>
  );
};
