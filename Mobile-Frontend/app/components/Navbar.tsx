import React, { useCallback } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

export type NavbarType = {
  className?: string;
  atEasyUse?: boolean;
  atCollection?: boolean;
  atStatistics?: boolean;
};

const Navbar: React.FC<NavbarType> = ({
  className = '',
  atEasyUse,
  atCollection,
  atStatistics,
}) => {
  const router = useRouter();

  const onEasyUseClick = useCallback(() => {
    router.push('/EasyUse');
  }, [router]);

  const onCollectionClick = useCallback(() => {
    router.push('/Collection');
  }, [router]);

  const onStatisticsClick = useCallback(() => {
    router.push('/Statistics');
  }, [router]);

  return (
    <View
      className={`relative h-[54px] self-stretch rounded-xl shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${className}`}>
      <View className="bg-bg-white absolute bottom-0 left-0 right-0 top-0 h-full w-full rounded-xl">
        {/* EasyUse Button */}
        <View
          className={`absolute left-[4%] top-[50%] h-[66%] w-[30%] rounded-xl ${
            atEasyUse ? 'bg-act-yellow' : ''
          } z-[1]`}
          style={{
            transform: [{ translateY: -18 }], // 50% of 54px height = 27px, 66% of 54px = 36px, so -18px
          }}>
          <TouchableOpacity
            className="absolute inset-0 m-auto h-[25px] w-[25px] items-center justify-center"
            onPress={onEasyUseClick}
            activeOpacity={0.7}>
            <Image
              className="h-[25px] w-[25px] object-cover"
              style={{ width: 25, height: 25 }}
              source={require('../../assets/home.png')}
            />
          </TouchableOpacity>
        </View>

        {/* Collection Button */}
        <View
          className={`absolute left-[50%] top-[50%] h-[66%] w-[30%] rounded-xl ${
            atCollection ? 'bg-act-yellow' : ''
          } z-[1]`}
          style={{
            transform: [{ translateX: -50 }, { translateY: -18 }], // 50% of width and height
          }}>
          <TouchableOpacity
            className="absolute inset-0 m-auto h-[25px] w-[25px] items-center justify-center"
            onPress={onCollectionClick}
            activeOpacity={0.7}>
            <Image
              className="h-[25px] w-[25px] object-cover"
              style={{ width: 25, height: 25 }}
              source={require('../../assets/product.png')}
            />
          </TouchableOpacity>
        </View>

        {/* Statistics Button */}
        <View
          className={`absolute right-[4%] top-[50%] h-[66%] w-[30%] rounded-xl ${
            atStatistics ? 'bg-act-yellow' : ''
          } z-[1]`}
          style={{
            transform: [{ translateY: -18 }],
          }}>
          <TouchableOpacity
            className="absolute inset-0 m-auto h-[25px] w-[25px] items-center justify-center"
            onPress={onStatisticsClick}
            activeOpacity={0.7}>
            <Image
              className="h-[25px] w-[25px] object-cover"
              style={{ width: 25, height: 25 }}
              source={require('../../assets/combo-chart.png')}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Navbar;
