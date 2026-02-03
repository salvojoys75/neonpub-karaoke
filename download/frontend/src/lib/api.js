import axios from "axios";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("neonpub_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("neonpub_token");
      localStorage.removeItem("neonpub_user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Pub endpoints
export const createPub = (data) => api.post("/pub/create", data);
export const getPub = (pubCode) => api.get(`/pub/${pubCode}`);

// Auth endpoints
export const joinPub = (data) => api.post("/auth/join", data);
export const adminLogin = (data) => api.post("/auth/admin", data);
export const getMe = () => api.get("/auth/me");

// Song endpoints
export const requestSong = (data) => api.post("/songs/request", data);
export const getSongQueue = () => api.get("/songs/queue");
export const getMyRequests = () => api.get("/songs/my-requests");

// Admin queue endpoints
export const approveRequest = (requestId) => api.post(`/admin/queue/approve/${requestId}`);
export const rejectRequest = (requestId) => api.post(`/admin/queue/reject/${requestId}`);
export const reorderQueue = (order) => api.post("/admin/queue/reorder", order);

// Performance endpoints
export const startPerformance = (requestId, youtubeUrl) => 
  api.post(`/admin/performance/start/${requestId}`, null, { params: { youtube_url: youtubeUrl } });
export const endPerformance = (performanceId) => api.post(`/admin/performance/end/${performanceId}`);
export const closeVoting = (performanceId) => api.post(`/admin/performance/close-voting/${performanceId}`);
export const getCurrentPerformance = () => api.get("/performance/current");
export const getPerformanceHistory = () => api.get("/performances/history");

// Voting endpoints
export const submitVote = (data) => api.post("/votes/submit", data);

// Reaction endpoints
export const sendReaction = (data) => api.post("/reactions/send", data);

// Quiz endpoints
export const startQuiz = (data) => api.post("/admin/quiz/start", data);
export const answerQuiz = (data) => api.post("/quiz/answer", data);
export const endQuiz = (quizId) => api.post(`/admin/quiz/end/${quizId}`);
export const getActiveQuiz = () => api.get("/quiz/active");

// Effects endpoints
export const sendEffect = (data) => api.post("/admin/effects/send", data);

// Leaderboard
export const getLeaderboard = () => api.get("/leaderboard");

// Display data
export const getDisplayData = (pubCode) => api.get(`/display/data?pub_code=${pubCode}`);

export default api;
