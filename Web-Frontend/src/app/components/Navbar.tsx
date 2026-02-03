import { FunctionComponent, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type NavbarType = {
  className?: string;
  atEasyUse?: boolean;
  atCollection?: boolean;
  atStatistics?: boolean;
};

const Navbar: FunctionComponent<NavbarType> = ({
  className = "",
  atEasyUse,
  atCollection,
  atStatistics,
}) => {
  const router = useRouter();

  const onEasyUseClick = useCallback(() => {
    // Use window.location for hard navigation to ensure cookies are properly sent
    window.location.href = "/EasyUse";
  }, []);

  const onCollectionClick = useCallback(() => {
    // Use window.location for hard navigation to ensure cookies are properly sent
    window.location.href = "/Collection";
  }, []);

  const onStatisticsClick = useCallback(() => {
    // Use window.location for hard navigation to ensure cookies are properly sent
    window.location.href = "/Statistics";
  }, []);

  return (
    <div
      className={`self-stretch h-[54px] relative shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl ${className}`}
    >
      <div className="absolute h-full w-full top-[0%] right-[0%] bottom-[0%] left-[0%] rounded-xl bg-bg-white">
        {" "}
        <div
          className={`absolute h-[66%] w-[30%] left-[4%] top-[50%] translate-y-[-50%] rounded-xl ${
            atEasyUse ? "bg-act-yellow" : ""
          } z-[1]`}
        >
          <Image
            className="absolute inset-0 m-auto w-[25px] h-[25px] object-cover cursor-pointer"
            width={25}
            height={25}
            alt="EasyUse icon"
            src="/home@2x.png"
            onClick={onEasyUseClick}
          />
        </div>{" "}
        <div
          className={`absolute h-[66%] w-[30%] left-[50%] translate-x-[-50%] top-[50%] translate-y-[-50%] rounded-xl ${
            atCollection ? "bg-act-yellow" : ""
          } z-[1]`}
        >
          <Image
            className="absolute inset-0 m-auto w-[25px] h-[25px] object-cover cursor-pointer"
            width={25}
            height={25}
            alt="Collection icon"
            src="/product@2x.png"
            onClick={onCollectionClick}
          />
        </div>{" "}
        <div
          className={`absolute h-[66%] w-[30%] right-[4%] top-[50%] translate-y-[-50%] rounded-xl ${
            atStatistics ? "bg-act-yellow" : ""
          } z-[1]`}
        >
          <Image
            className="absolute inset-0 m-auto w-[25px] h-[25px] object-cover cursor-pointer"
            width={25}
            height={25}
            alt="Statistics icon"
            src="/combo-chart@2x.png"
            onClick={onStatisticsClick}
          />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
