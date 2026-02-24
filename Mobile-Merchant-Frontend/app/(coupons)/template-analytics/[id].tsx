import React, { useState, useEffect, useCallback, useRef } from 'react';
import { YStack, XStack, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { colors } from '@/constants/colors';
import { Header } from '../components/Header';
import { merchantAPI } from '@/utils/api';
import TrendChart from '../../(profile)/components/TrendChart';

interface TrendData {
  current: number;
  average: number;
  daily_data: {
    date: string;
    value: number | null;
  }[];
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
  // 009 US2: Date-range cost (exclusive templates only)
  date_range_cost?: number;
  date_range_cost_currency?: string | null;
}

type TimeRange = 0 | 7 | 30 | 90;

type MetricType =
  | 'exposure_count'
  | 'conversion_rate'
  | 'retention_rate'
  | 'stranger_acquisition_rate'
  | 'circulation_rate'
  | 'circulation_redemption_rate'
  | 'redemption_rate';

interface MetricCardProps {
  label: string;
  value: string | number;
  isPercentage?: boolean;
  metricType: MetricType;
  isSelected?: boolean;
  onPress?: () => void;
}

function MetricCard({
  label,
  value,
  isPercentage = false,
  metricType,
  isSelected = false,
  onPress,
}: MetricCardProps) {
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
  const [timeRange, setTimeRange] = useState<TimeRange>(0);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('exposure_count');
  const [templateName, setTemplateName] = useState<string>('');
  const [isStoreTemplate, setIsStoreTemplate] = useState<boolean>(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const isFirstFocus = useRef(true);

  const todayStr = (() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  })();

  const todayDate = new Date();
  todayDate.setHours(12, 0, 0, 0);
  const minSelectableDate = new Date(todayDate);
  minSelectableDate.setDate(minSelectableDate.getDate() - 730);
  const maxSelectableDate = new Date(todayDate);
  const startPickerMinDate = minSelectableDate;
  const startPickerMaxDate = maxSelectableDate;
  const endPickerMinDate = dateFrom ? new Date(dateFrom + 'T12:00:00') : minSelectableDate;
  const endPickerMaxDate = maxSelectableDate;

  const validateDateRange = (): string | null => {
    if (!dateFrom || !dateTo) return null;
    if (dateFrom > dateTo) return '結束日期不可早於開始日期';
    if (dateTo > todayStr) return '結束日期不可超過今天';
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const days = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (days > 730) return '區間不可超過 730 天（2 年）';
    return null;
  };

  const loadAnalytics = async () => {
    if (!templateId) {
      setError('無效的模板 ID');
      setIsLoading(false);
      return;
    }
    if (dateFrom && dateTo) {
      const validationError = validateDateRange();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load template name and check type
      try {
        const templateData = (await merchantAPI.getTemplate(templateId)) as any;
        setTemplateName(templateData.coupon_name || '');
        setIsStoreTemplate(templateData.total_quantity === 0);
      } catch (err) {
        console.error('Failed to load template name:', err);
      }

      const options =
        dateFrom && dateTo
          ? { date_from: dateFrom, date_to: dateTo }
          : timeRange === 0
            ? { date_from: todayStr, date_to: todayStr }
            : { days: timeRange };
      const data = (await merchantAPI.getTemplateAnalytics(templateId, options)) as AnalyticsData;
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      const msg = err?.response?.data?.error ?? err.message ?? '載入數據失敗';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, templateId]);

  // Refetch when screen gains focus (e.g. returning from 張數 page) so data stays in sync.
  // Do not include dateFrom/dateTo in deps so that choosing a date in the picker does not trigger a refresh.
  useFocusEffect(
    useCallback(() => {
      if (!templateId) return;
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadAnalytics();
    }, [timeRange, templateId]),
  );

  // Auto-switch selected metric based on template type
  useEffect(() => {
    if (isStoreTemplate) {
      // For store templates, default to exposure_count
      if (selectedMetric !== 'exposure_count' && selectedMetric !== 'conversion_rate') {
        setSelectedMetric('exposure_count');
      }
    } else {
      // For exclusive templates, default to exposure_count
      if (
        ![
          'exposure_count',
          'conversion_rate',
          'retention_rate',
          'stranger_acquisition_rate',
          'circulation_rate',
          'circulation_redemption_rate',
          'redemption_rate',
        ].includes(selectedMetric)
      ) {
        setSelectedMetric('exposure_count');
      }
    }
  }, [isStoreTemplate, selectedMetric]);

  const _formatCurrency = (value: number) => {
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

  const _getTrendDataCount = (metric: MetricType, data: AnalyticsData): number => {
    const trendData = getTrendData(metric, data);
    if (trendData) {
      return trendData.daily_data.length;
    }
    return 0;
  };

  const formatDateDisplay = (isoDate: string | null) => (isoDate ? isoDate.replace(/-/g, '/') : '');

  const handleStartDateConfirm = (date: Date) => {
    setDateFrom(date.toISOString().slice(0, 10));
    setShowStartDatePicker(false);
  };

  const handleEndDateConfirm = (date: Date) => {
    setDateTo(date.toISOString().slice(0, 10));
    setShowEndDatePicker(false);
  };

  const TimeRangeButton = ({ days, label }: { days: TimeRange; label: string }) => {
    const isSelected = !dateFrom && !dateTo && timeRange === days;
    return (
      <TouchableOpacity
        style={[styles.timeRangeButton, isSelected && styles.timeRangeButtonSelected]}
        onPress={() => {
          setDateFrom(null);
          setDateTo(null);
          setTimeRange(days);
        }}
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
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: 40,
            }}
          >
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
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 40,
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 40,
              }}
            >
              <Text color={colors.error} marginBottom="$4">
                {error}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
                <Text color={colors.white}>重試</Text>
              </TouchableOpacity>
            </View>
          ) : analytics ? (
            <>
              {/* Title */}
              <Text fontSize={24} fontWeight="700" color={colors.textPrimary} marginBottom="$2">
                {templateName ? `${templateName} 統計數據` : '統計數據'}
              </Text>

              {/* Toggle: 百分比 / 張數（與時間區間按鈕一致風格） */}
              <XStack gap="$2" marginBottom="$4">
                <TouchableOpacity
                  style={[styles.timeRangeButton, true && styles.timeRangeButtonSelected]}
                  onPress={() => {}}
                  activeOpacity={0.7}
                >
                  <Text fontSize="$sm" fontWeight="700" color={colors.white}>
                    百分比
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timeRangeButton]}
                  onPress={() => {
                    if (dateFrom && dateTo) {
                      const validationError = validateDateRange();
                      if (validationError) {
                        Alert.alert('日期錯誤', validationError, [{ text: '確定' }]);
                        return;
                      }
                    }
                    const q = dateFrom && dateTo ? `?date_from=${dateFrom}&date_to=${dateTo}` : '';
                    router.push(`/template-analytics-count/${templateId}${q}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text fontSize="$sm" fontWeight="400" color={colors.textPrimary}>
                    張數
                  </Text>
                </TouchableOpacity>
              </XStack>

              {/* Time Range Selector + Custom date */}
              <>
                <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
                  <TimeRangeButton days={0} label="今天" />
                  <TimeRangeButton days={7} label="近7天" />
                  <TimeRangeButton days={30} label="近30天" />
                  <TimeRangeButton days={90} label="近90天" />
                </XStack>
                <XStack gap="$2" marginBottom="$4" alignItems="center" flexWrap="wrap">
                  <Text fontSize="$sm" color={colors.textSecondary} style={{ width: 44 }}>
                    自訂
                  </Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowStartDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      fontSize={14}
                      color={dateFrom ? colors.textPrimary : colors.textSecondary}
                      numberOfLines={1}
                    >
                      {dateFrom ? formatDateDisplay(dateFrom) : '開始日期'}
                    </Text>
                  </TouchableOpacity>
                  <Text fontSize="$sm" color={colors.textSecondary}>
                    ～
                  </Text>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      fontSize={14}
                      color={dateTo ? colors.textPrimary : colors.textSecondary}
                      numberOfLines={1}
                    >
                      {dateTo ? formatDateDisplay(dateTo) : '結束日期'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.timeRangeButton,
                      dateFrom && dateTo && styles.timeRangeButtonSelected,
                    ]}
                    onPress={loadAnalytics}
                  >
                    <Text
                      fontSize="$sm"
                      color={dateFrom && dateTo ? colors.white : colors.textPrimary}
                    >
                      查詢
                    </Text>
                  </TouchableOpacity>
                </XStack>
              </>

              {/* 此區間成本 (exclusive templates only, 009 US2) - hidden for now; will be adjusted in the future */}
              {false && !isStoreTemplate && analytics?.date_range_cost !== undefined && (
                <View style={[styles.metricCard, { marginBottom: 12 }]}>
                  <Text fontSize="$sm" color={colors.textSecondary} marginBottom="$2">
                    此區間成本
                  </Text>
                  <Text fontSize={28} fontWeight="700" color={colors.textPrimary}>
                    {analytics?.date_range_cost_currency
                      ? `${analytics?.date_range_cost_currency} ${Number(analytics?.date_range_cost).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                      : Number(analytics?.date_range_cost).toLocaleString('zh-TW', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                  </Text>
                </View>
              )}

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
                        label="核銷率"
                        value={analytics.redemption_rate || 0}
                        isPercentage
                        metricType="redemption_rate"
                        isSelected={selectedMetric === 'redemption_rate'}
                        onPress={() => setSelectedMetric('redemption_rate')}
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
                        label="流動率"
                        value={analytics.circulation_rate || 0}
                        isPercentage
                        metricType="circulation_rate"
                        isSelected={selectedMetric === 'circulation_rate'}
                        onPress={() => setSelectedMetric('circulation_rate')}
                      />
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
                <Text fontSize="18" fontWeight="700" color={colors.textPrimary} marginBottom="$3">
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
                      {timeRange === 0 ? '今日' : `近${timeRange}天平均`}
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

        <DateTimePickerModal
          isVisible={showStartDatePicker}
          mode="date"
          date={dateFrom ? new Date(dateFrom + 'T12:00:00') : new Date()}
          minimumDate={startPickerMinDate}
          maximumDate={startPickerMaxDate}
          onConfirm={handleStartDateConfirm}
          onCancel={() => setShowStartDatePicker(false)}
          locale="zh-TW"
          confirmTextIOS="完成"
          cancelTextIOS="取消"
        />
        <DateTimePickerModal
          isVisible={showEndDatePicker}
          mode="date"
          date={
            dateTo
              ? new Date(dateTo + 'T12:00:00')
              : dateFrom
                ? new Date(dateFrom + 'T12:00:00')
                : new Date()
          }
          minimumDate={endPickerMinDate}
          maximumDate={endPickerMaxDate}
          onConfirm={handleEndDateConfirm}
          onCancel={() => setShowEndDatePicker(false)}
          locale="zh-TW"
          confirmTextIOS="完成"
          cancelTextIOS="取消"
        />
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
  dateInput: {
    minWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    color: colors.textPrimary,
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
