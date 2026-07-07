import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  getArticleDetailApi,
  toggleArticleLikeApi,
  createCommentApi,
  deleteArticleApi,
  deleteCommentApi,
  updateCommentApi
} from '../../api/articleApi';
import { API_ORIGIN } from '../../api/config';

const ArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState("");
  const SERVER_URL = API_ORIGIN;

  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  const currentUsername = localStorage.getItem("username");

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await getArticleDetailApi(id, token);
      setPost(response.data);
    } catch (error) { console.error("데이터 가져오기 실패:", error); }
  };

  const getFormattedImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    let correctedPath = url.replace('/api/files/', '/uploads/');
    const parts = correctedPath.split('/');
    const fileName = parts.pop();
    const path = parts.join('/');
    return `${SERVER_URL}${path.startsWith('/') ? path : '/' + path}/${encodeURIComponent(fileName)}`;
  };

  const handleLike = async () => {
    const token = localStorage.getItem("token");
    if (!token) return alert("로그인이 필요합니다.");
    try { await toggleArticleLikeApi(id, token); fetchDetail(); }
    catch (err) { console.error(err); }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!comment.trim()) return;
    try {
      await createCommentApi(id, { content: comment }, token);
      setComment(""); fetchDetail();
    } catch (err) { console.error(err); }
  };

  const startEditComment = (c) => { setEditingCommentId(c.id); setEditingContent(c.content); };
  const cancelEditComment = () => { setEditingCommentId(null); setEditingContent(""); };

  const handleUpdateComment = async (commentId) => {
    const token = localStorage.getItem("token");
    try {
      await updateCommentApi(commentId, { content: editingContent }, token);
      setEditingCommentId(null); fetchDetail();
    } catch { alert("댓글 수정 실패"); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    try { await deleteCommentApi(commentId, localStorage.getItem("token")); fetchDetail(); }
    catch (err) { console.error(err); }
  };

  const getSlides = () => {
    if (!post) return [];
    const slides = [];
    if (post.imageUrl) slides.push({ src: getFormattedImageUrl(post.imageUrl) });
    post.images?.forEach(img => slides.push({ src: getFormattedImageUrl(img.imgUrl || img.imageUrl) }));
    return slides;
  };

  if (!post) return <div className="p-20 text-center font-bold text-gray-400">로딩 중...</div>;
  const slides = getSlides();

  return (
    <div className="min-h-screen bg-[#f8f9fa] pt-4 sm:pt-6 pb-16 sm:pb-20 px-4 sm:px-6 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* 상단 네비 */}
        <div className="mb-4 sm:mb-6 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-green-600 font-bold text-sm">← 목록으로</button>
          {post.authorUsername === currentUsername && (
            <div className="flex gap-2 sm:gap-3">
              <button onClick={() => navigate(`/articles/edit/${id}`)} className="text-xs font-bold text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">수정</button>
              <button
                onClick={() => { if (window.confirm("삭제하시겠습니까?")) deleteArticleApi(id, localStorage.getItem("token")).then(() => navigate('/articles')); }}
                className="text-xs font-bold text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50"
              >삭제</button>
            </div>
          )}
        </div>

        {/* 본문 카드 */}
        <article className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden mb-6 sm:mb-8 p-6 sm:p-10 lg:p-12">
          {/* 헤더 */}
          <header className="mb-8 sm:mb-10 text-center border-b border-gray-50 pb-6 sm:pb-8">
            <span className="inline-block px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-[11px] font-bold mb-3 sm:mb-4">{post.category}</span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-6 sm:mb-8 leading-tight">{post.title}</h1>
            {/* 메타 정보: 모바일에서 줄바꿈 */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-400 font-medium">
              <p className="text-gray-800 font-bold">👤 {post.authorUsername}</p>
              <p>📅 {post.createdAt}</p>
              <p>👁️ {post.viewCount}</p>
              <p className={post.liked ? 'text-red-500 font-bold' : ''}>❤️ {post.likesCount || 0}</p>
            </div>
          </header>

          {/* 이미지 */}
          {(post.imageUrl || post.images?.length > 0) && (
            <div className="flex flex-row flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-12">
              {post.imageUrl && (
                <img src={getFormattedImageUrl(post.imageUrl)}
                  className="w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 object-cover rounded-2xl sm:rounded-3xl cursor-pointer hover:scale-105 transition-transform shadow-sm"
                  alt="메인" onClick={() => { setPhotoIndex(0); setIsOpen(true); }} />
              )}
              {post.images?.map((img, index) => (
                <img key={index} src={getFormattedImageUrl(img.imgUrl || img.imageUrl)}
                  className="w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 object-cover rounded-2xl sm:rounded-3xl cursor-pointer hover:scale-105 transition-transform shadow-sm"
                  alt="추가" onClick={() => { setPhotoIndex(post.imageUrl ? index + 1 : index); setIsOpen(true); }} />
              ))}
            </div>
          )}

          {/* 본문 */}
          <div className="text-gray-700 leading-relaxed text-base sm:text-lg whitespace-pre-wrap mb-8 sm:mb-12 min-h-[100px]">
            {post.content}
          </div>

          {/* 좋아요 */}
          <div className="flex justify-center border-t border-gray-50 pt-8 sm:pt-10">
            <button onClick={handleLike}
              className={`flex items-center gap-2 px-6 sm:px-8 py-3 rounded-full font-bold transition-all text-sm sm:text-base ${
                post.liked ? 'bg-red-50 text-red-500 shadow-sm border border-red-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}>
              <span className="text-lg sm:text-xl">{post.liked ? '❤️' : '🤍'}</span>
              <span>{post.liked ? '도움이 되었어요!' : '이 글이 도움이 되었나요?'}</span>
            </button>
          </div>
        </article>

        {/* 댓글 */}
        <section className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-gray-100 p-6 sm:p-10 lg:p-12">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 sm:mb-8">
            댓글 <span className="text-green-500">{post.comments?.length || 0}</span>
          </h3>

          {/* 댓글 작성 */}
          <form onSubmit={handleCommentSubmit} className="mb-8 sm:mb-10 relative">
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="따뜻한 댓글을 남겨주세요."
              className="w-full bg-gray-50 border-none rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 pr-16 sm:pr-20 resize-none outline-none focus:ring-1 focus:ring-green-200 min-h-[90px] sm:min-h-[100px] text-sm"
            />
            <button type="submit" className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 bg-green-500 text-white px-4 sm:px-6 py-2 rounded-xl font-bold text-sm hover:bg-green-600 transition-colors">등록</button>
          </form>

          {/* 댓글 목록 */}
          <div className="space-y-4 sm:space-y-6">
            {post.comments?.map((c) => (
              <div key={c.id} className="group p-4 sm:p-6 bg-gray-50/50 rounded-2xl sm:rounded-[2rem] hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 text-sm">👤 {c.authorUsername}</span>
                  {c.authorUsername === currentUsername && (
                    <div className="flex gap-2">
                      <button onClick={() => startEditComment(c)} className="text-xs text-gray-400 hover:text-green-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">수정</button>
                      <button onClick={() => handleDeleteComment(c.id)} className="text-xs text-red-300 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">삭제</button>
                    </div>
                  )}
                </div>
                {editingCommentId === c.id ? (
                  <div className="mt-2">
                    <textarea
                      value={editingContent} onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-white border border-green-100 rounded-xl p-3 sm:p-4 text-sm outline-none resize-none shadow-inner"
                    />
                    <div className="flex justify-end gap-3 mt-2">
                      <button onClick={cancelEditComment} className="text-xs font-bold text-gray-400">취소</button>
                      <button onClick={() => handleUpdateComment(c.id)} className="text-xs font-bold text-green-600">수정 완료</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-sm">{c.content}</p>
                )}
                <span className="text-[10px] text-gray-300 mt-2 block">{c.createdAt}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Lightbox
        open={isOpen} close={() => setIsOpen(false)} index={photoIndex} slides={slides}
        carousel={{ padding: "0px", spacing: "0px" }}
        styles={{ container: { backgroundColor: "rgba(0,0,0,0.95)" }, slide: { padding: "0px" }, image: { maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" } }}
      />
    </div>
  );
};

export default ArticleDetailPage;
