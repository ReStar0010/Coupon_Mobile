import { Redirect } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.yellow} />
      </View>
    );
  }

  return isAuthenticated
    ? <Redirect href="/(tabs)/home" />
    : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
