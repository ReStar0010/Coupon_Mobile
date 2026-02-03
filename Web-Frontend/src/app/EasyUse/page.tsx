"use client";
import React, {
  useEffect,
  useState,
  FunctionComponent,
  useCallback,
  Suspense,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import PageHeader from "../components/PageHeader";
const MapComponent = dynamic(() => import("../components/MapComponent"), {
  ssr: false,
});
import axios from "axios";
import { fetchAPI } from "@/app/utils/authAPI";

export type CouponType = {
  className?: string;
  id?: number;
  storeName: string; // 店家名稱
  couponName: string; // 優惠名稱
  description: string; // 優惠內容
  importantNotes?: string; // 注意事項
  startDate: Date; // 有效期限開始
  expiryDate: Date; // 有效期限結束
  couponType: "store" | "exclusive"; // 優惠類型: 隨取及用 or 專屬優惠
  sourceUser?: string; // 來源用戶 (如果是朋友贈送的專屬優惠)
  storeId?: number; // 店家ID
  storeLocation?: {
    lat: number;
    lng: number;
  }; // 店家位置
  address?: string; // Add address if needed
  active_coupon_count?: number; // Added
  has_active_coupons?: boolean; // Added
  imageUrl?: string; // 店家圖片或優惠券圖片的URL
};

// Define Store interface
interface Store {
  id: number;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number;
  has_active_coupons?: boolean;
}

// 更新 interface 以匹配後端 API 回應
interface ApiCoupon {
  id: number;
  store_name: string;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: "store" | "exclusive";
  source_user?: string;
  is_redeemed: boolean;
  store_id?: number;
  store_location?: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number; // Added
  has_active_coupons?: boolean; // Added
  image_url?: string; // Added for coupon image
}

const Coupon: FunctionComponent<Partial<CouponType>> = ({
  className = "",
  description,
  couponName,
  storeName,
  id,
  imageUrl,
}) => {
  const router = useRouter();

  const onCouponClick = () => {
    if (id) {
      // 確保 id 存在
      router.push(`/EasyUse/${id}`);
    } else {
      console.error("Coupon ID is undefined, cannot navigate.");
    }
  };

  return (
    <div
      className={`self-stretch drop-shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] flex flex-row items-start justify-start shrink-0 max-w-full text-left text-xs text-sec-black font-jost`}
      onClick={onCouponClick} // 確保點擊事件綁定
      style={{ cursor: "pointer" }} // 增加鼠標提示
    >
      <div className="flex-1 flex flex-row items-start justify-start pt-[73px] px-2 pb-5 box-border relative max-w-full">
        <div className="h-full w-full absolute !m-[0] top-[0px] right-[0px] bottom-[0px] left-[0px] rounded-xl bg-bg-white" />
        <h2 className="left-[119px] absolute top-[32px] text-xl tracking-[-0.43px] leading-[22px] font-bold font-[inherit] z-[2] inline-block">
          {storeName || "店家名稱"} {/* 提供預設值 */}
        </h2>
        <div className="bottom-[5px] left-[111px] w-[204px] relative tracking-[-0.43px] leading-[23px] flex items-center shrink-0 z-[1]">
          {couponName || "優惠詳情"} {/* 提供預設值 */}
        </div>{" "}
        <div className="h-[70px] w-[70px] absolute !m-[0] top-[50%] translate-y-[-50%] left-[22px] z-[2]">
          <Image
            className="absolute h-full w-full top-[0%] right-[0%] bottom-[0%] left-[0%] max-w-full overflow-hidden max-h-full object-cover rounded-[8px]"
            width={70}
            height={70}
            alt="Coupon image"
            src={imageUrl || "/coupon_placeholder.png"}
          />
        </div>
      </div>
    </div>
  );
};

const EasyUse = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [coupons, setCoupons] = useState<CouponType[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);

  // Set initial search query from URL params on first load
  useEffect(() => {
    const searchParam = searchParams.get("search");
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, []); // Only run once on initial mount, searchParams intentionally omitted

  // const calledRef = useRef(false);

  // 拿優惠資料
  useEffect(() => {
    // if (calledRef.current) return; // Prevent multiple calls
    // calledRef.current = true; // Set to true after the first call

    const fetchCoupons = async () => {
      setIsLoading(true); // 開始載入時設為 true
      setError(null); // 清除之前的錯誤
      try {
        const response = await fetchAPI("/store-coupons/", {
          method: "GET",
          withCredentials: true,
        });

        // 檢查 response.data 是否為陣列
        if (!Array.isArray(response.data)) {
          console.error("API response is not an array:", response.data);
          throw new Error("Unexpected API response format.");
        }

        // 不需要過濾coupon_type，因為新的API端點已經返回正確類型
        const transformedCoupons = response.data.map((coupon: ApiCoupon) => ({
          id: coupon.id,
          storeName: coupon.store_name,
          couponName: coupon.coupon_name,
          description: coupon.coupon_detail,
          importantNotes: coupon.important_notes,
          startDate: new Date(coupon.start_date),
          expiryDate: new Date(coupon.expiry_date),
          couponType: coupon.coupon_type,
          sourceUser: coupon.source_user,
          storeId: coupon.store_id,
          storeLocation: coupon.store_location,
          address: coupon.address,
          active_coupon_count: coupon.active_coupon_count,
          has_active_coupons: coupon.has_active_coupons,
          imageUrl: coupon.image_url,
        }));
        setCoupons(transformedCoupons);

        // Process store information using the new fields
        const storeDataMap = new Map<number, Store>();

        transformedCoupons.forEach((coupon) => {
          if (coupon.storeId && coupon.storeLocation) {
            if (!storeDataMap.has(coupon.storeId)) {
              // Add store to the map if it doesn't exist
              storeDataMap.set(coupon.storeId, {
                id: coupon.storeId,
                name: coupon.storeName,
                location: coupon.storeLocation,
                address: coupon.address,
                // Use the fields directly from the first coupon encountered for this store
                active_coupon_count: coupon.active_coupon_count,
                has_active_coupons: coupon.has_active_coupons,
              });
            }
            // Note: active_coupon_count and has_active_coupons are per-store,
            // so we only need to set them once per store.
          }
        });

        // Convert map values to array for the state
        const storeList = Array.from(storeDataMap.values());
        setStores(storeList);
      } catch (err) {
        console.error("Error fetching coupons:", err);
        let errorMessage = "無法載入優惠券，請稍後再試。";
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            errorMessage = "請先登入或重新登入。";
            // 可選擇導向登入頁面
            // router.push('/Login');
          } else if (err.message) {
            errorMessage = `無法載入優惠券: ${err.message}`;
          }
        } else if (err instanceof Error) {
          errorMessage = err.message; // 顯示更具體的錯誤
        }
        setError(errorMessage);
        setCoupons([]); // 清空 coupons
        setStores([]); // 清空 stores
      } finally {
        setIsLoading(false);
      }
    };
    fetchCoupons();
  }, [router]); // 依賴項保持不變

  useEffect(() => {
    if (searchQuery) {
      const filtered = stores.filter((store) =>
        store.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredStores(filtered);
    } else {
      setFilteredStores(stores);
    }
  }, [searchQuery, stores]);

  const filteredCoupons = coupons.filter((coupon) => {
    // Only filter by search query, removed store filtering
    return searchQuery
      ? coupon.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coupon.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
  });

  // Add a direct function to set the search query from the map
  const setStoreSearch = useCallback((storeName: string) => {
    setSearchQuery(storeName);
  }, []);

  const onMenuIconClick = () => {
    // Store the current page path in sessionStorage before navigating
    if (typeof window !== "undefined") {
      sessionStorage.setItem("optionsMenuSource", "/EasyUse");
    }
    router.push("/OptionsMenu");
  };

  // Added function to clear search
  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div
      className={`w-full h-svh bg-bg-grey max-w-full flex flex-col items-end justify-start pt-[35px] px-[11px] gap-[10px] leading-[normal] tracking-[normal]`}
    >
      {" "}
      <PageHeader
        title="隨取即用"
        infoPopupTitle="什麼是隨取即用？"
        infoPopupContent={
          <>
            <p className="text-xs mb-2">
              「隨取即用」是 CouPro
              上的基本優惠類型，由店家提供，平台整理後讓所有用戶都能更快速方便的得知優惠資訊並直接使用。
            </p>
            <ul className="list-disc pl-4 text-xs space-y-1 mb-2">
              <li>
                <strong>人人可用：</strong> 不需抽，每人平常就能使用
              </li>
              <li>
                <strong>立即使用：</strong> 點擊並核銷優惠 → 出示給店家 →
                現場享折扣
              </li>
              <li>
                <strong>內容普遍、數量不限：</strong>{" "}
                通常為日常小折扣，使用門檻低
              </li>
              <li>
                <strong>有效期限：</strong> 每張優惠會標明截止日期，過期即無效
              </li>
            </ul>
            <p className="text-xs">
              簡單來說，隨取即用就是當你不知道要吃甚麼的時候，可以看看自己位置附近有甚麼店家折扣的一個日常所需的「優惠資訊」
            </p>
          </>
        }
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onClearSearch={clearSearch}
        navbarProps={{ atEasyUse: true }}
        sourcePage="/EasyUse"
      />
      {/* Map section - now scrollable with the page */}
      <section className="self-stretch h-[300px] shrink-0 pt-2 px-[19px] pb-2 box-border max-w-full">
        {isLoading ? (
          <div className="flex justify-center items-center w-full h-full p-4 bg-gray-100 rounded-xl">
            <p className="text-lg text-gray-500">載入地圖中...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center w-full h-full p-4 bg-gray-100 rounded-xl text-red-500">
            <p>{error}</p>
          </div>
        ) : (
          <MapComponent
            stores={filteredStores}
            className="w-full h-full rounded-xl shadow-md"
            setStoreSearch={setStoreSearch} // Pass the direct setter function
          />
        )}
      </section>
      {/* Coupon list section - now part of the main scroll */}
      <section className="self-stretch pt-2 px-[19px] pb-2 box-border gap-[15px] max-w-full flex flex-col">
        {isLoading ? (
          <div className="flex justify-center items-center w-full p-4">
            <p className="text-lg text-gray-500">載入中...</p>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center w-full p-4 text-red-500">
            <p>{error}</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="flex justify-center items-center w-full p-4">
            <p className="text-gray-500">目前沒有可用的優惠券。</p>
          </div>
        ) : (
          filteredCoupons.map((coupon) => (
            <Coupon
              key={coupon.id}
              couponName={coupon.couponName}
              storeName={coupon.storeName}
              id={coupon.id}
              imageUrl={coupon.imageUrl}
            />
          ))
        )}
      </section>
    </div>
  );
};

// Wrap the client component with Suspense in the default page export
const EasyUsePage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EasyUse />
    </Suspense>
  );
};

export default EasyUsePage;
