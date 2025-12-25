import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from './components/Header';
import { merchantAPI } from '@/utils/api';

interface TrendData {
  current: number;
  average: number;
  daily_data: Array<{
    date: string;
    value: number | null;
  }>;
}

interface AnalyticsData {
  // Exclusive template fields
  gmv?: number;
  stranger_acquisition_ratio?: number;
  coupon_activation_rate?: number;
  local_conversion_rate?: number | null;
  overall_conversion_rate?: number;
  redemption_rate?: number;
  transfer_ranking?: Array<{
    user_id: number;
    email: string;
    transfer_count: number;
  }>;
  trends?: {
    gmv?: TrendData;
    stranger_acquisition_ratio?: TrendData;
    coupon_activation_rate?: TrendData;
    local_conversion_rate?: TrendData;
    overall_conversion_rate?: TrendData;
    redemption_rate?: TrendData;
  };
  // Store template fields
  click_count?: number;
  unique_users?: number;
  click_trend?: TrendData;
  unique_users_trend?: TrendData;
}

type TimeRange = 7 | 30 | 90;

type MetricType = 'stranger_acquisition_ratio' | 'coupon_activation_rate' | 'local_conversion_rate' | 'overall_conversion_rate' | 'redemption_rate' | 'click_count' | 'unique_users';

interface MetricCardProps {
  label: string;
  value: string | number;
  isPercentage?: boolean;
  metricType: MetricType;
  isSelected?: boolean;
  onPress?: () => void;
}

