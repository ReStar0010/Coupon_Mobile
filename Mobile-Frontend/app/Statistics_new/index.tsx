import React, { useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { AlignJustify } from 'lucide-react-native';
import GoalCard from './components/GoalCard';
import StatCard from './components/StatCard';
import ListItem from './components/ListItem';
import GoalModal from './components/GoalModal';
import Toast from './components/Toast';

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

const Statistics_new: React.FC = () => {
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Mock data
  const usageCount = 123;
  const totalSaved = 456;
  const transactionHistory = [
    { id: '1', store: '政大茶亭一店', date: '2024/07/14 14:15' },
    { id: '2', store: '政大茶亭一店', date: '2024/07/14 14:15' },
  ];

  const handleSetGoal = (name: string, amount: number) => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      name,
      targetAmount: amount,
      currentAmount: 25, // Mock current progress
    };
    setCurrentGoal(newGoal);
    setIsModalVisible(false);
    setShowToast(true);
    
    // Hide toast after 3 seconds
    setTimeout(() => setShowToast(false), 3000);
  };

  const openModal = () => {
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-login-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-8">
        <Text className="text-[30px] font-extrabold leading-[37.5px] text-login-gray">
          成就列表
        </Text>
        <TouchableOpacity>
          <AlignJustify size={24} color="#333333" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 pt-3 pb-20" showsVerticalScrollIndicator={false}>
        {/* Goal Card */}
        <GoalCard
          goal={currentGoal}
          onSetGoal={openModal}
        />

        {/* List Items */}
        <View className="mt-3">
          <View className="rounded-[5px] border border-white bg-login-bg">
            {transactionHistory.map((item, index) => (
              <ListItem
                key={item.id}
                store={item.store}
                date={item.date}
                isLast={index === transactionHistory.length - 1}
              />
            ))}
            <ListItem
              store="使用紀錄"
              icon="list"
              hasChevron
              isLast={true}
            />
          </View>
        </View>

        {/* Statistics Cards */}
        <View className="mt-3 flex-row gap-3">
          <StatCard
            title="酷胖使用張數"
            value={usageCount.toString()}
          />
          <StatCard
            title="節省總金額 (元)"
            value={totalSaved.toString()}
          />
        </View>
      </ScrollView> 

      {/* Goal Modal */}
      <GoalModal
        visible={isModalVisible}
        onClose={closeModal}
        onSave={handleSetGoal}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message="目標設定成功"
        onHide={() => setShowToast(false)}
      />
    </SafeAreaView>
  );
};

export default Statistics_new;
