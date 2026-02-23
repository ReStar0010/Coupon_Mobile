import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CollectionRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={`/(tabs)/collection?token=${token}`} />;
}
