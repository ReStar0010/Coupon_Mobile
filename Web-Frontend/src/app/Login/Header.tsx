import React from "react";
import { Logo } from "./Logo";

export const Header: React.FC = () => {
  return (
    <header className="flex flex-col items-center">
      <div className="flex gap-4 md:gap-8 items-center mb-4 md:mb-7">
        <Logo />
        <h1 className="text-6xl md:text-6xl font-bold leading-tight">
          <span className="text-act-yellow font-bold">Cou</span>
          <span className="text-sec-black font-bold">Pro</span>
        </h1>
      </div>
      <p className="mb-12 md:mb-24 text-md md:text-base font-bold leading-normal md:leading-7 text-center text-sec-black">
        All your coupons, right here, right now.
      </p>
    </header>
  );
};
