import { FunctionComponent } from "react";
import { View } from "react-native";

export type SplitLineType = {
  className?: string;
};

const SplitLine: FunctionComponent<SplitLineType> = ({ className = "" }) => {
  return <View className={`h-px flex-1 relative bg-mid ${className}`}> </View>;
};

export default SplitLine;
