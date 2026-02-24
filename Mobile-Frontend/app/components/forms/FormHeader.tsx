import React from 'react';
import { YStack, H1 } from 'tamagui';

interface FormHeaderProps {
  title?: string;
}

export const FormHeader: React.FC<FormHeaderProps> = ({ title }) => {
  return (
    <YStack items="center">
      <H1
        fontSize={30}
        fontWeight="800"
        color="#374151"
        lineHeight={37.5}
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
      >
        {title}
      </H1>
    </YStack>
  );
};

export default FormHeader;
