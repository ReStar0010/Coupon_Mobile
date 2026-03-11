/**
 * Report Button Component
 * UGC Compliance (Apple Guideline 1.2) - User Story 1
 *
 * Reusable button component for reporting content.
 * Shows different states:
 * - Normal: Flag icon with "檢舉" label
 * - Already reported: Checkmark with "已檢舉" label (disabled)
 * - Loading: ActivityIndicator
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkReportStatus, ReportContentType } from '../services/contentReportAPI';
import ReportModal from './ReportModal';

interface ReportButtonProps {
  contentType: ReportContentType;
  contentId: number;
  contentName?: string;
  /** Button style variant */
  variant?: 'default' | 'small' | 'icon-only';
  /** Custom style overrides */
  style?: object;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  contentType,
  contentId,
  contentName,
  variant = 'default',
  style,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, [contentType, contentId]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const status = await checkReportStatus(contentType, contentId);
      setHasReported(status.has_reported && !status.can_report_again);
    } catch (_err) {
      // Silently fail - assume user hasn't reported
      setHasReported(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (!hasReported) {
      setShowModal(true);
    }
  };

  const handleSuccess = () => {
    setHasReported(true);
  };

  // Style variants
  const getButtonStyle = () => {
    const baseStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: 8,
    };

    switch (variant) {
      case 'small':
        return {
          ...baseStyle,
          paddingVertical: 6,
          paddingHorizontal: 10,
          backgroundColor: hasReported ? '#E5E5E5' : '#FFF8E7',
        };
      case 'icon-only':
        return {
          ...baseStyle,
          padding: 8,
          backgroundColor: 'transparent',
        };
      default:
        return {
          ...baseStyle,
          paddingVertical: 10,
          paddingHorizontal: 16,
          backgroundColor: hasReported ? '#E5E5E5' : '#FFF8E7',
          borderWidth: 1,
          borderColor: hasReported ? '#CCC' : '#FFAD31',
        };
    }
  };

  const getTextStyle = () => {
    const baseStyle = {
      fontWeight: '500' as const,
      marginLeft: 6,
    };

    switch (variant) {
      case 'small':
        return {
          ...baseStyle,
          fontSize: 13,
          color: hasReported ? '#999' : '#D97706',
        };
      case 'icon-only':
        return null; // No text for icon-only variant
      default:
        return {
          ...baseStyle,
          fontSize: 14,
          color: hasReported ? '#999' : '#D97706',
        };
    }
  };

  const getIconSize = () => {
    switch (variant) {
      case 'small':
        return 14;
      case 'icon-only':
        return 20;
      default:
        return 16;
    }
  };

  if (loading) {
    return (
      <View style={[getButtonStyle(), style]}>
        <ActivityIndicator size="small" color="#FFAD31" />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        disabled={hasReported}
        style={[getButtonStyle(), style]}
        activeOpacity={hasReported ? 1 : 0.7}
      >
        <Ionicons
          name={hasReported ? 'checkmark-circle' : 'flag-outline'}
          size={getIconSize()}
          color={hasReported ? '#999' : '#D97706'}
        />
        {variant !== 'icon-only' && (
          <Text style={getTextStyle()}>{hasReported ? '已檢舉' : '檢舉'}</Text>
        )}
      </TouchableOpacity>

      <ReportModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        contentType={contentType}
        contentId={contentId}
        contentName={contentName}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default ReportButton;
