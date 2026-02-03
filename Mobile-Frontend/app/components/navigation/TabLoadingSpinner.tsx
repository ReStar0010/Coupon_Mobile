import { Spinner, YStack } from 'tamagui';

export function TabLoadingSpinner() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" bg="$background">
      <Spinner size="large" color="#ffad31" />
    </YStack>
  );
}

export default TabLoadingSpinner;
