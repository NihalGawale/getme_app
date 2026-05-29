import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

function TabIcon({
  icon,
  label,
  focused,
  badge,
}: {
  icon: string;
  label: string;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={s.tabItem}>
      <View>
        <Text style={[s.tabIcon, focused && s.tabIconActive]}>{icon}</Text>
        {badge && badge > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.tabLabel, focused && s.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const unsub = subscribeToMessages();
      return () => {
        unsub?.();
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

    if (!convos?.length) {
      setUnreadCount(0);
      return;
    }

    const convoIds = convos.map((c) => c.id);

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convoIds)
      .eq("is_read", false)
      .neq("sender_id", user.id);

    setUnreadCount(count ?? 0);
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel("tab-unread-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCount();
        },
      )
      .subscribe();

    return () => subscription.unsubscribe();
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔍" label="Search" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon="💬"
              label="Messages"
              focused={focused}
              badge={unreadCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0.5,
    borderTopColor: "#E8E8E8",
    backgroundColor: "#fff",
    height: 64,
    paddingBottom: 0,
  },
  tabItem: { alignItems: "center", gap: 3, paddingTop: 8 },
  tabIcon: { fontSize: 20, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: "#6B6B68", fontWeight: "500" },
  tabLabelActive: { color: "#111" },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#E24B4A",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: "#fff", fontWeight: "500" },
});