function MetricCard({ label, value, isPercentage = false, metricType, isSelected = false, onPress }: MetricCardProps) {
  const displayValue = isPercentage 
    ? typeof value === 'number' 
      ? `${(value * 100).toFixed(0)}%` 
      : value === null 
        ? '數據不足' 
        : value
    : typeof value === 'number'
      ? value.toLocaleString('zh-TW')
      : value === null
        ? '數據不足'
        : value;

  return (
    <TouchableOpacity
      style={[styles.metricCard, isSelected && styles.metricCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text fontSize="$sm" color={colors.textSecondary} marginBottom="$2">
        {label}
      </Text>
      <Text fontSize={28} fontWeight="700" color={colors.textPrimary}>
        {displayValue}
      </Text>
    </TouchableOpacity>
  );
}

export default function TemplateAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const templateId = params.id ? parseInt(params.id as string, 10) : null;
  
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('stranger_acquisition_ratio');
  const [templateName, setTemplateName] = useState<string>('');
  const [isStoreTemplate, setIsStoreTemplate] = useState<boolean>(false);

  const loadAnalytics = async () => {
    if (!templateId) {
      setError('無效的模板 ID');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Load template name and check type
      try {
        const templateData = await merchantAPI.getTemplate(templateId);
        setTemplateName(templateData.coupon_name || '');
        // Check if this is a store template (EasyUse - total_quantity == 0)
        setIsStoreTemplate(templateData.total_quantity === 0);
      } catch (err) {
        console.error('Failed to load template name:', err);
      }
      
      const data = await merchantAPI.getTemplateAnalytics(templateId, timeRange);
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || '載入數據失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, templateId]);

  // Auto-switch selected metric based on template type
  useEffect(() => {
    if (isStoreTemplate) {
      // For store templates, default to click_count
      if (selectedMetric !== 'click_count' && selectedMetric !== 'unique_users') {
        setSelectedMetric('click_count');
      }
    } else {
      // For exclusive templates, default to stranger_acquisition_ratio
      if (selectedMetric === 'click_count' || selectedMetric === 'unique_users') {
        setSelectedMetric('stranger_acquisition_ratio');
      }
    }
  }, [isStoreTemplate, selectedMetric]);

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  const getMetricLabel = (metric: MetricType): string => {
    const labels: Record<MetricType, string> = {
      stranger_acquisition_ratio: '陌生獲客比',
      coupon_activation_rate: '優惠券活化率',
      local_conversion_rate: '在地轉換率',
      overall_conversion_rate: '總體轉換率',
      redemption_rate: '核銷率',
      click_count: '總點擊次數',
      unique_users: '不重複用戶數',
    };
    return labels[metric];
  };

  const getTrendData = (metric: MetricType, data: AnalyticsData): TrendData | null => {
    // Check store template trends
    if (metric === 'click_count' && data.click_trend) {
      return data.click_trend;
    }
    if (metric === 'unique_users' && data.unique_users_trend) {
      return data.unique_users_trend;
    }
    // Check exclusive template trends
    if (data.trends && data.trends[metric]) {
      return data.trends[metric];
    }
    return null;
  };

  const getCurrentValue = (metric: MetricType, data: AnalyticsData): string => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      if (metric === 'click_count' || metric === 'unique_users') {
        return trendData.current.toLocaleString('zh-TW');
      } else if (metric === 'local_conversion_rate' && trendData.current === null) {
        return '數據不足';
      } else {
        return formatPercentage(trendData.current);
      }
    }
    
    // Fallback to direct values
    switch (metric) {
      case 'stranger_acquisition_ratio':
        return formatPercentage(data.stranger_acquisition_ratio || 0);
      case 'coupon_activation_rate':
        return formatPercentage(data.coupon_activation_rate || 0);
      case 'local_conversion_rate':
        return data.local_conversion_rate !== null && data.local_conversion_rate !== undefined ? formatPercentage(data.local_conversion_rate) : '數據不足';
      case 'overall_conversion_rate':
        return formatPercentage(data.overall_conversion_rate || 0);
      case 'redemption_rate':
        return formatPercentage(data.redemption_rate || 0);
      case 'click_count':
        return (data.click_count || 0).toLocaleString('zh-TW');
      case 'unique_users':
        return (data.unique_users || 0).toLocaleString('zh-TW');
      default:
        return '0';
    }
  };

  const getAverageValue = (metric: MetricType, data: AnalyticsData): string => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      if (metric === 'click_count' || metric === 'unique_users') {
        return trendData.average.toLocaleString('zh-TW');
      } else if (metric === 'local_conversion_rate' && trendData.average === null) {
        return '數據不足';
      } else {
        return formatPercentage(trendData.average);
      }
    }
    // Fallback to current value
    return getCurrentValue(metric, data);
  };

  const getTrendDataCount = (metric: MetricType, data: AnalyticsData): number => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      return trendData.daily_data.length;
    }
    return 0;
  };

  const TimeRangeButton = ({ days, label }: { days: TimeRange; label: string }) => {
    const isSelected = timeRange === days;
    return (
      <TouchableOpacity
        style={[styles.timeRangeButton, isSelected && styles.timeRangeButtonSelected]}
        onPress={() => setTimeRange(days)}
      >
        <Text
          fontSize="$sm"
          fontWeight={isSelected ? '700' : '400'}
          color={isSelected ? colors.white : colors.textPrimary}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!templateId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
        <YStack flex={1} backgroundColor={colors.white}>
          <Header onLogoPress={() => router.push('/(coupons)/')} showMenu={false} />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Text color={colors.error}>無效的模板 ID</Text>
          </View>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        <Header onLogoPress={() => router.push('/(coupons)/')} showMenu={false} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Text color={colors.error} marginBottom="$4">{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadAnalytics}
              >
                <Text color={colors.white}>重試</Text>
              </TouchableOpacity>
            </View>
          ) : analytics ? (
            <>
              {/* Title */}
              <Text fontSize={24} fontWeight="700" color={colors.textPrimary} marginBottom="$2">
                {templateName ? `${templateName} 統計數據` : '統計數據'}
              </Text>

              {/* Time Range Selector */}
              <XStack gap="$2" marginBottom="$4">
                <TimeRangeButton days={7} label="近7天" />
                <TimeRangeButton days={30} label="近30天" />
                <TimeRangeButton days={90} label="近90天" />
              </XStack>

              {/* Metrics Grid */}
              <YStack gap="$3" marginBottom="$6">
                {isStoreTemplate ? (
                  // Store template: Only show click statistics
                  <XStack gap="$3">
                    <MetricCard 
                      label="總點擊次數" 
                      value={analytics.click_count || 0}
                      metricType="click_count"
                      isSelected={selectedMetric === 'click_count'}
                      onPress={() => setSelectedMetric('click_count')}
                    />
                    <MetricCard 
                      label="不重複用戶數" 
                      value={analytics.unique_users || 0}
                      metricType="unique_users"
                      isSelected={selectedMetric === 'unique_users'}
                      onPress={() => setSelectedMetric('unique_users')}
                    />
                  </XStack>
                ) : (
                  // Exclusive template: Show all metrics
                  <>
                    <XStack gap="$3">
                      <MetricCard 
                        label="陌生獲客比" 
                        value={analytics.stranger_acquisition_ratio || 0} 
                        isPercentage
                        metricType="stranger_acquisition_ratio"
                        isSelected={selectedMetric === 'stranger_acquisition_ratio'}
                        onPress={() => setSelectedMetric('stranger_acquisition_ratio')}
                      />
                      <MetricCard 
                        label="優惠券活化率" 
                        value={analytics.coupon_activation_rate || 0} 
                        isPercentage
                        metricType="coupon_activation_rate"
                        isSelected={selectedMetric === 'coupon_activation_rate'}
                        onPress={() => setSelectedMetric('coupon_activation_rate')}
                      />
                    </XStack>
                    <XStack gap="$3">
                      <MetricCard 
                        label="在地轉換率" 
                        value={analytics.local_conversion_rate} 
                        isPercentage
                        metricType="local_conversion_rate"
                        isSelected={selectedMetric === 'local_conversion_rate'}
                        onPress={() => setSelectedMetric('local_conversion_rate')}
                      />
                      <MetricCard 
                        label="總體轉換率" 
                        value={analytics.overall_conversion_rate || 0} 
                        isPercentage
                        metricType="overall_conversion_rate"
                        isSelected={selectedMetric === 'overall_conversion_rate'}
                        onPress={() => setSelectedMetric('overall_conversion_rate')}
                      />
                      <MetricCard 
                        label="核銷率" 
                        value={analytics.redemption_rate || 0} 
                        isPercentage
                        metricType="redemption_rate"
                        isSelected={selectedMetric === 'redemption_rate'}
                        onPress={() => setSelectedMetric('redemption_rate')}
                      />
                    </XStack>
                  </>
                )}
              </YStack>

              {/* Trend Chart Section */}
              <View style={styles.sectionCard}>
                <Text fontSize="$lg" fontWeight="700" color={colors.textPrimary} marginBottom="$3">
                  {getMetricLabel(selectedMetric)}趨勢
                </Text>
                <YStack gap="$2" marginBottom="$3">
                  <XStack justifyContent="space-between">
                    <Text fontSize="$sm" color={colors.textSecondary}>
                      目前{getMetricLabel(selectedMetric)}
                    </Text>
                    <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                      {getCurrentValue(selectedMetric, analytics)}
                    </Text>
                  </XStack>
                  <XStack justifyContent="space-between">
                    <Text fontSize="$sm" color={colors.textSecondary}>
                      近{timeRange}天平均
                    </Text>
                    <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
                      {getAverageValue(selectedMetric, analytics)}
                    </Text>
                  </XStack>
                </YStack>
                {/* Simple trend visualization - can be replaced with chart library later */}
                <View style={styles.trendContainer}>
                  <Text fontSize="$xs" color={colors.textSecondary} textAlign="center">
                    趨勢圖表（待實作圖表庫）
                  </Text>
                  <Text fontSize="$xs" color={colors.textSecondary} textAlign="center" marginTop="$2">
                    數據點數: {getTrendDataCount(selectedMetric, analytics)}
                  </Text>
                </View>
              </View>

              {/* Transfer Ranking - Only for exclusive templates */}
              {!isStoreTemplate && analytics.transfer_ranking && (
              <View style={[styles.sectionCard, { marginTop: 16 }]}>
                <Text fontSize="$lg" fontWeight="700" color={colors.textPrimary} marginBottom="$3">
                  用戶轉贈總數排行榜
                </Text>
                {analytics.transfer_ranking.length > 0 ? (
                  <YStack gap="$2">
                    {analytics.transfer_ranking.map((item, index) => (
                      <XStack
                        key={item.user_id}
                        paddingVertical="$2"
                        paddingHorizontal="$3"
                        backgroundColor={colors.background}
                        borderRadius={8}
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <XStack alignItems="center" gap="$3">
                          <View style={styles.rankBadge}>
                            <Text fontSize="$sm" fontWeight="700" color={colors.white}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text fontSize="$md" color={colors.textPrimary}>
                            {item.email}
                          </Text>
                        </XStack>
                        <Text fontSize="$md" fontWeight="600" color={colors.primary}>
                          {item.transfer_count}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <Text fontSize="$sm" color={colors.textSecondary} textAlign="center" padding="$4">
                    尚無轉贈記錄
                  </Text>
                )}
              </View>
              )}
            </>
          ) : null}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  metricCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.background,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRangeButtonSelected: {
    backgroundColor: colors.primary,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trendContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});

