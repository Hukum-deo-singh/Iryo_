import { Tabs } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/context/PrefsContext';
import { fx } from '@/services/feedback';

export default function TabsLayout() {
  const theme = useTheme();
  const tap = { tabPress: () => fx.tap() };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 66, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tap}
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Icon name="pulse" color={color} /> }}
      />
      <Tabs.Screen
        name="device"
        listeners={tap}
        options={{ title: 'Device', tabBarIcon: ({ color }) => <Icon name="device" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        listeners={tap}
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon name="user" color={color} /> }}
      />
    </Tabs>
  );
}
