import React, { useState, useEffect, useCallback } from 'react';
import { getCommentsByArticleApi, deleteCommentApi } from '../../../api/articleApi';
import CommentItem from './CommentItem';
import CommentCreate from './CommentCreate';

const CommentList = ({ articleId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const token = localStorage.getItem("token");
  const isLoggedIn = !!token;

  // 1. 특정 게시글의 댓글 목록을 가져오기
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getCommentsByArticleApi(articleId);
      setComments(response.data);
    } catch (error) {
      console.error("댓글 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  // 2. 페이지 로드 시 댓글 호출
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // 3. 댓글 삭제 처리 함수
  const handleDelete = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      await deleteCommentApi(commentId, token);
      // 삭제 성공 후 목록 새로고침
      fetchComments();
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
      alert("삭제 권한이 없거나 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-500">댓글을 불러오는 중...</div>;
  }

  return (
    <div className="mt-12 border-t border-gray-100 pt-10">
      {/* 댓글 헤더 */}
      <div className="flex items-center gap-2 mb-8">
        <h3 className="text-sub1 font-bold text-gray-900">댓글</h3>
        <span className="bg-brand-cream text-brand text-body2 font-bold px-3 py-1 rounded-full">
          {comments.length}
        </span>
      </div>

      {/* 댓글 리스트 영역 */}
      <div className="space-y-2 mb-10">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem 
              key={comment.id} 
              comment={comment} 
              onDelete={handleDelete} 
            />
          ))
        ) : (
          <div className="py-12 text-center text-gray-500 text-body2 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            아직 등록된 댓글이 없습니다. 첫 마디를 남겨보세요!
          </div>
        )}
      </div>

      {/* 댓글 작성 영역 */}
      {isLoggedIn ? (
        <CommentCreate 
          articleId={articleId} 
          onCommentAdded={fetchComments} 
        />
      ) : (
        <div className="p-8 bg-gray-50 rounded-3xl text-center border border-gray-100">
          <p className="text-gray-500 text-body2">
            댓글 작성을 위해 <span className="text-brand font-bold hover:underline cursor-pointer">로그인</span>이 필요합니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default CommentList;