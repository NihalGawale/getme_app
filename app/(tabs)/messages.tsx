import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";
import FeatherIcon from "../../components/ui/FeatherIcon";

type Conversation = {
  id: string;
  freelancer_id: string;
  client_id: string;
  last_message_at: string;
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  last_message: string | null;
  unread_count: number;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log("Messages tab focused - refetching conversations");
        fetchConversations();
      }
    }, [user?.id]),
  );

  useEffect(() => {
    if (user) {
      const cleanup = subscribeToMessages();
      return () => {
        cleanup();
      };
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        freelancer_id,
        client_id,
        last_message_at
      `,
      )
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      data.map(async (convo) => {
        const otherUserId =
          convo.client_id === user.id ? convo.freelancer_id : convo.client_id;

        const { data: otherUser } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", otherUserId)
          .single();

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .eq("is_read", false)
          .neq("sender_id", user.id);

        return {
          ...convo,
          other_user: otherUser ?? {
            id: otherUserId,
            name: "Unknown",
            avatar_url: null,
          },
          last_message: lastMsg?.content ?? null,
          unread_count: count ?? 0,
        };
      }),
    );

    setConversations(enriched);
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel("inbox-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
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
          fetchConversations();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m`;
    if (hours < 24) return `${Math.floor(hours)}h`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          conversations.length === 0 ? s.emptyContainer : s.listContent
        }
        showsVerticalScrollIndicator={false}
        onRefresh={fetchConversations}
        refreshing={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptyText}>
              Find a freelancer and start a conversation
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push("/(tabs)/")}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>Browse freelancers →</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.convoRow, item.unread_count > 0 && s.convoRowUnread]}
            onPress={() => router.push(`/chat/${item.id}`)}
            activeOpacity={0.85}
          >
            <Avatar
              name={item.other_user.name}
              uri={item.other_user.avatar_url}
              size="lg"
            />

            <View style={s.convoContent}>
              <View style={s.convoTopRow}>
                <Text
                  style={[
                    s.convoName,
                    item.unread_count > 0 && s.convoNameUnread,
                  ]}
                >
                  {item.other_user.name}
                </Text>
                <Text style={s.convoTime}>
                  {formatTime(item.last_message_at)}
                </Text>
              </View>
              <View style={s.convoBottomRow}>
                <Text
                  style={[
                    s.convoLastMsg,
                    item.unread_count > 0 && s.convoLastMsgUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.last_message ?? "No messages yet"}
                </Text>
                {item.unread_count > 0 && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadCount}>
                      {item.unread_count > 9 ? "9+" : item.unread_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
  },
  listContent: { paddingTop: Spacing.sm, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenPadding,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: "center",
    lineHeight: FontSize.md * 1.6,
  },
  emptyBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  emptyBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  convoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.offWhite,
  },
  convoRowUnread: { backgroundColor: Colors.offWhite },
  convoContent: { flex: 1, gap: Spacing.xs },
  convoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  convoNameUnread: { fontFamily: FontFamily.medium },
  convoTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  convoBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoLastMsg: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    flex: 1,
  },
  convoLastMsgUnread: { color: Colors.black },
  unreadBadge: {
    backgroundColor: Colors.black,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadCount: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
