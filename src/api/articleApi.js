import axios from "axios";
import { API_BASE as ROOT_API_BASE } from "./config";
import { createArticleDetailRequest } from "./articleDetailRequest.js";

const BASE_URL = ROOT_API_BASE;

// 1. 인터셉터가 적용될 전용 인스턴스 생성
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true
});

// 2. 백엔드 JwtAuthenticationFilter 조건에 맞춘 인터셉터 설정
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    
    if (token && !config.headers.has("Authorization")) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// --- 게시글(Article) 관련 ---

// 전체 목록 조회 
export const getArticlesApi = () => 
    api.get("/articles");

// 같은 글이라도 계정이 다르면 별도 요청으로 조회한다.
export const getArticleDetailApi = createArticleDetailRequest(api, () => localStorage.getItem("token"));

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

// (관리자) 게시글 목록 조회 - 원하는 page/size로 더 많이 가져오기
export const getArticlesAdminApi = (page = 0, size = 50) =>
    api.get(`/articles?page=${page}&size=${size}`);

// (관리자) 게시글 강제 삭제
export const adminDeleteArticleApi = (articleId) =>
    api.delete(`/articles/admin/${articleId}`);

// (관리자) 전체 댓글 목록 조회
export const getAllCommentsAdminApi = () =>
    api.get("/comments");

// (관리자) 댓글 강제 삭제
export const adminDeleteCommentApi = (commentId) =>
    api.delete(`/admin/comments/${commentId}`);
