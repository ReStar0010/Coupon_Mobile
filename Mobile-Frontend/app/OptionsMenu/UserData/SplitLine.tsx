import { FunctionComponent } from 'react';
import { View } from 'react-native';

export type SplitLineType = {
  className?: string;
};

const SplitLine: FunctionComponent<SplitLineType> = ({ className = '' }) => {
  return <View className={`bg-mid relative h-px flex-1 ${className}`}> </View>;
};

export default SplitLine;
