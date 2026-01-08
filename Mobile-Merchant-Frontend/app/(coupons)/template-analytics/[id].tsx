import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, Switch } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { colors } from '@/constants/colors';
import { Header } from '../components/Header';
import { merchantAPI } from '@/utils/api';
import TrendChart from '../../(profile)/components/TrendChart';

interface TrendData {
  current: number;
  average: number;
  daily_data: Array<{
    date: string;
    value: number | null;
  }>;
}

interface AnalyticsData {
  // Common fields
  exposure_count?: number;
  conversion_rate?: number;
  trends?: {
    exposure_count?: TrendData;
    conversion_rate?: TrendData;
    retention_rate?: TrendData;
    stranger_acquisition_rate?: TrendData;
    circulation_rate?: TrendData;
    circulation_redemption_rate?: TrendData;
    redemption_rate?: TrendData;
  };
  // Exclusive template fields only
  retention_rate?: number;
  stranger_acquisition_rate?: number;
  circulation_rate?: number;
  circulation_redemption_rate?: number;
  redemption_rate?: number;
  // Count fields (exclusive templates only)
  retention_count?: number;
  stranger_acquisition_count?: number;
  redemption_count?: number;
  circulation_count?: number;
  circulation_redemption_count?: number;
}

type TimeRange = 3 | 7 | 30 | 90;

