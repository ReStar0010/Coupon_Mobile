import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '@/constants/colors';
import { Text } from 'tamagui';

interface TrendData {
  current: number;
  average: number;
  daily_data: Array<{
    date: string;
    value: number | null;
  }>;
}

interface TrendChartProps {
  data: TrendData | null;
  height?: number;
  isPercentage?: boolean; // Whether to treat values as percentages (0-1) or raw numbers
  yAxisSuffix?: string; // Suffix for Y-axis labels (e.g., "%" or "")
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 32; // 16px padding on each side of the card
const MIN_POINT_SPACING = 50; // Minimum spacing between data points in pixels
const Y_AXIS_WIDTH = 50; // Width for Y-axis labels (chart library will use this space)
const CHART_MIN_WIDTH = SCREEN_WIDTH - CARD_PADDING - Y_AXIS_WIDTH - 4; // Minimum chart width (card width minus padding and Y-axis)

export default function TrendChart({ data, height = 220, isPercentage = true, yAxisSuffix = '%' }: TrendChartProps) {
  // State to track selected data point
  const [selectedPoint, setSelectedPoint] = useState<{ index: number; value: number; label: string } | null>(null);

  const { chartData, chartWidth } = useMemo(() => {
    if (!data || !data.daily_data || data.daily_data.length === 0) {
      return { chartData: null, chartWidth: CHART_MIN_WIDTH };
    }

    // Filter out null values and format data for the chart
    const validData = data.daily_data
      .map((item, index) => ({
        value: item.value !== null ? (isPercentage ? item.value * 100 : item.value) : null,
        label: formatDate(item.date),
        originalIndex: index,
      }))
      .filter((item) => item.value !== null);

    if (validData.length === 0) {
      return { chartData: null, chartWidth: CHART_MIN_WIDTH };
    }

    // Calculate chart width based on number of data points
    // Ensure minimum spacing between points to avoid label overlap
    const calculatedWidth = Math.max(
      CHART_MIN_WIDTH,
      (validData.length - 1) * MIN_POINT_SPACING + 80 // 80px for initial and end spacing
    );

    // Format for react-native-gifted-charts
    // Show all labels since we can scroll now
    const formattedData = validData.map((item) => ({
      value: item.value!,
      label: item.label,
    }));

    return { chartData: formattedData, chartWidth: calculatedWidth };
  }, [data, isPercentage]);


  // Calculate Y-axis range
  const yAxisConfig = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { minValue: 0, maxValue: isPercentage ? 100 : 10, stepValue: isPercentage ? 20 : 2 };
    }

    const values = chartData.map((item) => item.value);
    const minValue = Math.max(0, Math.floor(Math.min(...values) / 10) * 10 - 10);
    const maxValue = Math.ceil(Math.max(...values) / 10) * 10 + 10;
    const range = maxValue - minValue;
    
    let stepValue: number;
    if (isPercentage) {
      stepValue = range <= 20 ? 5 : range <= 50 ? 10 : 20;
    } else {
      // For raw numbers, calculate step based on range
      if (range <= 20) {
        stepValue = 2;
      } else if (range <= 50) {
        stepValue = 5;
      } else if (range <= 100) {
        stepValue = 10;
      } else {
        stepValue = Math.ceil(range / 10);
      }
    }

    return {
      minValue: Math.max(0, minValue),
      maxValue: isPercentage ? Math.min(100, maxValue) : maxValue,
      stepValue,
    };
  }, [chartData, isPercentage]);

  if (!data || !chartData || chartData.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text fontSize="$xs" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          暫無數據
        </Text>
      </View>
    );
  }

  const pointSpacing = chartData.length > 1 ? (chartWidth - 60) / (chartData.length - 1) : 0; // Reduced from 80 to 60 to account for reduced initialSpacing
  const chartHeight = height - 40; // Reduced padding to make chart taller
  const noOfSections = Math.floor((yAxisConfig.maxValue - yAxisConfig.minValue) / yAxisConfig.stepValue);

  // Handle data point press
  const handleDataPointPress = (item: { value: number; label: string }, index: number) => {
    setSelectedPoint({ index, value: item.value, label: item.label });
  };

  // Format Y-axis value for display
  const formatYValue = (value: number): string => {
    if (isPercentage) {
      return `${value.toFixed(value % 1 === 0 ? 0 : 1)}${yAxisSuffix}`;
    } else {
      return `${value.toFixed(value % 1 === 0 ? 0 : 2)}${yAxisSuffix}`;
    }
  };

  // Calculate tooltip position based on selected point
  const getTooltipPosition = () => {
    if (!selectedPoint || !chartData) return null;
    
    const pointIndex = selectedPoint.index;
    const xPosition = 30 + (pointIndex * pointSpacing); // initialSpacing + (index * spacing)
    const valueRatio = (selectedPoint.value - yAxisConfig.minValue) / (yAxisConfig.maxValue - yAxisConfig.minValue);
    const yPosition = chartHeight - (valueRatio * chartHeight) - 30; // Position above the data point
    
    return { x: xPosition, y: yPosition };
  };

  const tooltipPosition = getTooltipPosition();

  return (
    <View style={[styles.container, { height }]}>
      {/* Scrollable chart content with built-in Y-axis */}
      <View style={styles.chartContainer}>
        <ScrollView
          horizontal
          scrollEnabled={true}
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={[styles.scrollContent, { minWidth: chartWidth }]}
          style={styles.scrollView}
          decelerationRate={1.2}
          bounces={true}
          alwaysBounceHorizontal={true}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          overScrollMode="always"
        >
          <View style={{ position: 'relative' }}>
            <LineChart
              data={chartData}
              width={chartWidth}
              height={chartHeight}
              color={colors.primary}
              thickness={2}
              spacing={pointSpacing}
              hideDataPoints={false}
              dataPointsColor={colors.primary}
              dataPointsRadius={4}
              textColor={colors.textSecondary}
              textFontSize={10}
              hideYAxisText={false}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9, width: 50 }}
              rulesColor={colors.border}
              rulesType="solid"
              initialSpacing={30}
              endSpacing={40}
              yAxisLabelSuffix={yAxisSuffix}
              maxValue={yAxisConfig.maxValue}
              stepValue={yAxisConfig.stepValue}
              noOfSections={noOfSections}
              curved={false}
              areaChart={false}
              backgroundColor="transparent"
              hideAxesAndRules={false}
              showVerticalLines={false}
              rotateLabel={false}
              onPress={handleDataPointPress}
            />
            {/* Tooltip to display Y-axis value */}
            {selectedPoint && tooltipPosition && (
              <View
                style={[
                  styles.tooltip,
                  {
                    left: tooltipPosition.x - 25,
                    top: tooltipPosition.y,
                  },
                ]}
              >
                <Text fontSize={12} fontWeight="600" color={colors.white}>
                  {formatYValue(selectedPoint.value)}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  } catch (error) {
    return dateString;
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    paddingLeft: 0, // Remove left padding to fill card
  },
  chartContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 0, // Remove vertical padding to fill height
    paddingRight: 8,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
});

