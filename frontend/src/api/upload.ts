import client from './client';
import { compressImage } from '../utils/imageCompress';

export const uploadApi = {
  upload: async (file: File) => {
    // 上传前自动压缩图片，减少带宽占用
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('file', compressed);
    return client.post<{ url: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
