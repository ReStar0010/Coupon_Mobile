import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { List, ChevronRight } from 'lucide-react-native';

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
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className={`flex-row items-center justify-between border border-login-border bg-login-bg p-[13px] ${!isLast ? 'border-b-0' : ''}`}
    >
      <View className="flex-1 flex-row items-center gap-[5px]">
        {icon === 'list' && (
          <List size={24} color="#333333" />
        )}

        <View className="flex-1 gap-[5px]">
          <Text className="text-[13px] font-normal leading-normal text-login-gray">
            {store}
          </Text>
          {date && (
            <Text className="text-[12px] font-normal leading-normal text-login-light-gray">
              {date}
            </Text>
          )}
        </View>
      </View>

      {hasChevron && (
        <ChevronRight size={20} color="#333333" />
      )}
    </Wrapper>
  );
};

export default ListItem;
