import { FunctionComponent, useState, useEffect } from "react";
import UserInfoElement from "../../components/UserInfoElement";
import axios from "axios";
import { fetchAPI } from "@/app/utils/authAPI";

export type UserDataPanelType = {
  className?: string;
};

// User data interface
interface UserData {
  id: number;
  email: string;
  date_joined: string;
  verified: boolean;
  is_merchant: boolean;
}

const UserDataPanel: FunctionComponent<UserDataPanelType> = ({
  className = "",
}) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);

        const response = await fetchAPI("/user-info/", {method: "GET", withCredentials: true});

        setUserData(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("無法載入用戶資料，請稍後再試。");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "無日期資料";
    try {
      // Parse the ISO date string
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return "無效日期";
      
      // Get UTC components to avoid timezone issues
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
      const day = date.getUTCDate().toString().padStart(2, "0");
      
      return `${year}/${month}/${day}`;
    } catch (e) {
      return "無日期資料";
    }
  };

  return (
    <div
      className={`self-stretch ml-[27px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start pt-[31px] pb-[29px] pl-[30px] pr-[29px] box-border max-w-full text-left text-base text-sec-black font-jost ${className}`}
    >
      <div className="h-[500px] w-[331px] relative rounded-xl bg-bg-white hidden max-w-full" />
      <div className="flex-1 flex flex-col items-start justify-start gap-4 z-[1]">
        {isLoading ? (
          <div className="py-4 text-gray-500">載入中...</div>
        ) : error ? (
          <div className="py-4 text-red-500">{error}</div>
        ) : (
          <>
            <UserInfoElement
              contentGap="23px"
              prop="帳號"
              userIconsMinWidth="32px"
              content={userData?.email || "無資料"}
              userAvatarsDisplay="unset"
              userAvatarsMinWidth="unset"
            />
            <UserInfoElement
              contentGap="20px"
              prop="註冊日期"
              userIconsMinWidth="64px"
              content={formatDate(userData?.date_joined)}
              userAvatarsDisplay="inline-block"
              userAvatarsMinWidth="94px"
              lastElement={true}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default UserDataPanel;
