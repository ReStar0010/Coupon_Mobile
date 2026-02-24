import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '@/app/utils/authAPI';
import { isAxiosError } from 'axios';

export interface Tag {
  id: number;
  name: string;
  display_name: string;
}

// 默认标签列表（如果 API 失败时使用）
const DEFAULT_TAGS: Tag[] = [
  { id: 1, name: 'entertainment', display_name: '娛樂' },
  { id: 2, name: 'shopping', display_name: '購物' },
  { id: 3, name: 'travel', display_name: '旅遊' },
  { id: 4, name: 'health', display_name: '健康' },
  { id: 5, name: 'food', display_name: '食物' },
  { id: 6, name: 'drink', display_name: '飲品' },
  { id: 7, name: 'discount', display_name: '折扣' },
  { id: 8, name: 'other', display_name: '其他' },
];

interface UseTagsReturn {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;
  fetchTags: () => Promise<void>;
}

export function useTags(isAuthenticated: boolean): UseTagsReturn {
  const [tags, setTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    if (!isAuthenticated) {
      setTags(DEFAULT_TAGS);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAPI('/tags/', {
        method: 'GET',
        withCredentials: true,
      });

      if (Array.isArray(response.data) && response.data.length > 0) {
        const transformedTags: Tag[] = response.data.map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          display_name: tag.display_name || tag.name,
        }));
        setTags(transformedTags);
      } else {
        // 如果 API 返回空数组或无效数据，使用默认标签
        setTags(DEFAULT_TAGS);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
      // API 失败时使用默认标签
      setTags(DEFAULT_TAGS);
      if (isAxiosError(err)) {
        setError(err.message);
      } else {
        setError('無法載入標籤列表');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    isLoading,
    error,
    fetchTags,
  };
}

export default useTags;
