// 서버는 시각을 타임존 없는 LocalDateTime(한국 벽시계)으로 저장한다.
// new Date().toISOString()은 UTC라서 서버가 기록하는 createdAt(KST)과 9시간 어긋난다.
// 그래서 클라이언트가 보내는 시각은 "로컬(한국) 벽시계"를 그대로 문자열로 보낸다.
// 예: 14:00 KST → "2026-09-20T14:00:00" (Z 없음). 서버 LocalDateTime과 일치.
export const toLocalISO = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, "0");
    return (
        `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
        `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    );
};
