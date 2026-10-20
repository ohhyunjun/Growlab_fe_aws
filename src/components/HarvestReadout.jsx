import { harvestView } from "../utils/harvestPrediction";

const date = (value) => new Date(value).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
const messages = {
    WAITING_OBSERVATION: "첫 촬영 기록을 기다리고 있어요.",
    WAITING_ANCHOR: "사진을 모아 예측 시작 단계를 확인하고 있어요.",
    NO_DETECTION: "최근 사진에서 식물을 확인하지 못했어요. 카메라 위치를 확인해 주세요.",
    PORT_OFF: "이 포트는 꺼져 있어요. 다시 켜면 관측을 이어갑니다.",
    UNSUPPORTED_CROP: "이 품종의 수확기 예측은 아직 제공하지 않아요.",
    LOAD_ERROR: "예측 결과를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
};

export default function HarvestReadout({ plant, prediction }) {
    const value = harvestView(plant, prediction);
    return (
        <section className="rounded-xl bg-gray-50 p-4" aria-label="AI 수확기 예상">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-caption font-bold text-gray-500">수확기 예상</h3>
                <span className="text-caption text-brand rounded-full bg-brand-cream px-2 py-1">영상 기반 AI</span>
            </div>
            {value.status === "HARVEST_READY" ? (
                <>
                    <p className="text-h4 font-bold text-brand">수확기 도달 확인</p>
                    <p className="text-caption text-gray-500 mt-1">누적 촬영에서 수확기 모습이 확인됐어요.</p>
                </>
            ) : value.status === "PREDICTED" ? (
                <>
                    <div className="flex items-baseline gap-3">
                        <p className="shrink-0 text-h2 font-bold text-gray-800">{date(value.expectedAt)}</p>
                        <span className="whitespace-nowrap text-body2 text-gray-600">{value.overdue ? "예상일 지남" : value.days === 0 ? "오늘" : `약 ${value.days}일 후`}</span>
                    </div>
                </>
            ) : <p className="text-body2 text-gray-600 py-2">{messages[value.status] || messages.WAITING_OBSERVATION}</p>}
        </section>
    );
}
