import React from 'react';

const CommentItem = ({ comment, onDelete }) => {
  const currentUsername = localStorage.getItem("username");
  const isAuthor = currentUsername === comment.authorUsername;

  return (
    <div className="group flex gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
      {/* 프로필 아바타: 작성자 이름의 첫 글자를 보여주거나 기본 아이콘 표시 */}
      <div className="w-10 h-10 rounded-full bg-brand-cream text-brand flex-shrink-0 flex items-center justify-center font-bold">
        {comment.authorUsername?.charAt(0).toUpperCase() || '👤'}
      </div>

      {/* 댓글 본문 영역 */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-body2">
              {comment.authorUsername}
            </span>
            <span className="text-caption text-gray-500 font-normal">
              {comment.createdAt}
            </span>
          </div>
          
          {/* 작업 버튼: 내가 쓴 글일 때만 삭제 버튼이 보임 */}
          <div className="flex items-center gap-3">
            {isAuthor && (
              <button 
                onClick={() => onDelete(comment.id)}
                className="text-caption text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 hover:underline px-2 py-1"
              >
                삭제
              </button>
            )}
          </div>
        </div>
        
        {/* 댓글 내용 */}
        <p className="text-gray-600 text-body2  whitespace-pre-wrap mt-1">
          {comment.content}
        </p>
      </div>
    </div>
  );
};

export default CommentItem;