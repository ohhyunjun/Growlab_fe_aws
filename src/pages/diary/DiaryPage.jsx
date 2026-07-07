import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPlantsApi, getDiariesApi, createDiaryApi, updateDiaryApi, deleteDiaryApi } from "../../api/diaryApi";
import { API_ORIGIN } from "../../api/config";

const SPECIES_EMOJI = {
    "방울토마토": "🍅", "청상추": "🥬", "적상추": "🥬",
    "바질": "🌿", "딸기": "🍓", "파프리카": "🌶️",
    "브로콜리": "🥦", "고추": "🌶️", "블루베리": "🫐",
    "페퍼민트": "🌿", "청경채": "🥬", "테이블야자": "🌴",
    "산세베리아 스투키": "🪴",
};

/**
 * 포트별 식물 목록을 기기(serialNumber) 단위로 그룹핑
 * 같은 기기의 식물 중 대표 1개(첫 번째)만 사용 → 탭 1개로 표시
 */
function groupPlantsByDevice(plants) {
    const map = new Map(); // serialNumber → { representative plant, allPlantIds }
    for (const plant of plants) {
        const serial = plant.deviceSerial;
        if (!map.has(serial)) {
            map.set(serial, {
                // 탭 표시에 쓸 대표 정보
                representativeId: plant.id,
                speciesName: plant.speciesName,
                deviceSerial: plant.deviceSerial,
                deviceNickname: plant.deviceNickname,
                // 이 기기에 속한 모든 plantId (다이어리 조회 시 전부 사용)
                plantIds: [plant.id],
            });
        } else {
            map.get(serial).plantIds.push(plant.id);
        }
    }
    return Array.from(map.values());
}

