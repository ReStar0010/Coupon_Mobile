import React from 'react';
import { TouchableOpacity } from 'react-native';
import { List, ChevronRight } from 'lucide-react-native';
import { YStack, XStack, Text } from 'tamagui';

interface ListItemProps {
  store?: string;
  date?: string;
  icon?: 'list';
  hasChevron?: boolean;
  isLast?: boolean;
  onPress?: () => void;
}

const ListItem: React.FC<ListItemProps> = ({ 
  store, 
  date, 
  icon, 
  hasChevron = false, 
  isLast = false,
  onPress 
}) => {
  const content = (
    <XStack
      items="center"
      style={{ 
        justifyContent: 'space-between',
        borderWidth: 1, 
        borderColor: '#e0e0e0', 
        borderBottomWidth: !isLast ? 0 : 1 
      }}
      bg="#f5f5f5"
      p="$3"
    >
      <XStack flex={1} items="center" gap="$1">
        {icon === 'list' && (
          <List size={24} color="#333333" />
        )}

        <YStack flex={1} gap="$1">
          <Text fontSize={13} fontWeight="normal" color="#333333">
            {store}
          </Text>
          {date && (
            <Text fontSize={12} fontWeight="normal" color="#707070">
              {date}
            </Text>
          )}
        </YStack>
      </XStack>

      {hasChevron && (
        <ChevronRight size={20} color="#333333" />
      )}
    </XStack>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default ListItem;
