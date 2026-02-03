"use client";

import React from "react";

interface UnderDevelopmentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UnderDevelopmentModal: React.FC<UnderDevelopmentModalProps> = ({
    isOpen,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl max-w-[90%] w-[350px] text-center shadow-2xl">
                <div className="mb-6">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-yellow-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">功能開發中</h3>
                    <p className="text-gray-600 text-sm mb-4">
                        此功能目前仍在開發階段，敬請期待！
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="bg-act-yellow text-black font-semibold py-3 px-6 rounded-lg w-full transition-colors duration-200"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default UnderDevelopmentModal;