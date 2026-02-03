"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";
import InfoPopup from "../components/InfoPopup";

interface PageHeaderProps {
  title: string;
  infoPopupTitle?: string;
  infoPopupContent?: React.ReactNode;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch?: () => void;
  navbarProps?: {
    atCollection?: boolean;
    atEasyUse?: boolean;
    atStatistics?: boolean;
  };
  sourcePage: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  infoPopupTitle,
  infoPopupContent,
  showSearch = false,
  searchQuery = "",
  onSearchChange,
  onClearSearch,
  navbarProps = {},
  sourcePage,
}) => {
  const router = useRouter();

  const onMenuIconClick = useCallback(() => {
    // Store the current page path in sessionStorage before navigating
    if (typeof window !== "undefined") {
      sessionStorage.setItem("optionsMenuSource", sourcePage);
    }
    router.push("/OptionsMenu");
  }, [router, sourcePage]);

  return (
    <section className="self-stretch flex flex-row items-start justify-end py-0 pl-5 pr-[17px] box-border max-w-full text-left text-13xl text-sec-black font-jost">
      <div className="flex-1 flex flex-col items-start justify-start gap-[25px] max-w-full">
        <div className="self-stretch flex flex-col items-start justify-start gap-[17px]">
          <div className="self-stretch flex flex-row items-start justify-between gap-5">
            <div className="flex items-center relative">
              <h1 className="text-[32px] m-0 relative tracking-[-0.01em] leading-[150%] font-bold font-[inherit]">
                {title}
              </h1>
              {infoPopupTitle && infoPopupContent && (
                <InfoPopup title={infoPopupTitle}>{infoPopupContent}</InfoPopup>
              )}
            </div>{" "}
            <div className="flex flex-col items-start justify-start pt-1 px-0 pb-0">
              <Image
                className="w-10 h-10 relative object-cover cursor-pointer"
                width={40}
                height={40}
                loading="lazy"
                alt="Menu icon"
                src="/menu@2x.png"
                onClick={onMenuIconClick}
              />
            </div>
          </div>
          <Navbar {...navbarProps} />
        </div>
        {showSearch && onSearchChange && onClearSearch && (
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onClearSearch}
          />
        )}
      </div>
    </section>
  );
};

export default PageHeader;
