import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ORIGIN } from '../../api/config';

const ArticlePostCard = ({ post }) => {
  const navigate = useNavigate();
  const SERVER_URL = API_ORIGIN;

  // 이미지 경로 보정 함수
  const getFormattedImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    
    let correctedPath = url.replace('/api/files/', '/uploads/');
    const parts = correctedPath.split('/');
    const fileName = parts.pop();
    const path = parts.join('/');
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${SERVER_URL}${finalPath}/${encodeURIComponent(fileName)}`;
  };

  return (
    <div 
      onClick={() => navigate(`/articles/${post.id}`)}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden group"
    >
      {/* 카드 상단: 이미지 로직 추가 */}
      <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden">
        {post.imageUrl ? (
          <img 
            src={getFormattedImageUrl(post.imageUrl)}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center group-hover:from-green-100 group-hover:to-emerald-200 transition-colors">
            <span className="text-4xl group-hover:scale-110 transition-transform duration-300">🌱</span>
          </div>
        )}
      </div>

      {/* 카드 내용 */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold tracking-wider text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md">
            {post.category || "Community"}
          </span>
          <span className="text-xs text-gray-400 font-light">{post.createdAt?.split(' ')[0]}</span>
        </div>

        <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1 group-hover:text-green-700 transition-colors">
          {post.title}
        </h3>
        
        <p className="text-gray-500 text-sm line-clamp-2 mb-6 h-10 leading-relaxed">
          {post.content}
        </p>

        <div className="flex justify-between items-center pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">👤</div>
            <span className="text-xs text-gray-600 font-medium">{post.authorUsername}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-xs text-gray-400 flex items-center gap-1">👁️ {post.viewCount || 0}</span>
            <span className="text-xs text-orange-500 flex items-center gap-1 font-bold">❤️ {post.likesCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticlePostCard;
