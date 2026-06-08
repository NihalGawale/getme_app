import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { HouseIcon, ChatCircleIcon, UserIcon } from "phosphor-react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/Colors";
import { Radius } from "../../constants/Spacing";
import Ionicons from "@expo/vector-icons/Ionicons";

function TabIcon({
  icon,
  focused,
  badge,
}: {
  icon: "home" | "messages" | "profile";
  focused: boolean;
  badge?: number;
}) {
  const color = focused ? Colors.green : Colors.grey400;
  const weight = focused ? "fill" : "light";

  const renderIcon = () => {
    switch (icon) {
      case "home":
        return <HouseIcon size={26} color={color} weight={weight} />;
      case "messages":
        return (
          <Ionicons
            name="chatbubbles-sharp"
            size={26}
            color={color}
            weight={weight}
          />
        );
      case "profile":
        return (
          <Ionicons
            name="person-circle"
            size={26}
            color={color}
            weight={weight}
          />
        );
    }
  };

  return (
    <View style={s.tabItem}>
      <View>
        {renderIcon()}
        {badge && badge > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>
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

      const poll = setInterval(fetchUnreadCount, 5000);

      return () => {
        unsub();
        clearInterval(poll);
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user?.id) return;

    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

    if (!convos || convos.length === 0) {
      setUnreadCount(0);
      return;
    }

    const convoIds = convos.map((c) => c.id);

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convoIds)
      .eq("is_read", false)
      .neq("sender_id", user.id);

    console.log("Unread count:", count, "error:", error?.message);
    setUnreadCount(count ?? 0);
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel("tab-unread-count")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnreadCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
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
            <TabIcon icon="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="messages" focused={focused} badge={unreadCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="profile" focused={focused} />
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
    backgroundColor: Colors.white,
    height: 88,
    paddingBottom: 28,
    paddingTop: 10,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: Colors.danger,
    borderRadius: Radius.full,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    color: Colors.white,
    fontWeight: "500",
  },
});
