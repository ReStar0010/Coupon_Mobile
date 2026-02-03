"use client";
import { FunctionComponent, useMemo } from "react";
import type { CSSProperties } from "react";

type UserInfoElementType = {
  className?: string;
  prop?: string;
  content?: string;
  contentGap?: CSSProperties["gap"];
  userIconsMinWidth?: CSSProperties["minWidth"];
  userAvatarsDisplay?: CSSProperties["display"];
  userAvatarsMinWidth?: CSSProperties["minWidth"];
  lastElement?: boolean;
};

const UserInfoElement: FunctionComponent<UserInfoElementType> = ({
  className = "",
  prop,
  content,
  contentGap,
  userIconsMinWidth,
  userAvatarsDisplay,
  userAvatarsMinWidth,
  lastElement = false,
}) => {
  const contentStyle: CSSProperties = useMemo(() => {
    return {
      gap: contentGap,
    };
  }, [contentGap]);

  const userIconsStyle: CSSProperties = useMemo(() => {
    return {
      minWidth: userIconsMinWidth,
    };
  }, [userIconsMinWidth]);

  const userAvatarsStyle: CSSProperties = useMemo(() => {
    return {
      display: userAvatarsDisplay,
      minWidth: userAvatarsMinWidth,
    };
  }, [userAvatarsDisplay, userAvatarsMinWidth]);

  return (
    <div
      className={`self-stretch flex flex-col items-start justify-start gap-[18px] ${className}`}
    >
      <div
        className="self-stretch flex flex-row items-start justify-start gap-[25px]"
        style={contentStyle}
      >
        <div
          className="w-[60px] relative tracking-[-0.01em] leading-[150%] inline-block whitespace-nowrap shrink-0"
          style={userIconsStyle}
        >
          {prop}
        </div>
        <div
          className="flex-1 relative tracking-[-0.01em] leading-[150%] inline-block text-right"
          style={userAvatarsStyle}
        >
          {content}
        </div>
      </div>
      {!lastElement && <div className="self-stretch h-px relative bg-mid" />}
    </div>
  );
};

export default UserInfoElement;
