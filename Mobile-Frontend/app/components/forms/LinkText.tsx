import React from 'react';
import { YStack, XStack, Text } from 'tamagui';

interface LinkTextProps {
  normalText: string;
  linkText: string;
  onLinkPress?: () => void;
}

export const LinkText: React.FC<LinkTextProps> = ({ normalText, linkText, onLinkPress }) => {
  return (
    <YStack items="center" gap="$2">
      <XStack width={146} style={{ justifyContent: 'center' }}>
        <Text
          fontSize={14}
          fontWeight="normal"
          style={{
            fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif',
            textAlign: 'center',
          }}
        >
          <Text color="#374151">{normalText}</Text>
          <Text
            color="#FFAD31"
            onPress={onLinkPress}
            style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
          >
            {linkText}
          </Text>
        </Text>
      </XStack>
    </YStack>
  );
};

export default LinkText;