type MetricType = 'exposure_count' | 'conversion_rate' | 'retention_rate' | 'stranger_acquisition_rate' | 'circulation_rate' | 'circulation_redemption_rate' | 'redemption_rate';

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
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('exposure_count');
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
      // For store templates, default to exposure_count
      if (selectedMetric !== 'exposure_count' && selectedMetric !== 'conversion_rate') {
        setSelectedMetric('exposure_count');
      }
    } else {
      // For exclusive templates, default to exposure_count
      if (!['exposure_count', 'conversion_rate', 'retention_rate', 'stranger_acquisition_rate', 'circulation_rate', 'circulation_redemption_rate', 'redemption_rate'].includes(selectedMetric)) {
        setSelectedMetric('exposure_count');
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
      exposure_count: '曝光次數',
      conversion_rate: '轉換率',
      retention_rate: '留客率',
      stranger_acquisition_rate: '陌生獲客率',
      circulation_rate: '流動率',
      circulation_redemption_rate: '流動核銷率',
      redemption_rate: '核銷率',
    };
    return labels[metric];
  };

  const getTrendData = (metric: MetricType, data: AnalyticsData): TrendData | null => {
    // Check trends in data.trends
    if (data.trends && data.trends[metric]) {
      return data.trends[metric];
    }
    return null;
  };

  const getCurrentValue = (metric: MetricType, data: AnalyticsData): string => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      if (metric === 'exposure_count') {
        return trendData.current.toLocaleString('zh-TW');
      } else {
        return formatPercentage(trendData.current);
      }
    }
    
    // Fallback to direct values
    switch (metric) {
      case 'exposure_count':
        return (data.exposure_count || 0).toLocaleString('zh-TW');
      case 'conversion_rate':
        return formatPercentage(data.conversion_rate || 0);
      case 'retention_rate':
        return formatPercentage(data.retention_rate || 0);
      case 'stranger_acquisition_rate':
        return formatPercentage(data.stranger_acquisition_rate || 0);
      case 'circulation_rate':
        return formatPercentage(data.circulation_rate || 0);
      case 'circulation_redemption_rate':
        return formatPercentage(data.circulation_redemption_rate || 0);
      case 'redemption_rate':
        return formatPercentage(data.redemption_rate || 0);
      default:
        return '0';
    }
  };

  const getAverageValue = (metric: MetricType, data: AnalyticsData): string => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      if (metric === 'exposure_count') {
        return trendData.average.toLocaleString('zh-TW');
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

              {/* Toggle Switch: 張數 / 百分比 */}
              <XStack alignItems="center" gap="$3" marginBottom="$4">
                <Text fontSize="$md" color={colors.textSecondary}>百分比</Text>
                <Switch
                  checked={false}
                  onCheckedChange={() => {
                    // Navigate to count view
                    router.push(`/template-analytics-count/${templateId}`);
                  }}
                  size="$4"
                />
                <Text fontSize="$md" color={colors.textSecondary}>張數</Text>
              </XStack>

              {/* Time Range Selector */}
              <XStack gap="$2" marginBottom="$4">
                <TimeRangeButton days={3} label="近3天" />
                <TimeRangeButton days={7} label="近7天" />
                <TimeRangeButton days={30} label="近30天" />
                <TimeRangeButton days={90} label="近90天" />
              </XStack>

              {/* Metrics Grid */}
              <YStack gap="$3" marginBottom="$6">
                {isStoreTemplate ? (
                  // Store template (EasyUse): Show exposure and conversion
                  <XStack gap="$3">
                    <MetricCard 
                      label="曝光次數" 
                      value={analytics.exposure_count || 0}
                      metricType="exposure_count"
                      isSelected={selectedMetric === 'exposure_count'}
                      onPress={() => setSelectedMetric('exposure_count')}
                    />
                    <MetricCard 
                      label="轉換率" 
                      value={analytics.conversion_rate || 0}
                      isPercentage
                      metricType="conversion_rate"
                      isSelected={selectedMetric === 'conversion_rate'}
                      onPress={() => setSelectedMetric('conversion_rate')}
                    />
                  </XStack>
                ) : (
                  // Exclusive template: Show all metrics
                  <>
                    <XStack gap="$3">
                      <MetricCard 
                        label="曝光次數" 
                        value={analytics.exposure_count || 0}
                        metricType="exposure_count"
                        isSelected={selectedMetric === 'exposure_count'}
                        onPress={() => setSelectedMetric('exposure_count')}
                      />
                      <MetricCard 
                        label="轉換率" 
                        value={analytics.conversion_rate || 0} 
                        isPercentage
                        metricType="conversion_rate"
                        isSelected={selectedMetric === 'conversion_rate'}
                        onPress={() => setSelectedMetric('conversion_rate')}
                      />
                    </XStack>
                    <XStack gap="$3">
                      <MetricCard 
                        label="留客率" 
                        value={analytics.retention_rate || 0} 
                        isPercentage
                        metricType="retention_rate"
                        isSelected={selectedMetric === 'retention_rate'}
                        onPress={() => setSelectedMetric('retention_rate')}
                      />
                      <MetricCard 
                        label="陌生獲客率" 
                        value={analytics.stranger_acquisition_rate || 0} 
                        isPercentage
                        metricType="stranger_acquisition_rate"
                        isSelected={selectedMetric === 'stranger_acquisition_rate'}
                        onPress={() => setSelectedMetric('stranger_acquisition_rate')}
                      />
                    </XStack>
                    <XStack gap="$3">
                      <MetricCard 
                        label="核銷率" 
                        value={analytics.redemption_rate || 0} 
                        isPercentage
                        metricType="redemption_rate"
                        isSelected={selectedMetric === 'redemption_rate'}
                        onPress={() => setSelectedMetric('redemption_rate')}
                      />
                      <MetricCard 
                        label="流動率" 
                        value={analytics.circulation_rate || 0} 
                        isPercentage
                        metricType="circulation_rate"
                        isSelected={selectedMetric === 'circulation_rate'}
                        onPress={() => setSelectedMetric('circulation_rate')}
                      />
                    </XStack>
                    <XStack gap="$3">
                      <MetricCard 
                        label="流動核銷率" 
                        value={analytics.circulation_redemption_rate || 0} 
                        isPercentage
                        metricType="circulation_redemption_rate"
                        isSelected={selectedMetric === 'circulation_redemption_rate'}
                        onPress={() => setSelectedMetric('circulation_redemption_rate')}
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
                {/* Trend Chart */}
                <TrendChart 
                  data={getTrendData(selectedMetric, analytics)} 
                  isPercentage={selectedMetric !== 'exposure_count'}
                  yAxisSuffix={selectedMetric === 'exposure_count' ? '' : '%'}
                />
              </View>

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

