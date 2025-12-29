import React from 'react';
import { Button, Text } from 'tamagui';

interface FormButtonProps {
  title: string;
  onPress?: () => void;
}

export const FormButton: React.FC<FormButtonProps> = ({ title, onPress }) => {
  return (
    <Button
      onPress={onPress}
      height={41}
      bg="#FFAD31"
      style={{ borderRadius: 9 }}
      borderWidth={0}
      pressStyle={{ bg: "#FF9500" }}
      hoverStyle={{ bg: "#FF9500" }}
    >
      <Text 
        fontSize={16}
        fontWeight="normal"
        color="#374151"
        style={{ fontFamily: 'Inter, -apple-system, Roboto, Helvetica, sans-serif' }}
      >
        {title}
      </Text>
    </Button>
  );
};

export default FormButton;

