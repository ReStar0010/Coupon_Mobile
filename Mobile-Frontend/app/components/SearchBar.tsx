import React from "react";
import { View, TextInput, TouchableOpacity, Image } from "react-native";

export type SearchBarType = {
  className?: string;
  value: string;
  onChange: (text: string) => void;
  onClear?: () => void;
};

const SearchBar: React.FC<SearchBarType> = ({
  className = "",
  value,
  onChange,
  onClear,
}) => {
  return (
    <View
      className={`self-stretch shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex flex-row items-center justify-start pt-2 px-2.5 pb-[7px] box-border gap-1 max-w-full ${className}`}
    >
      <Image
        className="h-5 w-5 relative object-cover min-h-[20px] z-[1]"
        style={{ width: 20, height: 20 }}
        source={require("../../assets/search.png")}
      />
      <TextInput
        className="flex-1 bg-transparent text-base px-2 py-1 text-sec-black font-jost"
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
          className="h-5 w-5 flex items-center justify-center text-gray-500 z-[1]"
          onPress={onClear}
          activeOpacity={0.7}
        >
          <View className="w-4 h-4 items-center justify-center">
            <View className="w-3 h-0.5 bg-gray-500 absolute rotate-45" />
            <View className="w-3 h-0.5 bg-gray-500 absolute -rotate-45" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;
