import {
  FunctionComponent,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

export type SmallWidgetType = {
  className?: string;
  description?: string;
  usage?:number;
  metric?:string;
};

const SmallWidget: FunctionComponent<SmallWidgetType> = ({ className = "", description, usage, metric}) => {
  return (
    <div className="w-[48%] aspect-square drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex justify-center items-center">
      <div className="flex flex-col justify-center items-center gap-[20px] w-full p-[10%] text-sec-black">
        <h2 className="text-lg tracking-[-0.43px] leading-[22px] font-[inherit] z-[2] inline-block">
          {description}
        </h2>
        <h2 className="text-[2em] tracking-[-0.43px] leading-[30px] font-bold font-[inherit] z-[2] inline-block">
          {usage}
        </h2>
        <h2 className="text-lg tracking-[-0.43px] leading-[22px] font-[inherit] z-[2] inline-block">
          {metric}
        </h2>
      </div>
    </div>
  );
};

export default SmallWidget;
