import { FunctionComponent, useCallback, useState, useEffect } from "react";
import HistoryListElement from "./HistoryListElement";
import { useRouter } from "next/navigation";
import axios from "axios";
import { fetchAPI } from "@/app/utils/authAPI";

export type HistoryItem = {
  redemption_id: number;
  coupon_id: number;
  store_name: string;
  used_date: string;
};

export type CouponHistoryListType = {
  className?: string;
};

const CouponHistoryList: FunctionComponent<CouponHistoryListType> = ({
  className = "",
}) => {
  const router = useRouter();
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const onViewMoreClick = useCallback(() => {
    router.push("/Statistics/History");
  }, [router]);

  // Handler for clicking on a history item
  const onHistoryItemClick = useCallback((couponId: number, item: HistoryItem) => {
    // Store the item data in localStorage for use in detail page
    localStorage.setItem('selectedCouponHistory', JSON.stringify(item));
    // Set navigation source to 'statistics' so the back button returns to Statistics page
    localStorage.setItem('couponNavigationSource', 'statistics');
    router.push(`/Statistics/History/${couponId}`);
  }, [router]);

  // Fetch the latest 2 history items
  useEffect(() => {
    const fetchRecentHistory = async () => {
      try {
        setIsLoading(true);

        const response = await fetchAPI("/coupon-history/", { method: "GET", withCredentials: true, });
        
        // Get the most recent 2 items
        const history = response.data.history || [];
        setRecentHistory(history.slice(0, 2));
      } catch (err) {
        console.error("Error fetching recent history:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentHistory();
  }, []);

  return (
    <section
      className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start py-[25px] px-[27px] text-left text-base text-sec-black font-jost ${className}`}
    >
      <div className="flex-1 overflow-y-auto flex flex-col items-start justify-start gap-3">
        {isLoading ? (
          <div className="text-center w-full py-2 text-gray-500">載入中...</div>
        ) : recentHistory.length > 0 ? (
          recentHistory.map((item, index) => (
            <HistoryListElement
              key={item.redemption_id}
              prop={item.store_name}
              separator={formatDate(item.used_date)}
              forward="/forward-1@2x.png"
              couponId={item.coupon_id}
              couponData={item}
              lastElement={index === recentHistory.length - 1}
              onItemClick={() => onHistoryItemClick(item.coupon_id, item)}
            />
          ))
        ) : (
          <div className="text-center w-full py-2 text-gray-500">尚無使用紀錄</div>
        )}

        {/* View More Button */}
        <div
          className="self-stretch flex justify-center items-center pt-3 border-t border-gray-200 cursor-pointer"
          onClick={onViewMoreClick}
        >
          <span className="text-act-yellow font-medium">查看更多</span>
        </div>
      </div>
    </section>
  );
};

// Helper function to format date
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

export default CouponHistoryList;
