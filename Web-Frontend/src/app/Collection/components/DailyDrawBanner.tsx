"use client";

import React from "react";

interface DailyDrawBannerProps {
  onClick: () => void;
}

const DailyDrawBanner: React.FC<DailyDrawBannerProps> = ({ onClick }) => {
  return (
    <div className="w-full mb-4">
      <div
        className="w-full bg-act-yellow rounded-xl p-4 shadow-md text-center cursor-pointer"
        onClick={onClick}
      >
        <h3 className="text-xl font-bold mb-2">每日抽獎</h3>
        <p className="text-sm">點擊這裡抽取今日專屬優惠！</p>
      </div>
    </div>
  );
};

export default DailyDrawBanner;
