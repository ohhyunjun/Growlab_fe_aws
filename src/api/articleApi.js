import axios from "axios";

const BASE_URL = "http://localhost:8080/api";

// 1. 인터셉터가 적용될 전용 인스턴스 생성
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true
});

// 2. 백엔드 JwtAuthenticationFilter 조건에 맞춘 인터셉터 설정
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        
        console.log("인터셉터 작동 중! 전송될 헤더:", config.headers.Authorization);
    } else {
        console.warn("⚠️ 로컬 스토리지에 토큰이 없습니다!");
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// --- 게시글(Article) 관련 ---

// 전체 목록 조회 
export const getArticlesApi = () => 
    api.get("/articles");

// 상세 조회 
export const getArticleDetailApi = (id) => 
    api.get(`/articles/${id}`);

// 게시글 생성 
export const createArticleApi = (formData) =>
    api.post("/articles", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        }
    });

// 게시글 삭제 
export const deleteArticleApi = (id) =>
    api.delete(`/articles/${id}`);

// 게시글 수정 API 
export const updateArticleApi = (id, formData) =>
    api.put(`/articles/${id}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        }
    });

// 좋아요 토글 
export const toggleArticleLikeApi = (id) => 
    api.post(`/articles/${id}/likes`, {});


// --- 댓글(Comment) 관련 ---

// 댓글 목록 조회
export const getCommentsByArticleApi = (articleId) =>
    api.get(`/articles/${articleId}/comments`);

// 댓글 생성 
export const createCommentApi = (articleId, data) =>
    api.post(`/articles/${articleId}/comments`, data);

// 댓글 수정 
export const updateCommentApi = (commentId, data) =>
    api.put(`/comments/${commentId}`, data);

// 댓글 삭제 
export const deleteCommentApi = (commentId) =>
    api.delete(`/comments/${commentId}`);

// 내 게시글 조회
export const getMyArticlesApi = (page = 0, size = 10) => {
    return api.get(`/articles/my?page=${page}&size=${size}`);
};