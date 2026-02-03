"use client";
import * as React from "react";

interface ConfirmationCardProps {
  title: string;
  message: string[];
  onConfirm: () => void;
}

export const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  title,
  message,
  onConfirm,
}) => {
  return (
    <section className="flex flex-col items-center px-5 pt-16 pb-6 mt-12 w-full bg-white rounded-3xl shadow-sm max-sm:px-4 max-sm:pt-16 max-sm:pb-5">
      <h1 className="mb-4 text-3xl font-bold tracking-tight leading-10 text-sec-black max-sm:text-[26px]">
        {title}
      </h1>
      <div className="mb-8 text-base leading-5 text-center text-sec-black max-sm:text-sm">
        {message.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < message.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
      <button
        onClick={onConfirm}
        className="text-base font-bold tracking-normal leading-6 text-white bg-act-yellow rounded-3xl h-[37px] w-[231px] max-sm:w-full max-sm:max-w-[231px] hover:bg-amber-500 transition-colors"
      >
        OK
      </button>
    </section>
  );
};
