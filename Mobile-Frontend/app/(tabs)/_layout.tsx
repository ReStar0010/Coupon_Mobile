// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: "#2f95dc",
        tabBarInactiveTintColor: "gray",
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, string> = {
            tab1: focused ? "home" : "home-outline",
            tab2: focused ? "search" : "search-outline",
            tab3: focused ? "person" : "person-outline",
          };
          return <Ionicons name={map[route.name] as any} size={size} color={color} />;
        },
        tabBarStyle: { height: 120 },
      })}
    >
      <Tabs.Screen name="tab1/index" options={{ title: "Tab1" }} />
      <Tabs.Screen name="tab2/index" options={{ title: "Tab2" }} />
      <Tabs.Screen name="tab3/index" options={{ title: "Tab3" }} />
    </Tabs>
  );
}
