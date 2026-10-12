import React, { useState } from 'react';
import { createCommentApi } from '../../../api/articleApi';

const CommentCreate = ({ articleId, onCommentAdded }) => {
  const [content, setContent] = useState('');
  const token = localStorage.getItem("token");

  const handleSubmit = async () => {
    // 0. 로그인 체크
    if (!token) {
        alert("로그인 후 이용 가능합니다.");
        return;
    }

    // 1. 빈 내용 방지
    if (!content.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    try {
      // 2. API 호출 (게시글 ID, 내용, 토큰 전달)
      await createCommentApi(articleId, content, token);
      
      // 3. 성공 시 입력창 비우기
      setContent('');
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error("댓글 등록 실패:", error);
      alert("댓글 등록에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-6">
      <div className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="재배 노하우에 대해 궁금한 점이나 의견을 남겨주세요!"
          className="w-full min-h-[100px] p-4 bg-gray-50 border-none rounded-xl text-body2 focus:ring-2 focus:ring-brand-leaf/20 outline-none resize-none transition-all"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="bg-brand text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-deep transition-all shadow-md shadow-brand/10"
          >
            댓글 등록
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentCreate;