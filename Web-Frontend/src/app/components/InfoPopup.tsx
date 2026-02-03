import React, { useRef } from "react";
import Image from "next/image";

interface InfoPopupProps {
  title: string;
  children: React.ReactNode;
}

const InfoPopup: React.FC<InfoPopupProps> = ({ title, children }) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const iconWrapperRef = useRef<HTMLDivElement>(null);

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const popup = popupRef.current;
    if (popup) popup.classList.toggle("hidden");

    if (!popup?.classList.contains("hidden")) {
      const closePopup = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          popup &&
          !popup.contains(target) &&
          target !== iconWrapperRef.current
        ) {
          popup.classList.add("hidden");
          document.removeEventListener("click", closePopup);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", closePopup);
      }, 0);
    }
  };
  return (
    <div className="relative inline-block align-middle">
      <div
        ref={iconWrapperRef}
        className="inline-block align-middle cursor-pointer"
        onClick={handleIconClick}
      >
        <Image
          className="w-5 h-5 ml-2 relative object-cover"
          width={20}
          height={20}
          alt="Info"
          src="/Info.png"
        />
      </div>
      <div
        ref={popupRef}
        className="hidden absolute z-10 top-6 left-1/2 transform -translate-x-1/2 w-72 bg-white shadow-lg rounded-xl p-4 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-sm mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
};

export default InfoPopup;
