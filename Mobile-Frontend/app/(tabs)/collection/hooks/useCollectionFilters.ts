import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import type { ExpiryFilter } from '../utils/types';
import type { Tag } from './useTags';

const EXPIRY_FILTER_OPTIONS: { value: ExpiryFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'expiringSoon', label: '即將到期（7天內）' },
  { value: 'thisWeek', label: '本週到期' },
  { value: 'thisMonth', label: '本月到期' },
];

export interface UseCollectionFiltersArgs {
  tags: Tag[];
  merchants: string[];
}

export interface UseCollectionFiltersReturn {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  expiryFilter: ExpiryFilter;
  setExpiryFilter: (filter: ExpiryFilter) => void;
  selectedMerchant: string | null;
  setSelectedMerchant: (merchant: string | null) => void;
  selectedTagDisplayNames: string[];
  tagFilterLabel: string | null;
  expiryFilterLabel: string | null;
  merchantFilterLabel: string | null;
  openTagPicker: () => void;
  openExpiryPicker: () => void;
  openMerchantPicker: () => void;
  expiryFilterOptions: typeof EXPIRY_FILTER_OPTIONS;
}

export function useCollectionFilters({
  tags,
  merchants,
}: UseCollectionFiltersArgs): UseCollectionFiltersReturn {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  const tagMap = useMemo(() => {
    const map = new Map<string, string>();
    tags.forEach((tag) => map.set(tag.name, tag.display_name));
    return map;
  }, [tags]);

  const selectedTagDisplayNames = useMemo(
    () => selectedTags.map((name) => tagMap.get(name) ?? name),
    [selectedTags, tagMap]
  );

  const tagFilterLabel = useMemo((): string | null => {
    if (selectedTags.length === 0) return null;
    const tag = tags.find((t) => t.name === selectedTags[0]);
    return tag ? tag.display_name : selectedTags[0];
  }, [selectedTags, tags]);

  const expiryFilterLabel = useMemo((): string | null => {
    const option = EXPIRY_FILTER_OPTIONS.find((opt) => opt.value === expiryFilter);
    return option && option.value !== 'all' ? option.label : null;
  }, [expiryFilter]);

  const merchantFilterLabel = useMemo((): string | null => {
    if (!selectedMerchant) return null;
    return selectedMerchant.length > 10
      ? `${selectedMerchant.substring(0, 10)}...`
      : selectedMerchant;
  }, [selectedMerchant]);

  const openTagPicker = useCallback(() => {
    const options = [
      { text: '全部', onPress: () => setSelectedTags([]) },
      ...tags.map((tag) => ({
        text: tag.display_name,
        onPress: () => setSelectedTags([tag.name]),
      })),
    ];
    Alert.alert(
      '選擇分類',
      '請選擇要篩選的分類標籤',
      [...options, { text: '取消', style: 'cancel' as const }],
      { cancelable: true }
    );
  }, [tags]);

  const openExpiryPicker = useCallback(() => {
    const options = EXPIRY_FILTER_OPTIONS.map((option) => ({
      text: option.label,
      onPress: () => setExpiryFilter(option.value),
    }));
    Alert.alert(
      '選擇有效期',
      '請選擇要篩選的有效期範圍',
      [...options, { text: '取消', style: 'cancel' as const }],
      { cancelable: true }
    );
  }, []);

  const openMerchantPicker = useCallback(() => {
    const options = [
      { text: '全部', onPress: () => setSelectedMerchant(null) },
      ...merchants.map((merchant) => ({
        text: merchant,
        onPress: () => setSelectedMerchant(merchant),
      })),
    ];
    Alert.alert(
      '選擇商家',
      '請選擇要篩選的商家',
      [...options, { text: '取消', style: 'cancel' as const }],
      { cancelable: true }
    );
  }, [merchants]);

  return {
    selectedTags,
    setSelectedTags,
    expiryFilter,
    setExpiryFilter,
    selectedMerchant,
    setSelectedMerchant,
    selectedTagDisplayNames,
    tagFilterLabel,
    expiryFilterLabel,
    merchantFilterLabel,
    openTagPicker,
    openExpiryPicker,
    openMerchantPicker,
    expiryFilterOptions: EXPIRY_FILTER_OPTIONS,
  };
}
