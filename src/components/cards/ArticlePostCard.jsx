import React from 'react';
import { useNavigate } from 'react-router-dom';
import { assetUrl } from '../../api/config';

const ArticlePostCard = ({ post }) => {
  const navigate = useNavigate();

  // 이미지 경로 보정 함수
  const getFormattedImageUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    let correctedPath = url.replace('/api/files/', '/uploads/');
    const parts = correctedPath.split('/');
    const fileName = parts.pop();
    const path = parts.join('/');
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    
    return assetUrl(`${finalPath}/${encodeURIComponent(fileName)}`);
  };

  return (
    <div 
      onClick={() => navigate(`/articles/${post.id}`)}
      className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden group"
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
          <div className="w-full h-full bg-gradient-to-br from-brand-cream to-brand-cream flex items-center justify-center group-hover:from-brand-cream group-hover:to-brand-bright/30 transition-colors">
            <span className="text-h1 group-hover:scale-110 transition-transform duration-300">🌱</span>
          </div>
        )}
      </div>

      {/* 카드 내용 */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-caption font-bold  text-brand uppercase bg-brand-cream px-2 py-1 rounded-md">
            {post.category || "Community"}
          </span>
          <span className="text-caption text-gray-500 font-normal">{post.createdAt?.split(' ')[0]}</span>
        </div>

        <h3 className="text-sub1 font-bold text-gray-800 mb-2 line-clamp-1 group-hover:text-brand-deep transition-colors">
          {post.title}
        </h3>
        
        <p className="text-gray-500 text-body2 line-clamp-2 mb-6 h-10 ">
          {post.content}
        </p>

        <div className="flex justify-between items-center pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-caption">👤</div>
            <span className="text-caption text-gray-600 font-medium">{post.authorUsername}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-caption text-gray-500 flex items-center gap-1">👁️ {post.viewCount || 0}</span>
            <span className="text-caption text-amber-700 flex items-center gap-1 font-bold">❤️ {post.likesCount || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticlePostCard;
