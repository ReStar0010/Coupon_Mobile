"use client";
import {
  Suspense,
  FunctionComponent,
  useCallback,
  useState,
  useEffect,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRequireAuth, fetchAPI } from "@/app/utils/authAPI";
import { useToast } from "@/app/components/providers/ToastProvider";

type CouponHistoryItem = {
  coupon_id: number;
  store_name: string;
  coupon_name?: string;
  coupon_detail?: string;
  used_date: string;
  estimated_savings?: number;
};

const CouponHistory: FunctionComponent = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  // State for coupon history
  const [history, setHistory] = useState<CouponHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onGoBackClick = useCallback(() => {
    router.push("/Statistics");
  }, [router]);

  const onHistoryItemClick = useCallback(
    (item: CouponHistoryItem) => {
      // Store the selected coupon in localStorage to access it from the details page
      localStorage.setItem("selectedCouponHistory", JSON.stringify(item));
      // Set navigation source to 'history' so the back button returns to the History page
      localStorage.setItem("couponNavigationSource", "history");
      router.push(`/Statistics/History/${item.coupon_id}`);
    },
    [router],
  );

  // Fetch coupon history
  const fetchCouponHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchAPI("/coupon-history/", {
        method: "GET",
        withCredentials: true,
      });

      setHistory(response.data.history || []);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching coupon history:", err);
      setError("無法載入優惠券使用紀錄，請稍後再試。");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCouponHistory();
    }
  }, [isAuthenticated]);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-lg text-gray-500">載入中...</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.getFullYear()}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}, ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="w-full h-svh relative bg-bg-grey flex flex-col items-start justify-start pt-[35px] pl-1 pr-0 box-border gap-[30px] leading-[normal] tracking-[normal] text-center text-[12px] text-sec-black font-jost">
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
              className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[32px] cursor-pointer"
              onClick={onGoBackClick}
            >
              返回
            </div>
          </div>
          <div className="self-stretch flex flex-col items-start justify-start gap-[29px] text-left text-[32px]">
            <h2 className="m-0 relative text-inherit tracking-[-0.01em] leading-[150%] font-bold font-[inherit] inline-block min-w-[64px]">
              使用紀錄
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full flex justify-center py-8">
            <p className="text-lg text-gray-500">載入中...</p>
          </div>
        ) : error ? (
          <div className="w-full flex justify-center py-8 text-red-500">
            <p>{error}</p>
          </div>
        ) : (
          <div className="self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-col items-start justify-start pt-[25px] pb-[25px] pl-[27px] pr-[27px] box-border max-w-full text-left text-base text-sec-black font-jost">
            <div className="w-[331px] relative rounded-xl bg-bg-white hidden max-w-full" />
            <div className="flex-1 w-full flex flex-col items-start justify-start gap-3 z-[1]">
              {history.length > 0 ? (
                history.map((item, index) => (
                  <div
                    key={index}
                    className="self-stretch flex flex-col items-start justify-start gap-2 shrink-0 cursor-pointer"
                    onClick={() => onHistoryItemClick(item)}
                  >
                    <div className="self-stretch flex flex-row items-start justify-between gap-5">
                      <div className="flex flex-col items-start justify-start">
                        <div className="relative tracking-[-0.01em] leading-[150%] inline-block min-w-[96px]">
                          {item.store_name}
                        </div>
                        <div className="relative text-xs tracking-[-0.01em] leading-[150%] text-top inline-block min-w-[99px] whitespace-nowrap">
                          {formatDate(item.used_date)}
                        </div>
                      </div>{" "}
                      <div className="flex flex-col items-start justify-start pt-2 px-0 pb-0">
                        <Image
                          className="w-5 h-5 relative object-cover"
                          width={20}
                          height={20}
                          alt="Forward icon"
                          src="/forward-1@2x.png"
                        />
                      </div>
                    </div>
                    {index < history.length - 1 && (
                      <div className="w-full h-px relative bg-mid" />
                    )}
                  </div>
                ))
              ) : (
                <div className="self-center py-8 text-gray-500">
                  尚無使用紀錄
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

// Wrap the client component with Suspense in the default page export
const CouponHistoryPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CouponHistory />
    </Suspense>
  );
};

export default CouponHistoryPage;
