"use client";
import {
  Suspense,
  FunctionComponent,
  useCallback,
  useState,
  useEffect,
} from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { fetchAPI, useRequireAuth } from "@/app/utils/authAPI";
import UserInfoElement from "@/app/components/UserInfoElement";
import axios from "axios";

type CouponHistoryDetail = {
  coupon_id: number;
  store_name: string;
  coupon_name: string;
  coupon_detail: string;
  used_date: string;
  estimated_savings: number;
};

const CouponHistoryDetail: FunctionComponent = () => {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useRequireAuth();
  const [couponDetail, setCouponDetail] = useState<CouponHistoryDetail | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("history");

  const onGoBackClick = useCallback(() => {
    // Navigate based on where the user came from
    if (source === "statistics") {
      router.push("/Statistics");
    } else {
      router.push("/Statistics/History");
    }
  }, [router, source]);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "無日期資料";
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

  // Format savings as currency
  const formatSavings = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "無金額資料";
    return `NT$ ${amount.toFixed(0)}`;
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const couponId = params?.id;
    if (!couponId) {
      setError("找不到優惠券紀錄");
      setIsLoading(false);
      return;
    }

    // Check navigation source
    try {
      const navigationSource = localStorage.getItem("couponNavigationSource");
      if (navigationSource) {
        setSource(navigationSource);
        localStorage.removeItem("couponNavigationSource"); // Clear after use
      }
    } catch (e) {
      console.error("Error reading navigation source:", e);
    }

    // Try to get data from localStorage first
    const storedData = localStorage.getItem("selectedCouponHistory");
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (parsedData.coupon_id.toString() === couponId) {
          setCouponDetail(parsedData);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error parsing stored coupon data:", e);
      }
    }

    // If not found in localStorage or ID doesn't match, fetch from API
    const fetchCouponDetail = async () => {
      try {
        setIsLoading(true);

        const response = await fetchAPI(`/coupon-history/${couponId}/`, {
          method: "GET",
          withCredentials: true,
        });

        if (response.data) {
          setCouponDetail(response.data);
        } else {
          setError("無法取得優惠券詳細資料");
        }
      } catch (err) {
        console.error("Error fetching coupon detail:", err);
        setError("載入優惠券詳細資料時發生錯誤");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCouponDetail();
  }, [isAuthenticated, params]);

  return (
    <div className="w-full h-dvh relative bg-bg-grey overflow-auto flex flex-col items-start justify-start pt-[35px] pb-7 pl-1 pr-0 box-border gap-[30px] leading-[normal] tracking-[normal] text-center text-[12px] text-sec-black font-jost">
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
              優惠券詳情
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
        ) : couponDetail ? (
          <div className="self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start pt-[31px] pb-[29px] pl-[30px] pr-[29px] box-border max-w-full text-left text-base text-sec-black font-jost">
            <div className="h-auto w-[331px] relative rounded-xl bg-bg-white hidden max-w-full" />
            <div className="flex-1 flex flex-col items-start justify-start gap-4 z-[1]">
              <UserInfoElement
                prop="商家"
                content={couponDetail.store_name}
                userIconsMinWidth="60px"
              />
              <UserInfoElement
                prop="優惠券"
                content={couponDetail.coupon_name || "未提供名稱"}
                userIconsMinWidth="60px"
              />
              <UserInfoElement
                prop="內容"
                content={couponDetail.coupon_detail || "無詳細說明"}
                userIconsMinWidth="60px"
              />
              <UserInfoElement
                prop="使用時間"
                content={formatDate(couponDetail.used_date)}
                userIconsMinWidth="60px"
              />
              <UserInfoElement
                prop="省下"
                content={formatSavings(couponDetail.estimated_savings)}
                userIconsMinWidth="60px"
                lastElement={true}
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center py-8 text-red-500">
            <p>找不到優惠券資料</p>
          </div>
        )}
      </section>
    </div>
  );
};

// Wrap the client component with Suspense in the default page export
const CouponHistoryDetailPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CouponHistoryDetail />
    </Suspense>
  );
};

export default CouponHistoryDetailPage;
