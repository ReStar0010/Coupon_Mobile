import React from 'react';
import { View, TextInput, TouchableOpacity, Image } from 'react-native';

export type SearchBarType = {
  className?: string;
  value: string;
  onChange: (text: string) => void;
  onClear?: () => void;
};

const SearchBar: React.FC<SearchBarType> = ({ className = '', value, onChange, onClear }) => {
  return (
    <View
      className={`bg-bg-white box-border flex max-w-full flex-row items-center justify-start gap-1 self-stretch rounded-xl px-2.5 pb-[7px] pt-2 shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${className}`}
    >
      <Image
        className="relative z-[1] h-5 min-h-[20px] w-5 object-cover"
        style={{ width: 20, height: 20 }}
        source={require('../../assets/search.png')}
      />
      <TextInput
        className="text-sec-black font-jost flex-1 bg-transparent px-2 py-1 text-base"
        placeholder="輸入想尋找的酷胖"
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value && onClear && (
        <TouchableOpacity
          className="z-[1] flex h-5 w-5 items-center justify-center text-gray-500"
          onPress={onClear}
          activeOpacity={0.7}
        >
          <View className="h-4 w-4 items-center justify-center">
            <View className="absolute h-0.5 w-3 rotate-45 bg-gray-500" />
            <View className="absolute h-0.5 w-3 -rotate-45 bg-gray-500" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;
