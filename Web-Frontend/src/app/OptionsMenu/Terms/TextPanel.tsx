import { FunctionComponent } from "react";

export type TextPanelType = {
  className?: string;
};

const TextPanel: FunctionComponent<TextPanelType> = ({ className = "" }) => {
  return (
    <section
      className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-start justify-start py-[33.3px] px-[27px] text-left text-base text-sec-black font-jost ${className}`}
    >
      <div className="flex-1 overflow-y-auto flex flex-row items-start justify-start py-0 px-0.5">
        <div className="mt-[-1.3px] h-[540px] flex-1 relative leading-[27px] inline-block">
          <p className="m-0">歡迎使用 CouPro！為了保障所有使用者與合作商家的權益，請留意以下幾點使用規則：</p>

          <p className="m-0 font-bold mt-4">一、使用即表示同意以下事項：</p>
          <ul className="list-disc pl-6 mb-4">
            <li className="m-0">遵守平台規範，誠實使用優惠券</li>
            <li className="m-0">不得以任何形式轉賣或惡意使用優惠</li>
            <li className="m-0">不得以機器人、腳本等方式自動操作或濫用優惠</li>
          </ul>

          <p className="m-0 font-bold mt-4">二、優惠券說明：</p>
          <ul className="list-disc pl-6 mb-4">
            <li className="m-0">所有優惠皆由合作商家提供，優惠內容與有效期限以商家設定為準，平台不負責兌現</li>
            <li className="m-0">優惠內容可能隨時變動，請於使用前再次確認</li>
            <li className="m-0">「隨取即用」為公開優惠；「專屬酷胖」則需登入帳號抽取或經他人轉傳獲得</li>
          </ul>

          <p className="m-0 font-bold mt-4">三、會員資料與帳號規範：</p>
          <ul className="list-disc pl-6 mb-4">
            <li className="m-0">請妥善保管您的帳號資訊，勿與他人共用</li>
            <li className="m-0">遇有違規行為（如濫用優惠、冒用他人身份等），平台有權限制使用或停權處理</li>
            <li className="m-0">平台不會主動向您索取密碼或個人付款資訊</li>
          </ul>

          <p className="m-0 font-bold mt-4">四、商家資訊與服務：</p>
          <ul className="list-disc pl-6 mb-4">
            <li className="m-0">各店家優惠內容、服務條件與商品皆由商家提供與負責</li>
            <li className="m-0">如有任何糾紛，建議直接與商家聯繫，我們也樂意協助處理</li>
          </ul>

          <p className="m-0 font-bold mt-4">CouPro 致力於提供方便、安全的優惠體驗，感謝您的支持與配合！</p>
        </div>
      </div>
    </section>
  );
};

export default TextPanel;