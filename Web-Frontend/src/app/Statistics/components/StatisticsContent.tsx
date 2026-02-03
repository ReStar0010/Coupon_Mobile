import { FunctionComponent, useState } from "react";
import SmallWidget from "./SmallWidget";
import LargeWidget from "./LargeWidget";
import CouponHistoryList from "./CouponHistoryList";
import SavingsGoalModal from "./SavingsGoalModal";
import { StatisticsData, CompletedGoal } from "../hooks/useStatisticsData";

interface StatisticsContentProps {
  stats: StatisticsData;
  completedGoals: CompletedGoal[];
  isLoading: boolean;
  error: string | null;
  onGoalSave: (goalName: string, goalAmount: number, goalImage: string) => void;
  onGoalReset: () => void;
}

const StatisticsContent: FunctionComponent<StatisticsContentProps> = ({
  stats,
  completedGoals,
  isLoading,
  error,
  onGoalSave,
  onGoalReset,
}) => {
  // Modal state
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Function to open goal setting modal
  const handleOpenGoalModal = () => {
    setShowGoalModal(true);
  };

  // Function to save goal from modal
  const handleSaveGoal = (
    goalName: string,
    goalAmount: number,
    goalImage: string
  ) => {
    onGoalSave(goalName, goalAmount, goalImage);
    setShowGoalModal(false);
  };

  if (isLoading) {
    return (
      <div className="w-full flex justify-center py-8">
        <p className="text-lg text-gray-500">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center py-8 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <LargeWidget
        usage={stats.monthlySavings}
        total={stats.savingsGoalAmount}
        metric="元"
        logoUrl={stats.savingsGoalImage}
        label={stats.savingsGoalName}
        onGoalClick={handleOpenGoalModal}
        goalAchieved={stats.goalAchieved}
        onGoalReset={onGoalReset}
        completedGoals={completedGoals}
      />

      <CouponHistoryList />

      <div className="w-full flex flex-row justify-between gap-[15px]">
        <SmallWidget
          description="已使用"
          usage={stats.couponsUsedCount}
          metric="張優惠券"
        />
        <SmallWidget
          description="總共省下"
          usage={stats.totalSavings}
          metric="元"
        />
      </div>

      {/* Savings Goal Modal */}
      <SavingsGoalModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onSave={handleSaveGoal}
        currentGoalName={stats.savingsGoalName}
        currentGoalAmount={stats.savingsGoalAmount}
        currentGoalImage={stats.savingsGoalImage}
      />
    </>
  );
};

export default StatisticsContent;
