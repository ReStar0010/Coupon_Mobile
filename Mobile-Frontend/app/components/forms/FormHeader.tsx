import React from 'react';
import { Platform } from 'react-native';
import { YStack, H1 } from 'tamagui';

interface FormHeaderProps {
  title?: string;
}

/** Android adds font padding and CJK metrics differ from iOS; tight lineHeight clips glyphs. */
const TITLE_FONT_SIZE = 30;
const TITLE_LINE_HEIGHT = Platform.OS === 'android' ? 42 : 37.5;

export const FormHeader: React.FC<FormHeaderProps> = ({ title }) => {
  return (
    <YStack items="center" width="100%">
      <H1
        fontSize={TITLE_FONT_SIZE}
        fontWeight="800"
        color="#374151"
        lineHeight={TITLE_LINE_HEIGHT}
        style={{
          fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif',
          textAlign: 'center',
          width: '100%',
          ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
        }}
      >
        {title}
      </H1>
    </YStack>
  );
};

export default FormHeader;
