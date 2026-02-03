"use client";
import { Suspense, FunctionComponent } from "react";
import PageHeader from "../components/PageHeader";
import { useRequireAuth } from "@/app/utils/authAPI";
import { useStatisticsData } from "./hooks/useStatisticsData";
import { useAuthCheck } from "./hooks/useAuthCheck";
import { useNavigateToOptionsMenu } from "./utils/navigation";
import StatisticsContent from "./components/StatisticsContent";

const Statistics: FunctionComponent = () => {
  // Authentication hooks
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  useAuthCheck(isAuthenticated, authLoading);

  // Navigation hook
  const navigateToOptionsMenu = useNavigateToOptionsMenu();

  // Statistics data hook
  const { stats, completedGoals, isLoading, error, setSavingsGoal, resetGoal } =
    useStatisticsData(isAuthenticated);

  // Show loading indicator while authentication is in progress
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-lg text-gray-500">載入中...</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-svh bg-bg-grey max-w-full flex flex-col items-end justify-start pt-[35px] px-[11px] gap-[10px] leading-[normal] tracking-[normal]`}
    >
      <PageHeader
        title="成就列表"
        navbarProps={{ atStatistics: true }}
        infoPopupTitle="成就列表｜讓每一次省錢都更有意義"
        infoPopupContent={
          <>
            <p className="text-xs mb-2">
              你知道嗎？每天省下一點點，累積起來也是一筆可觀的金額！<br></br>
              因此我們設計了一個<strong>成就系統</strong>
              ，讓你可以設定目標，看見自己「默默存下來的驚喜」。
            </p>
            <p className="text-xs mb-2">
              <strong>如何使用？</strong>
            </p>
            <ol className="list-decimal pl-4 text-xs space-y-1 mb-2">
              <li>
                <strong>在「成就列表」中，輸入一個你想存下的目標金額</strong>{" "}
                <ul>
                  <li>例如：Netflix 訂閱費，每月 92 元</li>
                  <li>(範例名稱僅供參考，與該品牌無直接合作關係。)</li>
                </ul>
              </li>
              <li>
                <strong>上傳一張圖片，代表這個目標</strong>{" "}
              </li>
              <li>
                <strong>
                  每次你在 CouPro
                  上成功使用一張優惠，我們都會幫你紀錄你省下的金額
                </strong>{" "}
              </li>
              <li>
                <strong>
                  當累積省下的金額達到你的目標時，畫面會跳出通知 🎉：
                </strong>
                <br></br>
                <br></br>
                <strong>「恭喜你！你已經靠每次的優惠省下了 Netflix ！」</strong>
              </li>
            </ol>
            <div className="text-xs">
              <p className="text-xs mb-2">
                <br></br>
                <strong>設計理念</strong>
              </p>

              <p className="text-xs mb-2">
                「這不僅是省錢，是存一個 Netflix、存一杯拿鐵、存一場小旅行。」
                <br></br>
                <br></br>
                每一塊錢都有價值，這個成就系統不是為了比誰省得多， 而是讓你
                <strong>重新看見自己在日常中的小努力</strong>。<br></br>
                <br></br>
                你也可以設定很多種目標：
              </p>

              <ul className="list-disc pl-4 text-xs space-y-1 mb-2">
                <li>Netflix 每個月的訂閱費 92元</li>
                <li>假日下午的一杯咖啡 150 元</li>
                <li>一場電影票 280 元</li>
                <li>下一次出遊的車票錢！</li>
              </ul>
            </div>
          </>
        }
        sourcePage="/Statistics"
      />
      <section className="self-stretch overflow-y-auto shrink-0 flex flex-col items-start justify-start pt-[23px] px-[19px] pb-[13px] box-border gap-[25px] max-w-full">
        <StatisticsContent
          stats={stats}
          completedGoals={completedGoals}
          isLoading={isLoading}
          error={error}
          onGoalSave={setSavingsGoal}
          onGoalReset={resetGoal}
        />
      </section>
    </div>
  );
};

// Wrap the client component with Suspense in the default page export
const StatisticsPage = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Statistics />
    </Suspense>
  );
};

export default StatisticsPage;
