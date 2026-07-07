import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createArticleApi, getArticleDetailApi, updateArticleApi } from '../../api/articleApi';
import { assetUrl } from '../../api/config';

const ArticleCreatePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('재배 노하우');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [deleteImageIds, setDeleteImageIds] = useState([]);

  useEffect(() => { if (isEditMode) fetchPostDetail(); }, [id]);

  const fetchPostDetail = async () => {
    try {
      const response = await getArticleDetailApi(id);
      const post = response.data;
      setTitle(post.title);
      setContent(post.content);
      setCategory(post.category);
      if (post.images?.length > 0) {
        const formattedExisting = post.images.map(img => {
          let url = img.imgUrl || img.imageUrl || "";
          if (url && !url.startsWith('http')) {
            const correctedPath = url.replace('/api/files/', '/uploads/');
            url = assetUrl(correctedPath);
          }
          return { id: img.id, url };
        });
        setExistingImages(formattedExisting);
        setPreviews(formattedExisting.map(img => img.url));
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      alert("글 데이터를 불러오지 못했습니다.");
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    setFiles(prev => [...prev, ...selectedFiles]);
    setPreviews(prev => [...prev, ...selectedFiles.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    const targetPreview = previews[index];
    const existingIdx = existingImages.findIndex(img => img.url === targetPreview);
    if (existingIdx !== -1) {
      setDeleteImageIds(prev => [...prev, existingImages[existingIdx].id]);
      setExistingImages(prev => prev.filter((_, i) => i !== existingIdx));
    } else {
      const newFileIdx = index - existingImages.length;
      setFiles(prev => prev.filter((_, i) => i !== newFileIdx));
    }
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return alert("제목과 내용을 입력하세요.");
    const currentToken = localStorage.getItem("token");
    if (!currentToken) { alert("로그인이 필요합니다."); navigate('/login'); return; }

    const formData = new FormData();
    formData.append('articleData', new Blob([JSON.stringify({ title, content, category, deleteImageIds })], { type: 'application/json' }));
    files.forEach(file => formData.append('file', file));

    try {
      if (isEditMode) {
        await updateArticleApi(id, formData);
        alert("글이 성공적으로 수정되었습니다!");
      } else {
        await createArticleApi(formData);
        alert("글이 성공적으로 등록되었습니다!");
      }
      navigate(isEditMode ? `/articles/${id}` : '/articles');
    } catch (error) {
      console.error("작업 실패:", error);
      if (error.response?.status === 401) {
        alert("수정 권한이 없거나 세션이 만료되었습니다. 다시 로그인 해주세요.");
      } else {
        alert(isEditMode ? "글 수정 중 오류가 발생했습니다." : "글 등록 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 p-6 sm:p-10 lg:p-12">

        <header className="mb-8 sm:mb-10">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-green-600 text-sm font-bold mb-4 block">← 뒤로가기</button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {isEditMode ? "게시글 수정" : "새 게시글 작성"}
          </h2>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            {isEditMode ? "내용을 자유롭게 수정해 보세요." : "GrowLab의 지식 창고에 당신의 노하우를 더해주세요."}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* 카테고리 */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {['재배 노하우', '자유 게시판', '질문/답변'].map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)}
                className={`px-4 sm:px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  category === cat ? 'bg-[#16a34a] text-white' : 'bg-gray-100 text-gray-400'
                }`}>{cat}</button>
            ))}
          </div>

          <div className="space-y-5 sm:space-y-6">
            {/* 제목 */}
            <input
              type="text" placeholder="제목을 입력하세요" value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl sm:text-2xl font-bold border-b border-gray-100 py-3 sm:py-4 focus:border-green-500 outline-none transition-all"
            />

            {/* 사진 첨부 */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <label className="w-fit cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2">
                📸 {isEditMode ? "사진 변경하기" : "사진 첨부하기"}
                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" multiple />
              </label>

              {previews.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {previews.map((url, index) => (
                    <div key={index} className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-xl sm:rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                      <img src={url} alt={`미리보기 ${index}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => handleRemoveFile(index)}
                        className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full text-xs hover:bg-black/70 flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 내용 */}
            <textarea
              placeholder="내용을 입력하세요..." value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[250px] sm:min-h-[350px] py-3 sm:py-4 outline-none resize-none text-gray-700 leading-relaxed text-base sm:text-lg"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-50">
            <button type="button" onClick={() => navigate(-1)} className="px-5 sm:px-8 py-3 text-gray-400 font-bold hover:text-gray-600 text-sm sm:text-base">취소</button>
            <button type="submit" className="px-8 sm:px-12 py-3 bg-[#16a34a] text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-[#15803d] transition-all text-sm sm:text-base">
              {isEditMode ? "수정 완료" : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArticleCreatePage;
