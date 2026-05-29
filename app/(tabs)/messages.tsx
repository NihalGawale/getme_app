import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

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
      if (user) fetchConversations();
    }, [user]),
  );

  useEffect(() => {
    if (user) {
      const cleanup = subscribeToMessages();
      return () => { cleanup(); };
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

    // Enrich each conversation
    const enriched = await Promise.all(
      data.map(async (convo) => {
        const otherUserId =
          convo.client_id === user.id ? convo.freelancer_id : convo.client_id;

        // Get other user details
        const { data: otherUser } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", otherUserId)
          .single();

        // Get last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", convo.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Get unread count
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

    return () => { supabase.removeChannel(subscription); };
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
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
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.convoRow, item.unread_count > 0 && s.convoRowUnread]}
            onPress={() => router.push(`/chat/${item.id}`)}
            activeOpacity={0.85}
          >
            {/* Avatar */}
            {item.other_user.avatar_url ? (
              <Image
                source={{ uri: item.other_user.avatar_url }}
                style={s.avatar}
              />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarText}>
                  {getInitials(item.other_user.name)}
                </Text>
              </View>
            )}

            {/* Content */}
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
  container: { flex: 1, backgroundColor: "#fff" },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  title: { fontSize: 20, fontWeight: "500", color: "#111" },
  listContent: { paddingTop: 8 },
  emptyContainer: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: "#111" },
  emptyText: {
    fontSize: 13,
    color: "#6B6B68",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  convoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F8F8F8",
  },
  convoRowUnread: { backgroundColor: "#FAFAFA" },
  avatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F4F4F4",
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: "500", color: "#111" },
  convoContent: { flex: 1, gap: 4 },
  convoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoName: { fontSize: 14, fontWeight: "400", color: "#111" },
  convoNameUnread: { fontWeight: "500" },
  convoTime: { fontSize: 11, color: "#6B6B68" },
  convoBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convoLastMsg: { fontSize: 13, color: "#6B6B68", flex: 1 },
  convoLastMsgUnread: { color: "#111" },
  unreadBadge: {
    backgroundColor: "#111",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadCount: { fontSize: 11, fontWeight: "500", color: "#fff" },
});
