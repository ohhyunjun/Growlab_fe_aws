import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDiariesApi, createDiaryApi, updateDiaryApi, deleteDiaryApi } from "../../api/diaryApi";
import { getUserDevicesApi } from "../../api/deviceApi";
import { assetUrl } from "../../api/config";
import { compressImageFiles } from "../../utils/imageCompression";

function DiaryPage() {
    const navigate = useNavigate();
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [diaries, setDiaries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingDiary, setEditingDiary] = useState(null);
    const [selectedDiary, setSelectedDiary] = useState(null);
    const [showList, setShowList] = useState(true);
    const [form, setForm] = useState({ title: "", content: "", targetDate: "", plantId: null });
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) { navigate("/login"); return; }
        fetchDevices();
    }, [navigate]);

    useEffect(() => {
        if (selectedDevice) fetchDiaries(selectedDevice);
    }, [selectedDevice]);

    const fetchDevices = async () => {
        try {
            const res = await getUserDevicesApi();
            setDevices(res.data);
            if (res.data.length > 0) setSelectedDevice(res.data[0]);
        } catch (err) { console.error(err); }
    };

    const fetchDiaries = async (device) => {
        setLoading(true);
        try {
            const response = await getDiariesApi(device.serialNumber);
            setDiaries(response.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleImageChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        try {
            const compressedFiles = await compressImageFiles(files);
            setImageFiles(prev => [...prev, ...compressedFiles]);
            setImagePreviews(prev => [...prev, ...compressedFiles.map(f => URL.createObjectURL(f))]);
        } catch (err) {
            console.error("이미지 압축 실패:", err);
            setError("이미지 처리 중 오류가 발생했습니다.");
        } finally {
            e.target.value = "";
        }
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
        if (!editingDiary && !form.plantId) {
            setError("재배 중인 식물을 선택해주세요.");
            return;
        }
        setError("");
        try {
            const formData = new FormData();
            const diaryData = { ...form, targetDate: `${form.targetDate} 00:00:00` };
            formData.append("diaryData", new Blob([JSON.stringify(diaryData)], { type: "application/json" }));
            imageFiles.forEach(file => formData.append("files", file));

            if (editingDiary) {
                await updateDiaryApi(selectedDevice.serialNumber, editingDiary.id, formData);
            } else {
                await createDiaryApi(selectedDevice.serialNumber, formData);
            }
            setShowForm(false);
            setEditingDiary(null);
            setForm({ title: "", content: "", targetDate: "", plantId: null });
            clearImages();
            fetchDiaries(selectedDevice);
        } catch {
            setError("저장 중 오류가 발생했습니다.");
        }
    };

    const handleEdit = (diary) => {
        setEditingDiary(diary);
        setForm({
            title: diary.title,
            content: diary.content,
            targetDate: diary.targetDate?.slice(0, 10) || "",
            plantId: diary.plantId,
        });
        setImageFiles([]);
        setImagePreviews(diary.imageUrls?.map(assetUrl) || []);
        setSelectedDiary(null);
        setShowForm(true);
        setShowList(false);
    };

    const handleDelete = async (diary) => {
        if (!window.confirm("정말 삭제할까요?")) return;
        try {
            await deleteDiaryApi(selectedDevice.serialNumber, diary.id);
            setSelectedDiary(null);
            setShowList(true);
            fetchDiaries(selectedDevice);
        } catch (err) { console.error(err); }
    };

    const openForm = () => {
        setEditingDiary(null);
        setForm({ title: "", content: "", targetDate: "", plantId: selectedDevice?.plants?.[0]?.id ?? null });
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
        <div className="max-w-col-8 mx-auto flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate("/")} className="text-gray-500 hover:text-gray-600 text-body2">← 홈</button>
                    <h1 className="text-sub1 font-bold text-gray-800">📔 다이어리</h1>
                </div>
                {selectedDevice && (
                    <button
                        onClick={openForm}
                        disabled={!selectedDevice.plants?.length}
                        className="bg-brand hover:bg-brand-deep text-white text-body2 font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >+ 새 일지</button>
                )}
            </div>

            {/* 기기별 일지 탭 */}
            {devices.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {devices.map(device => (
                        <button
                            key={device.serialNumber}
                            onClick={() => {
                                setSelectedDevice(device);
                                setSelectedDiary(null);
                                setShowForm(false);
                                setShowList(true);
                            }}
                            className={`flex flex-col items-start px-4 py-2 rounded-lg text-body2 font-medium whitespace-nowrap transition-colors
                                ${selectedDevice?.serialNumber === device.serialNumber
                                    ? "bg-brand text-white"
                                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-olive"
                                }`}
                        >
                            <span>{device.deviceNickname || device.serialNumber}</span>
                            <span className={`text-caption mt-1 font-normal ${
                                selectedDevice?.serialNumber === device.serialNumber
                                    ? "text-brand-cream"
                                    : "text-gray-500"
                            }`}>
                                {device.serialNumber} · {device.plants?.length || 0}포트 재배 중
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                    <div className="text-h1 mb-3">🌱</div>
                    <p className="text-gray-500 text-body2">등록된 기기가 없어요</p>
                </div>
            )}

            {/* 메인 영역 */}
            {selectedDevice && (
                <div className="flex flex-col sm:flex-row gap-4">

                    {/* 다이어리 목록 */}
                    <div className={`${showList || (!selectedDiary && !showForm) ? "block" : "hidden"} sm:block w-full sm:w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden`}>
                        <div className="p-4 border-b border-gray-100">
                            <p className="text-body2 font-bold text-gray-700">
                                {selectedDevice.deviceNickname || selectedDevice.serialNumber} 일지
                            </p>
                            {/* 기기 닉네임 + 시리얼 표시 */}
                            <p className="text-caption text-gray-500 mt-1">
                                {selectedDevice.serialNumber}
                            </p>
                            <p className="text-caption text-gray-500 mt-1">총 {diaries.length}개</p>
                        </div>
                        {loading ? (
                            <div className="p-4 text-center text-gray-500 text-body2">불러오는 중...</div>
                        ) : diaries.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 text-body2">작성된 일지가 없어요</div>
                        ) : (
                            <div className="flex flex-col">
                                {diaries.map(diary => (
                                    <button
                                        key={diary.id}
                                        onClick={() => handleDiarySelect(diary)}
                                        className={`text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors
                                            ${selectedDiary?.id === diary.id ? "bg-brand-cream border-l-2 border-l-brand" : ""}`}
                                    >
                                        <p className="text-body2 font-medium text-gray-800 truncate">{diary.title}</p>
                                        <p className="text-caption text-gray-500 mt-1">{diary.targetDate?.slice(0, 10)} · P{diary.portIndex + 1} {diary.speciesName || "과거 기록"}{diary.plantEndReason === "HARVESTED" ? " · 수확" : diary.plantEndReason === "DIED" ? " · 병·시듦" : ""}</p>
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
                                        className="text-gray-500 hover:text-gray-600 text-body2"
                                    >← 목록</button>
                                </div>
                                <h2 className="text-body1 font-bold text-gray-800">{editingDiary ? "일지 수정" : "새 일지 작성"}</h2>
                                {error && <div className="bg-red-50 text-red-600 text-body2 rounded-lg px-4 py-2">{error}</div>}
                                <div>
                                    <label className="block text-body2 font-medium text-gray-700 mb-1">기록할 식물</label>
                                    <select value={form.plantId ?? ""} disabled={Boolean(editingDiary)} onChange={e => setForm({ ...form, plantId: Number(e.target.value) })}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf">
                                        {editingDiary && <option value={form.plantId ?? ""}>P{editingDiary.portIndex + 1} · {editingDiary.speciesName || "과거 기록"} ({editingDiary.plantName || "이름 없음"})</option>}
                                        {!editingDiary && selectedDevice.plants?.map(plant =>
                                            <option key={plant.id} value={plant.id}>P{plant.portIndex + 1} · {plant.species || plant.speciesName} ({plant.name})</option>
                                        )}
                                    </select>
                                    {editingDiary && <p className="text-caption text-gray-500 mt-1">기존 일지의 식물은 변경할 수 없어요.</p>}
                                </div>
                                <div>
                                    <label className="block text-body2 font-medium text-gray-700 mb-1">날짜</label>
                                    <input
                                        type="date"
                                        value={form.targetDate}
                                        onChange={e => setForm({ ...form, targetDate: e.target.value })}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf"
                                    />
                                </div>
                                <div>
                                    <label className="block text-body2 font-medium text-gray-700 mb-1">제목</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        placeholder="일지 제목을 입력하세요"
                                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf"
                                    />
                                </div>
                                <div>
                                    <label className="block text-body2 font-medium text-gray-700 mb-1">내용</label>
                                    <textarea
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        placeholder="오늘의 식물 상태를 기록해보세요"
                                        rows={6}
                                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-body2 focus:outline-none focus:ring-2 focus:ring-brand-leaf resize-none"
                                    />
                                </div>

                                {/* 사진 첨부 */}
                                <div>
                                    <label className="block text-body2 font-medium text-gray-700 mb-1">
                                        사진 첨부 {imagePreviews.length > 0 && <span className="text-gray-500 font-normal">({imagePreviews.length}장)</span>}
                                    </label>
                                    {imagePreviews.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            {imagePreviews.map((src, idx) => (
                                                <div key={idx} className="relative aspect-square">
                                                    <img src={src} alt={`미리보기 ${idx + 1}`}
                                                        className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                                    <button onClick={() => removeImage(idx)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-caption hover:bg-red-600">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-brand-olive hover:bg-brand-cream transition-colors">
                                        <span className="text-sub1 mb-1">📷</span>
                                        <span className="text-caption text-gray-500">클릭하여 사진 추가 (여러 장 가능)</span>
                                        <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                                    </label>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={handleSubmit}
                                        className="flex-1 bg-brand hover:bg-brand-deep text-white font-medium py-3 rounded-lg text-body2 transition-colors">
                                        {editingDiary ? "수정 완료" : "저장"}
                                    </button>
                                    <button
                                        onClick={() => { setShowForm(false); setEditingDiary(null); clearImages(); setShowList(true); }}
                                        className="px-4 py-3 border border-gray-200 rounded-lg text-body2 text-gray-500 hover:bg-gray-50">
                                        취소
                                    </button>
                                </div>
                            </div>
                        ) : selectedDiary ? (
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => { setSelectedDiary(null); setShowList(true); }}
                                    className="flex items-center gap-1 text-gray-500 hover:text-gray-600 text-body2 sm:hidden w-fit"
                                >← 목록</button>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-caption text-gray-500 mb-1">{selectedDiary.targetDate?.slice(0, 10)} · P{selectedDiary.portIndex + 1} {selectedDiary.speciesName || "과거 기록"}{selectedDiary.plantName ? ` · ${selectedDiary.plantName}` : ""}{selectedDiary.plantEndReason === "HARVESTED" ? " · 수확 완료" : selectedDiary.plantEndReason === "DIED" ? " · 병·시듦으로 종료" : ""}</p>
                                        <h2 className="text-sub1 font-bold text-gray-800">{selectedDiary.title}</h2>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(selectedDiary)}
                                            className="text-caption text-brand hover:text-brand-deep font-medium px-3 py-2 border border-brand-olive/40 rounded-lg hover:bg-brand-cream">수정</button>
                                        <button onClick={() => handleDelete(selectedDiary)}
                                            className="text-caption text-red-600 hover:text-red-600 px-3 py-2 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>
                                    </div>
                                </div>
                                <hr className="border-gray-100" />
                                {selectedDiary.imageUrls?.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {selectedDiary.imageUrls.map((url, idx) => (
                                            <img key={idx} src={assetUrl(url)} alt={`일지 사진 ${idx + 1}`}
                                                className="w-full aspect-square object-cover rounded-lg border border-gray-100" />
                                        ))}
                                    </div>
                                )}
                                <p className="text-body2 text-gray-700 whitespace-pre-wrap ">{selectedDiary.content}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                <div className="text-h1 mb-3">📔</div>
                                <p className="text-gray-500 text-body2">일지를 선택하거나 새 일지를 작성해보세요</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DiaryPage;
