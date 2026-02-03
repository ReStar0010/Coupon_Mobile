"use client";
import React, { createContext, useContext, useState } from "react";

// Define the context type
interface ToastContextType {
  showToast: (message: string) => void;
  hideToast: () => void;
}

// Create the context with a default value
const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

// Custom hook to use the toast context
export const useToast = () => useContext(ToastContext);

// The duration of the toast in milliseconds
const TOAST_DURATION = 3000;

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set the message and make toast visible
    setMessage(text);
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

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && message && (
        <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-md z-50 flex items-center">
          <span className="mr-2">✓</span>
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
};
