// 화면 비율 자동 맞춤
// 디자인은 1920px 기준. 그보다 좁은 PC 화면에서는 브라우저 축소(Ctrl -)와 같은 방식으로
// 전체를 같은 비율로 줄여서 1920 화면과 똑같은 구성으로 보이게 한다. (예: 1536px 노트북 → 80%)
// - 1920px 이상: 100% 그대로 (확대하지 않음)
// - 1024px 미만(모바일·태블릿): 적용하지 않음
// - 너무 작아지지 않도록 최소 67%
const DESIGN_WIDTH = 1920;
const DESKTOP_MIN_WIDTH = 1024;
const MIN_ZOOM = 0.67;

function getZoom() {
    const width = window.innerWidth;
    if (width < DESKTOP_MIN_WIDTH || width >= DESIGN_WIDTH) return 1;
    return Math.max(MIN_ZOOM, width / DESIGN_WIDTH);
}

export function initAppZoom(target) {
    const apply = () => {
        const zoom = getZoom();
        target.style.zoom = zoom === 1 ? "" : String(zoom);
        // 화면 높이를 쓰는 곳(--screen-h)이 축소 비율만큼 보정되도록 CSS에 전달
        document.documentElement.style.setProperty("--app-zoom", String(zoom));
    };
    apply();
    window.addEventListener("resize", apply);
}