function DiaryPage() {
    const navigate = useNavigate();
    // 기기 단위로 그룹핑된 탭 목록
    const [deviceGroups, setDeviceGroups] = useState([]);
    // 현재 선택된 기기 그룹
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [diaries, setDiaries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingDiary, setEditingDiary] = useState(null);
    const [selectedDiary, setSelectedDiary] = useState(null);
    const [showList, setShowList] = useState(true);
    const [form, setForm] = useState({ title: "", content: "", targetDate: "" });
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        fetchPlants();
    }, []);

    useEffect(() => {
        if (selectedGroup) fetchDiaries(selectedGroup);
    }, [selectedGroup]);

    const fetchPlants = async () => {
        try {
            const res = await getPlantsApi();
            const groups = groupPlantsByDevice(res.data);
            setDeviceGroups(groups);
            if (groups.length > 0) setSelectedGroup(groups[0]);
        } catch (err) { console.error(err); }
    };

    /**
     * 기기에 속한 모든 plantId의 다이어리를 병렬로 가져와 합침
     * (백엔드가 plantId 단위로 조회하는 구조 유지)
     */
    const fetchDiaries = async (group) => {
        setLoading(true);
        try {
            const results = await Promise.all(
                group.plantIds.map(id => getDiariesApi(id).then(r => r.data))
            );
            // 모든 포트의 다이어리를 날짜 최신순으로 정렬해서 합침
            const merged = results
                .flat()
                .sort((a, b) => new Date(b.targetDate) - new Date(a.targetDate));
            setDiaries(merged);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setImageFiles(prev => [...prev, ...files]);
        setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    };

    const removeImage = (idx) => {
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const clearImages = () => {
        setImageFiles([]);
        setImagePreviews([]);
    };

    const handleSubmit = async () => {
        if (!form.title || !form.content || !form.targetDate) {
            setError("모든 항목을 입력해주세요.");
            return;
        }
        setError("");
        try {
            const formData = new FormData();
            const diaryData = { ...form, targetDate: `${form.targetDate} 00:00:00` };
            formData.append("diaryData", new Blob([JSON.stringify(diaryData)], { type: "application/json" }));
            imageFiles.forEach(file => formData.append("files", file));

            if (editingDiary) {
                // 수정 시엔 기존 일지의 plantId 사용
                await updateDiaryApi(editingDiary.plantId, editingDiary.id, formData);
            } else {
                // 새 일지는 기기의 대표 plantId(첫 번째)로 등록
                await createDiaryApi(selectedGroup.representativeId, formData);
            }
            setShowForm(false);
            setEditingDiary(null);
            setForm({ title: "", content: "", targetDate: "" });
            clearImages();
            fetchDiaries(selectedGroup);
        } catch (err) {
            setError("저장 중 오류가 발생했습니다.");
        }
    };

    const handleEdit = (diary) => {
        setEditingDiary(diary);
        setForm({
            title: diary.title,
            content: diary.content,
            targetDate: diary.targetDate?.slice(0, 10) || "",
        });
        setImageFiles([]);
        setImagePreviews(diary.imageUrls?.map(url => `${API_ORIGIN}${url}`) || []);
        setSelectedDiary(null);
        setShowForm(true);
        setShowList(false);
    };

    const handleDelete = async (diary) => {
        if (!window.confirm("정말 삭제할까요?")) return;
        try {
            await deleteDiaryApi(diary.plantId, diary.id);
            setSelectedDiary(null);
            setShowList(true);
            fetchDiaries(selectedGroup);
        } catch (err) { console.error(err); }
    };

    const openForm = () => {
        setEditingDiary(null);
        setForm({ title: "", content: "", targetDate: "" });
        clearImages();
        setSelectedDiary(null);
        setShowForm(true);
        setShowList(false);
    };

    const handleDiarySelect = (diary) => {
        if (selectedDiary?.id === diary.id) {
            setSelectedDiary(null);
        } else {
            setSelectedDiary(diary);
            setShowForm(false);
            setShowList(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 text-sm">← 홈</button>
                    <h1 className="text-xl font-bold text-gray-800">📔 다이어리</h1>
                </div>
                {selectedGroup && (
                    <button
                        onClick={openForm}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >+ 새 일지</button>
                )}
            </div>

            {/* ✅ 기기 단위 탭 — 포트 수가 아닌 기기 수만큼만 생성 */}
            {deviceGroups.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {deviceGroups.map(group => (
                        <button
                            key={group.deviceSerial}
                            onClick={() => {
                                setSelectedGroup(group);
                                setSelectedDiary(null);
                                setShowForm(false);
                                setShowList(true);
                            }}
                            className={`flex flex-col items-start px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                                ${selectedGroup?.deviceSerial === group.deviceSerial
                                    ? "bg-green-600 text-white"
                                    : "bg-white border border-gray-200 text-gray-600 hover:border-green-400"
                                }`}
                        >
                            {/* 식물 이모지 + 품종명 */}
                            <span>
                                {SPECIES_EMOJI[group.speciesName] || "🌱"} {group.speciesName || "미등록"}
                            </span>
                            {/* ✅ 시리얼 번호 — 같은 식물 종류여도 구분 가능 */}
                            <span className={`text-[10px] mt-0.5 font-normal ${
                                selectedGroup?.deviceSerial === group.deviceSerial
                                    ? "text-green-100"
                                    : "text-gray-400"
                            }`}>
                                {group.deviceSerial}
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                    <div className="text-4xl mb-3">🌱</div>
                    <p className="text-gray-400 text-sm">등록된 식물이 없어요</p>
                </div>
            )}

            {/* 메인 영역 */}
            {selectedGroup && (
                <div className="flex flex-col sm:flex-row gap-4">

                    {/* 다이어리 목록 */}
                    <div className={`${showList || (!selectedDiary && !showForm) ? "block" : "hidden"} sm:block w-full sm:w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden`}>
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-sm font-semibold text-gray-700">
                                {SPECIES_EMOJI[selectedGroup.speciesName] || "🌱"} {selectedGroup.speciesName || "미등록"} 일지
                            </p>
                            {/* ✅ 기기 닉네임 + 시리얼 표시 */}
                            <p className="text-xs text-gray-400 mt-0.5">
                                {selectedGroup.deviceNickname && `${selectedGroup.deviceNickname} · `}{selectedGroup.deviceSerial}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">총 {diaries.length}개</p>
                        </div>
                        {loading ? (
                            <div className="p-4 text-center text-gray-400 text-sm">불러오는 중...</div>
                        ) : diaries.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">작성된 일지가 없어요</div>
                        ) : (
                            <div className="flex flex-col">
                                {diaries.map(diary => (
                                    <button
                                        key={diary.id}
                                        onClick={() => handleDiarySelect(diary)}
                                        className={`text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors
                                            ${selectedDiary?.id === diary.id ? "bg-green-50 border-l-2 border-l-green-500" : ""}`}
                                    >
                                        <p className="text-sm font-medium text-gray-800 truncate">{diary.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{diary.targetDate?.slice(0, 10)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 상세 / 작성 폼 */}
                    <div className={`${!showList || selectedDiary || showForm ? "block" : "hidden"} sm:block flex-grow bg-white rounded-xl border border-gray-200 p-5 sm:p-6`}>
                        {showForm ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 sm:hidden">
                                    <button
                                        onClick={() => { setShowForm(false); setShowList(true); }}
                                        className="text-gray-400 hover:text-gray-600 text-sm"
                                    >← 목록</button>
                                </div>
                                <h2 className="text-base font-bold text-gray-800">{editingDiary ? "일지 수정" : "새 일지 작성"}</h2>
                                {error && <div className="bg-red-50 text-red-500 text-sm rounded-lg px-4 py-2">{error}</div>}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                                    <input
                                        type="date"
                                        value={form.targetDate}
                                        onChange={e => setForm({ ...form, targetDate: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        placeholder="일지 제목을 입력하세요"
                                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                                    <textarea
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        placeholder="오늘의 식물 상태를 기록해보세요"
                                        rows={6}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                                    />
                                </div>

                                {/* 사진 첨부 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        사진 첨부 {imagePreviews.length > 0 && <span className="text-gray-400 font-normal">({imagePreviews.length}장)</span>}
                                    </label>
                                    {imagePreviews.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            {imagePreviews.map((src, idx) => (
                                                <div key={idx} className="relative aspect-square">
                                                    <img src={src} alt={`미리보기 ${idx + 1}`}
                                                        className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                                    <button onClick={() => removeImage(idx)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                                        <span className="text-xl mb-0.5">📷</span>
                                        <span className="text-xs text-gray-400">클릭하여 사진 추가 (여러 장 가능)</span>
                                        <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                                    </label>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={handleSubmit}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                                        {editingDiary ? "수정 완료" : "저장"}
                                    </button>
                                    <button
                                        onClick={() => { setShowForm(false); setEditingDiary(null); clearImages(); setShowList(true); }}
                                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
                                        취소
                                    </button>
                                </div>
                            </div>
                        ) : selectedDiary ? (
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => { setSelectedDiary(null); setShowList(true); }}
                                    className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm sm:hidden w-fit"
                                >← 목록</button>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">{selectedDiary.targetDate?.slice(0, 10)}</p>
                                        <h2 className="text-lg font-bold text-gray-800">{selectedDiary.title}</h2>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(selectedDiary)}
                                            className="text-xs text-green-600 hover:text-green-700 font-medium px-3 py-1.5 border border-green-200 rounded-lg hover:bg-green-50">수정</button>
                                        <button onClick={() => handleDelete(selectedDiary)}
                                            className="text-xs text-red-400 hover:text-red-500 px-3 py-1.5 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>
                                    </div>
                                </div>
                                <hr className="border-gray-100" />
                                {selectedDiary.imageUrls?.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {selectedDiary.imageUrls.map((url, idx) => (
                                            <img key={idx} src={`${API_ORIGIN}${url}`} alt={`일지 사진 ${idx + 1}`}
                                                className="w-full aspect-square object-cover rounded-lg border border-gray-100" />
                                        ))}
                                    </div>
                                )}
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedDiary.content}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                <div className="text-4xl mb-3">📔</div>
                                <p className="text-gray-400 text-sm">일지를 선택하거나 새 일지를 작성해보세요</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DiaryPage;
