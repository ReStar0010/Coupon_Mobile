import { FunctionComponent } from "react";
import Image from "next/image";

export type SearchBarType = {
  className?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void; // Added for clearing the search input
};

const SearchBar: FunctionComponent<SearchBarType> = ({
  className = "",
  value,
  onChange,
  onClear,
}) => {
  return (
    <div
      className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-center justify-start pt-2 px-2.5 pb-[7px] box-border gap-1 max-w-full text-left text-xs text-sec-black font-jost ${className}`}
    >
      <Image
        className="h-5 w-5 relative object-cover min-h-[20px] z-[1]"
        width={20}
        height={20}
        alt="Search icon"
        src="/search@2x.png"
      />
      <input
        className="flex-1 outline-none bg-transparent text-base px-2 py-1"
        type="text"
        placeholder="輸入想尋找的酷胖"
        value={value}
        onChange={onChange}
      />
      {value && onClear && (
        <button
          className="h-5 w-5 flex items-center justify-center text-gray-500 hover:text-gray-700 z-[1]"
          onClick={onClear}
          aria-label="Clear search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;
