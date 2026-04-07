// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = window.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response, 
  async (error) => {
    const prevRequest = error?.config;
    
    if (error?.response?.status === 401 && !prevRequest?.sent) {
      prevRequest.sent = true;
      
      try {
        const response = await axios.get('http://localhost:8000/api/refresh', {
          withCredentials: true
        });
        
        const newAccessToken = response.data.accessToken;
        window.accessToken = newAccessToken;
        
        // รัน Request เดิมซ้ำอีกครั้งด้วย Token ใหม่
        prevRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(prevRequest);
      } catch (refreshError) {
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;