import React from 'react';
import { YStack, XStack, Text, Card } from 'tamagui';

interface LightSystemProps {
  title: string;
  description: string;
  count: number;
  threshold: number;
  /** Reward tier: 'sharing' = $10 per O>=3; 'referral' = $5 at O=1, $10 for O>=2 */
  rewardType: 'sharing' | 'referral';
  /** For sharing only: number of $10 vouchers already earned (backend resets count at 3) */
  vouchersEarned?: number;
}

function computeRewards(
  count: number,
  rewardType: 'sharing' | 'referral',
  vouchersEarned?: number,
): string {
  if (rewardType === 'sharing') {
    const qty = vouchersEarned ?? Math.max(0, count - 2);
    if (qty === 0) return '尚未獲得獎勵';
    return `已獲得 ${qty} 張 $10 現金券`;
  }
  if (count === 0) return '尚未獲得獎勵';
  // referral: O=0 → nothing, O=1 → $5 voucher, O>=2 → $10 each additional
  if (count === 1) return '已獲得 1 張 $5 現金券';
  const tenDollarCount = count - 1;
  return `已獲得 1 張 $5 + ${tenDollarCount} 張 $10 現金券`;
}

const LightSystem: React.FC<LightSystemProps> = ({
  title,
  description,
  count,
  threshold,
  rewardType,
  vouchersEarned,
}) => {
  // For 'sharing' (metric 2), backend sends current cycle 0..2; for referral use count capped at threshold
  const displayCount =
    rewardType === 'sharing' ? count : Math.min(count, threshold);
  const litCount = displayCount;
  const rewardText = computeRewards(count, rewardType, vouchersEarned);

  return (
    <Card
      padding="$5"
      backgroundColor="white"
      borderRadius="$6"
      borderWidth={1}
      borderColor="#e5e5e5"
      shadowColor="black"
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.08}
      elevation={3}
    >
      <YStack gap="$3">
        {/* Title */}
        <Text fontSize={16} fontWeight="600" color="#1a1a1a">
          {title}
        </Text>

        {/* Description */}
        <Text fontSize={13} color="#888888" lineHeight={18}>
          {description}
        </Text>

        {/* Lights row */}
        <XStack gap="$3" items="center">
          {Array.from({ length: threshold }).map((_, i) => {
            const isLit = i < litCount;
            return (
              <YStack
                key={i}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isLit ? '#FFAD31' : '#E5E5E5',
                  borderWidth: isLit ? 0 : 1,
                  borderColor: '#CCCCCC',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text fontSize={18}>{isLit ? '💡' : '⭕'}</Text>
              </YStack>
            );
          })}
          <Text fontSize={14} color="#666666" ml="$2">
            {displayCount} / {threshold}
            {rewardType === 'referral' && count > threshold
              ? ` (+${count - threshold})`
              : ''}
          </Text>
        </XStack>

        {/* Reward summary */}
        <YStack
          style={{
            backgroundColor: '#FFF8ED',
            borderRadius: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: '#e5e5e5',
          }}
        >
          <Text fontSize={13} color="#B87A00" fontWeight="500">
            {rewardText}
          </Text>
        </YStack>
      </YStack>
    </Card>
  );
};

export default LightSystem;
