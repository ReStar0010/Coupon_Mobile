"use client";
import { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import UserInfoElement from "@/app/components/UserInfoElement";

const ContactUsPage = () => {
  const router = useRouter();

  const onGoBackContainerClick = useCallback(() => {
    router.push("/OptionsMenu");
  }, [router]);

  return (
    <div className="w-full h-dvh relative bg-bg-grey overflow-auto flex flex-col items-start justify-start pt-0 pb-7 pl-1 pr-0 box-border gap-[71px] leading-[normal] tracking-[normal] text-center text-[12px] text-sec-black font-jost">
      <section className="self-stretch flex flex-col items-end justify-start py-0 pl-0 pr-[31px] box-border gap-[35px] pt-[35px] max-w-full text-center text-[16px] text-sec-black font-jost">
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
              className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[32px] cursor-pointer"
              onClick={onGoBackContainerClick}
            >
              返回
            </div>
          </div>
          <div className="self-stretch flex flex-col items-start justify-start gap-[29px] text-left text-[32px]">
            <h2 className="m-0 relative text-inherit tracking-[-0.01em] leading-[150%] font-bold font-[inherit] inline-block min-w-[64px]">
              聯絡我們
            </h2>
          </div>
        </div>{" "}
        <div className="self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start pt-[31px] pb-[29px] pl-[30px] pr-[29px] box-border max-w-full text-left text-base text-sec-black font-jost">
          <div className="h-[500px] w-[331px] relative rounded-xl bg-bg-white hidden max-w-full" />
          <div className="flex-1 flex flex-col items-start justify-start gap-4 z-[1]">
            <UserInfoElement 
              prop="Gmail" 
              content="coupro707@gmail.com" 
              lastElement={true}   
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactUsPage;
