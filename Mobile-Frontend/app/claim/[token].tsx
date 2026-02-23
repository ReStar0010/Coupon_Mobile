import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ClaimRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={`/(tabs)/easyuse/qr-claim?token=${token}`} />;
}
