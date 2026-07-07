import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getArticlesApi } from '../../api/articleApi';
import { assetUrl } from '../../api/config';

const ArticleListPage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [currentCategory, setCurrentCategory] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSidebar, setShowSidebar] = useState(false); // ✅ 모바일 사이드바 토글
  const postsPerPage = 10;

  useEffect(() => { fetchPosts(); }, []);
  useEffect(() => { setCurrentPage(1); }, [currentCategory]);

  const fetchPosts = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await getArticlesApi(token);
      setPosts(response.data?.content ?? []);
    } catch (error) { console.error("데이터 로딩 실패:", error); }
  };

  const getFormattedImageUrl = (post) => {
    let rawUrl = post.imageUrl;
    if (!rawUrl && post.images?.length > 0) rawUrl = post.images[0].imgUrl;
    if (!rawUrl) return null;
    let targetUrl = rawUrl.split(',')[0].trim();
    if (targetUrl.startsWith('http')) return targetUrl;
    let correctedPath = targetUrl.replace('/api/files/', '/uploads/');
    const pathParts = correctedPath.split('/');
    const fileName = pathParts.pop();
    const directoryPath = pathParts.join('/');
    return assetUrl(`${directoryPath}/${encodeURIComponent(fileName)}`);
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = currentCategory === '전체' || post.category === currentCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentPosts = filteredPosts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const popularPosts = [...posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 3);

  const SidebarContent = () => (
    <>
      <div className="relative mb-6 mt-2">
        <input
          type="text"
          placeholder="게시글 이름으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-50 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-green-500 transition-all"
        />
      </div>
      <nav className="space-y-2">
        {['전체', '재배 노하우', '자유 게시판', '질문/답변'].map((cat) => (
          <button
            key={cat}
            onClick={() => { setCurrentCategory(cat); setShowSidebar(false); }}
            className={`w-full flex justify-between items-center px-4 py-3 rounded-xl transition-all ${
              currentCategory === cat ? 'bg-green-50 text-green-600 font-bold' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>{cat}</span>
            <span className="text-[10px] bg-white px-2 py-1 rounded-md border border-gray-100">
              {cat === '전체' ? posts.length : posts.filter(p => p.category === cat).length}개
            </span>
          </button>
        ))}
      </nav>
      <button
        onClick={() => { navigate('/articles/write'); setShowSidebar(false); }}
        className="w-full mt-8 bg-[#16a34a] text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-100 transition-transform active:scale-95"
      >+ 글쓰기</button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto flex gap-6 lg:gap-8">

        {/* ✅ 모바일 사이드바 오버레이 */}
        {showSidebar && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowSidebar(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white rounded-r-3xl p-6 shadow-xl z-50">
              <div className="flex justify-between items-center mb-6">
                <span className="font-bold text-gray-800">카테고리</span>
                <button onClick={() => setShowSidebar(false)} className="text-gray-400 text-xl">✕</button>
              </div>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* ✅ 데스크탑 사이드바 */}
        <aside className="hidden lg:block w-64 bg-white rounded-[2rem] p-8 shadow-sm h-fit border border-gray-100 sticky top-10">
          <SidebarContent />
        </aside>

        {/* 메인 */}
        <main className="flex-1 min-w-0 bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 lg:p-12 shadow-sm border border-gray-100">

          {/* 모바일 상단 바 */}
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <button
              onClick={() => setShowSidebar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-sm text-gray-600 font-medium border border-gray-200"
            >☰ {currentCategory}</button>
            <button
              onClick={() => navigate('/articles/write')}
              className="px-4 py-2 bg-[#16a34a] text-white rounded-xl text-sm font-bold"
            >+ 글쓰기</button>
          </div>

          <header className="mb-8 lg:mb-10 hidden lg:block">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2">{currentCategory}</h1>
            <p className="text-gray-500">
              {currentCategory === '전체' ? "GrowLab의 모든 지식을 한눈에 확인하세요." : `${currentCategory}에 대한 정보를 공유하고 소통하세요.`}
            </p>
          </header>

          {/* 인기 게시글 */}
          {currentCategory === '전체' && popularPosts.length > 0 && (
            <section className="mb-10 lg:mb-16">
              <h2 className="flex items-center gap-2 text-lg lg:text-xl font-bold mb-4 lg:mb-6 text-gray-800">
                <span className="text-orange-500">🔥</span> 인기 게시글
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {popularPosts.map((post) => {
                  const imgUrl = getFormattedImageUrl(post);
                  return (
                    <div
                      key={post.id}
                      onClick={() => navigate(`/articles/${post.id}`)}
                      className="bg-white rounded-[1.5rem] border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden mb-4 bg-gray-100">
                        {imgUrl ? (
                          <img src={imgUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="popular"
                            onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/300x200?text=No+Preview"; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-medium">No Image</div>
                        )}
                      </div>
                      <span className="inline-block px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full mb-2">{post.category}</span>
                      <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-3 group-hover:text-green-600">{post.title}</h3>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                        <span>👤 {post.authorUsername}</span>
                        <div className="flex gap-2">
                          <span>👁️ {post.viewCount || 0}</span>
                          <span className="text-orange-500">❤️ {post.likesCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 게시글 리스트 */}
          <section>
            {/* 데스크탑 헤더 */}
            <div className="hidden sm:flex items-center justify-between px-4 lg:px-6 pb-4 border-b border-gray-100 text-sm font-bold text-gray-400">
              <span className="w-[50%]">제목</span>
              <div className="flex-1 grid grid-cols-4 text-center">
                <span>작성자</span>
                <span>작성일</span>
                <span>조회수</span>
                <span className="text-green-600">좋아요</span>
              </div>
            </div>

            <div className="divide-y divide-gray-50 mb-8">
              {currentPosts.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">게시글이 없어요</div>
              ) : currentPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => navigate(`/articles/${post.id}`)}
                  className="cursor-pointer group hover:bg-gray-50/50 transition-colors"
                >
                  {/* 모바일 카드형 */}
                  <div className="sm:hidden px-2 py-4">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-base opacity-70 mt-0.5">🌱</span>
                      <span className="font-bold text-gray-700 group-hover:text-green-600 text-sm line-clamp-2">{post.title}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-1 ml-6">
                      <span>{post.authorUsername}</span>
                      <span>{post.createdAt?.split(' ')[0]}</span>
                      <span>👁️ {post.viewCount || 0}</span>
                      <span className="text-orange-500">❤️ {post.likesCount || 0}</span>
                    </div>
                  </div>
                  {/* 데스크탑 행형 */}
                  <div className="hidden sm:flex items-center justify-between px-4 lg:px-6 py-5">
                    <div className="w-[50%] flex items-center gap-3">
                      <span className="text-lg opacity-70">🌱</span>
                      <span className="font-bold text-gray-700 group-hover:text-green-600 truncate">{post.title}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-4 text-center text-sm text-gray-500 items-center">
                      <span>{post.authorUsername}</span>
                      <span className="text-gray-400">{post.createdAt?.split(' ')[0]}</span>
                      <span>{post.viewCount || 0}</span>
                      <span className="font-bold text-gray-900">{post.likesCount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                      currentPage === page ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >{page}</button>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default ArticleListPage;
