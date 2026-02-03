"use client";
import { useCallback } from "react";
import TextPanel from "./TextPanel";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { on } from "events";

const Terms = () => {
  const router = useRouter();

  const onClickBack = useCallback(() => {
    router.push("/OptionsMenu");
  }, [router]);

  return (
    <div
      className={`bg-bg-grey h-dvh max-w-full overflow-auto flex flex-col items-start justify-start pt-[35px] px-[31px] pb-11 box-border gap-[29px] leading-[normal] tracking-[normal] text-center text-base text-sec-black font-jost`}
    >
      <div className="flex flex-col items-start justify-start gap-[22px]">
        {" "}
        <div className="flex flex-row items-start justify-start gap-[9px]">
          <div className="flex flex-col items-start justify-start pt-[4.5px] px-0 pb-0">
            <Image
              className="w-[15px] h-[15px] relative object-contain"
              width={15}
              height={15}
              alt="Back arrow"
              src="/forward@2x.png"
            />
          </div>
          <div
            className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[32px]"
            onClick={onClickBack}
          >
            返回
          </div>
        </div>
        <h1 className="m-0 relative text-[32px] tracking-[-0.01em] leading-[150%] font-bold font-[inherit] text-left inline-block min-w-[127px]">
          權益須知
        </h1>
      </div>
      <TextPanel />
    </div>
  );
};

export default Terms;