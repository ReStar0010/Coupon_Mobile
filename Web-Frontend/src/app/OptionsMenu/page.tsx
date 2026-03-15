"use client";
import { FunctionComponent, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { logout } from "@/app/utils/authAPI"; // 統一的認證與API工具
import OptionsLinkPanel from "./OptionsLinkPanel";

const OptionsMenu: FunctionComponent = () => {
  const router = useRouter();
  const [sourcePage, setSourcePage] = useState<string>("/EasyUse"); // Default fallback

  // Detect the source page when the component mounts
  useEffect(() => {
    // Get the referrer from sessionStorage if available
    const storedSourcePage = sessionStorage.getItem("optionsMenuSource");
    if (storedSourcePage) {
      setSourcePage(storedSourcePage);
    } else {
      // If no stored value, check document.referrer (might not work for SPA navigation)
      // Fallback to default page if unable to determine
      setSourcePage("/EasyUse");
    }
  }, []);

  const onUserDataContainerClick = useCallback(() => {
    router.push("/OptionsMenu/UserData");
  }, [router]);

  const onClickBack = useCallback(() => {
    // Navigate back to the source page instead of using router.back()
    router.push(sourcePage);
  }, [router, sourcePage]);

  // 登出功能 - 使用 cookie 方式
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("登出失敗:", error);
      // 即使 API 請求失敗，也清除前端狀態並重定向
      document.cookie =
        "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "is_logged_in=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      Promise.resolve(router.push("/Login")).catch(() => {
        // Fallback: force navigate if router.push fails
        window.location.href = "/Login";
      });
    }
  };

  return (
    <div className="w-full h-dvh relative bg-bg-grey overflow-auto flex flex-col items-start justify-between pt-[35px] pb-7 pl-1 pr-0 box-border gap-[71px] leading-[normal] tracking-[normal] text-center text-[12px] text-sec-black font-jost">
      <section className="self-stretch flex flex-col items-end justify-start py-0 pl-0 pr-[31px] box-border gap-[35px] max-w-full text-center text-[16px] text-sec-black font-jost">
        <div className="self-stretch flex flex-col items-start justify-start pt-0 pb-[5px] pl-[27px] pr-0 gap-[22px]">
          <div className="flex flex-row items-start justify-start gap-[9px]">
            <div className="flex flex-col items-start justify-start pt-[4.5px] px-0 pb-0">
              <Image
                className="w-[15px] h-[15px] relative object-contain"
                loading="lazy"
                alt=""
                src="/forward@2x.png"
                width={15}
                height={15}
              />
            </div>
            <div
              className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[32px]"
              onClick={onClickBack}
            >
              返回
            </div>
          </div>
          <div className="self-stretch flex flex-col items-start justify-start gap-[29px] text-left text-[32px]">
            <h2 className="m-0 relative text-inherit tracking-[-0.01em] leading-[150%] font-bold font-[inherit] inline-block min-w-[64px]">
              選單
            </h2>
            <div
              className="self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-col items-end justify-center py-7 pl-[25px] pr-4 cursor-pointer text-center text-xl"
              onClick={onUserDataContainerClick}
            >
              <div className="self-stretch flex flex-row items-center justify-between py-0 pl-0 pr-[3px] gap-5">
                <div className="flex flex-row items-center justify-start gap-[18px]">
                  <Image
                    className="h-10 w-10 relative object-cover"
                    alt=""
                    src="/user@2x.png"
                    width={40}
                    height={40}
                  />
                  <div className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[80px]">
                    用戶資料
                  </div>
                </div>
                <Image
                  className="h-5 w-5 relative object-cover z-[1]"
                  alt=""
                  src="/forward-1@2x.png"
                  width={20}
                  height={20}
                />
              </div>
            </div>
          </div>
        </div>
        <OptionsLinkPanel />
        <div
          className="self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start py-[15px] px-[25px] box-border gap-[43px] max-w-full cursor-pointer text-xl text-tomato"
          onClick={handleLogout} // 登出功能
        >
          <Image
            className="h-10 w-10 relative object-cover"
            alt=""
            src="/logout@2x.png"
            width={40}
            height={40}
          />
          <div className="flex flex-col items-start justify-start pt-[5px] px-0 pb-0">
            <div className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[40px]">
              登出
            </div>
          </div>
        </div>
      </section>

      <div className="self-stretch flex flex-row items-start justify-center py-0 pl-5 pr-[23px]">
        <div className="w-[134px] relative tracking-[-0.01em] leading-[150%] inline-block shrink-0">
          <p className="m-0">Version 1.0.0</p>
          <p className="m-0">
            {`Icons by `}
            <a
              className="text-[inherit]"
              href="https://icons8.com/"
              target="_blank"
            >
              <span className="[text-decoration:underline]">icons8</span>
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OptionsMenu; // 直接匯出，不用動態載入
