"use client";
import React, { createContext, useContext, useState, useRef } from "react";

// Define context type
export interface ToastContextType {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
}

// Create context
export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

// Custom hook for using toast
export const useToast = () => useContext(ToastContext);

// Toast duration in milliseconds
const TOAST_DURATION = 3000;

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "info"
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    text: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set the message and make toast visible
    setMessage(text);
    setToastType(type);
    setVisible(true);

    // Auto-hide after duration
    timerRef.current = setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, TOAST_DURATION);
  };

  const hideToast = () => {
    setVisible(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Determine background color based on toast type
  const getBackgroundColor = () => {
    switch (toastType) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "info":
        return "bg-act-yellow";
      default:
        return "bg-green-500";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && message && (
        <div
          className={`fixed bottom-16 left-1/2 transform -translate-x-1/2 ${getBackgroundColor()} ${toastType === "info" ? "text-sec-black" : "text-white"} px-4 py-2 rounded-lg shadow-md z-50 flex items-center max-w-[90%]`}
        >
          {toastType === "success" && <span className="mr-2">✓</span>}
          {toastType === "error" && <span className="mr-2">✗</span>}
          {toastType === "info" && <span className="mr-2">ℹ</span>}
          <span className="text-center">{message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
