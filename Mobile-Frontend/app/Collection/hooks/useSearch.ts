// Custom hook for search functionality
import { useState, useCallback } from 'react';

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    handleSearchChange,
    clearSearch
  };
}
export default useSearch;