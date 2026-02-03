import { FunctionComponent, useState, useEffect, useRef } from "react";
import Image from "next/image";

export type LargeWidgetType = {
  className?: string;
  usage?: number; // e.g. 5
  metric?: string; // e.g. "TWD"
  total?: number; // e.g. 45
  logoUrl?: string; // e.g. "/spotify.png"
  label?: string; // e.g. "spotify"
  onGoalClick?: () => void; // Callback for when the widget is clicked to set a goal
  goalAchieved?: boolean; // Whether the goal has been achieved
  onGoalReset?: () => void; // Callback for resetting the goal
  completedGoals?: { name: string; image: string; amount: number }[]; // List of completed goals to display as badges
};

const CIRCLE_SIZE = 220;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const LargeWidget: FunctionComponent<LargeWidgetType> = ({
  className = "",
  usage = 0,
  metric = "TWD",
  total = 0,
  logoUrl = "",
  label = "",
  onGoalClick,
  goalAchieved = false,
  onGoalReset,
  completedGoals = [],
}) => {
  const hasGoal = total > 0 && label !== "";
  const progress = hasGoal ? Math.min(usage / total, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const circleRef = useRef<SVGCircleElement>(null);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  // Animation for when goal is achieved
  useEffect(() => {
    if (goalAchieved && circleRef.current && !showConfirmScreen) {
      // Show the checkmark animation when goal is achieved
      setShowCheckmark(true);

      // Set a green success color
      circleRef.current.setAttribute("stroke", "#22c55e");

      // Add a little bounce animation
      const circle = circleRef.current;
      circle.style.transition =
        "stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";

      // Show confirmation screen after animation
      const animationTimeout = setTimeout(() => {
        circle.style.transition = "stroke-dashoffset 0.6s";
        setShowConfirmScreen(true);
      }, 2000);

      return () => {
        clearTimeout(animationTimeout);
      };
    } else if (!goalAchieved) {
      // Reset states when goal is not achieved (e.g., when switching to a new goal)
      setShowCheckmark(false);
      setShowConfirmScreen(false);

      // Reset circle color if ref exists
      if (circleRef.current) {
        circleRef.current.setAttribute("stroke", "#1db954");
      }
    }
  }, [goalAchieved, showConfirmScreen, label, total]); // Add label and total as dependencies to detect goal changes

  // Handle confirmation
  const handleConfirm = () => {
    setShowCheckmark(false);
    setShowConfirmScreen(false);

    // Call the reset callback
    if (onGoalReset) {
      onGoalReset();
    }
  };

  // Toggle badges display
  const toggleBadges = (e: React.MouseEvent) => {
    if (completedGoals.length > 0) {
      e.stopPropagation(); // Prevent triggering onGoalClick
      setShowBadges(!showBadges);
    }
  };

  if (showConfirmScreen && goalAchieved) {
    return (
      <div
        className={`relative bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 ${className}`}
        style={{ width: "100%", height: 300 }}
      >
        <div className="flex flex-col items-center justify-center">
          <div className="w-20 h-20 mb-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            目標已達成！
          </h3>
          <p className="text-gray-500 text-center mb-4 px-4">
            <strong>「恭喜你！你已經靠每次的優惠省下了 {label} ！」</strong>
          </p>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            onClick={handleConfirm}
          >
            確認
          </button>
        </div>
      </div>
    );
  }

  // Show badges list
  if (showBadges) {
    return (
      <div
        className={`relative bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-start p-4 ${className}`}
        style={{ width: "100%", height: 300, overflow: "auto" }}
        onClick={() => setShowBadges(false)}
      >
        <div className="w-full flex justify-between items-center mb-4">
          <h3 className="text-xl text-sec-black">已完成的儲蓄目標</h3>
          <button className="text-gray-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
          {completedGoals.map((goal, index) => (
            <div
              key={index}
              className="flex flex-col items-center bg-gray-50 rounded-lg p-3 shadow-sm"
            >
              {" "}
              <div className="w-12 h-12 rounded-full overflow-hidden mb-2 bg-white border border-gray-200">
                <Image
                  src={goal.image}
                  alt={goal.name}
                  className="w-full h-full object-cover"
                  width={48}
                  height={48}
                  unoptimized
                  onError={(e) => {
                    // Type assertion for 'e.target' to access the 'src' property
                    const imgElement = e.target as HTMLImageElement;
                    imgElement.src = "/Info.png";
                  }}
                />
              </div>
              <span className="text-sm font-medium text-center">
                {goal.name}
              </span>
              <span className="text-xs text-gray-500">
                {goal.amount} {metric}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 ${className} cursor-pointer`}
      style={{ width: "100%", height: 300 }}
      onClick={!goalAchieved ? onGoalClick : undefined}
    >
      {completedGoals.length > 0 && (
        <div
          className="absolute top-2 right-2 flex items-center justify-center bg-act-yellow hover:scale-[1.02] rounded-full w-12 h-12 cursor-pointer z-10"
          onClick={toggleBadges}
        >
          <span className="text-sm font-bold text-sec-black">
            {completedGoals.length}
          </span>
        </div>
      )}

      {hasGoal ? (
        <>
          <svg
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
            className="block"
            style={{
              position: "absolute",
              top: 30,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="#E5E7EB"
              strokeWidth={STROKE_WIDTH}
              fill="none"
              transform={`rotate(-270 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />
            <circle
              ref={circleRef}
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={goalAchieved ? "#22c55e" : "#1db954"}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s" }}
              transform={`rotate(-270 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
            />

            {/* Checkmark animation when goal is achieved */}
            {showCheckmark && (
              <g
                transform={`translate(${CIRCLE_SIZE / 2 - 30}, ${
                  CIRCLE_SIZE / 2 - 55
                }) scale(0.6)`}
              >
                <circle
                  fill="#22c55e"
                  cx="50"
                  cy="50"
                  r="50"
                  className="animate-fadeIn"
                />
                <path
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeMiterlimit="10"
                  d="M30,50 L45,65 L75,35"
                  className="animate-drawCheck"
                />
              </g>
            )}
          </svg>{" "}
          {logoUrl && !showCheckmark && (
            <div
              className="absolute"
              style={{
                top: 90,
                left: "50%",
                transform: "translateX(-50%)",
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: "#fff",
              }}
            >
              <Image
                src={logoUrl}
                alt={label}
                width={70}
                height={70}
                className="rounded-full"
                onError={(e) => {
                  // Type assertion for 'e.target' to access the 'src' property
                  const imgElement = e.target as HTMLImageElement;
                  imgElement.src = "/Info.png";
                }}
              />
            </div>
          )}
          <div
            className="flex flex-col items-center justify-center absolute"
            style={{
              top: 180,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-xl font-bold text-sec-black font-[inherit] mt-[-18px]">
              {usage}/{total} {metric}
            </div>
            <h2 className="text-xl text-sec-black mt-[-3px]">{label}</h2>
            {goalAchieved && !showConfirmScreen && (
              <div className="text-sm text-green-500 mt-3 font-medium flex items-center"></div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className="w-20 h-20 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            還沒有儲蓄目標
          </h3>
          <p className="text-gray-500 text-center mb-4 px-4">
            設定一個儲蓄目標來追蹤你的省錢進度
          </p>
          <button className="px-4 py-2 bg-act-yellow text-white rounded-md hover:scale-[1.02] transition-colors">
            設定儲蓄目標
          </button>
        </div>
      )}
    </div>
  );
};

export default LargeWidget;
