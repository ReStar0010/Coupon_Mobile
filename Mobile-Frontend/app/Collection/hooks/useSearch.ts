// Custom hook for search functionality
import { useState, useCallback } from 'react';

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = useCallback((value: string | React.ChangeEvent<HTMLInputElement>) => {
    if (typeof value === 'string') {
      setSearchQuery(value);
    } else {
      setSearchQuery(value.target.value);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    handleSearchChange,
    clearSearch,
  };
}
export default useSearch;
