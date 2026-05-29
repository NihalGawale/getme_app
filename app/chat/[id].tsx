import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
};

type OtherUser = {
  name: string;
  avatar_url: string | null;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchMessages();
      fetchOtherUser();
      markMessagesRead();
      const unsub = subscribeToMessages();
      return unsub;
    }
  }, [id, user]);

  const fetchOtherUser = async () => {
    const { data: convo } = await supabase
      .from("conversations")
      .select("freelancer_id, client_id")
      .eq("id", id)
      .single();

    if (!convo || !user) return;

    const otherUserId =
      convo.client_id === user.id ? convo.freelancer_id : convo.client_id;

    const { data } = await supabase
      .from("users")
      .select("name, avatar_url")
      .eq("id", otherUserId)
      .single();

    if (data) setOtherUser(data);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          markMessagesRead();
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100,
          );
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const markMessagesRead = async () => {
    if (!user) return;
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", id)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !user || sending) return;

    setSending(true);
    setInput("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
    });

    // Update last_message_at on conversation
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", id);

    setSending(false);

    if (error) {
      console.log("Send error:", error.message);
      setInput(content);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.headerUser}>
          {otherUser?.avatar_url ? (
            <Image
              source={{ uri: otherUser.avatar_url }}
              style={s.headerAvatar}
            />
          ) : (
            <View style={s.headerAvatarFallback}>
              <Text style={s.headerAvatarText}>
                {getInitials(otherUser?.name ?? "")}
              </Text>
            </View>
          )}
          <Text style={s.headerName}>{otherUser?.name ?? "Chat"}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>Say hello to start the conversation</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id;
          return (
            <View style={[s.msgRow, isMe && s.msgRowMe]}>
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>
                  {item.content}
                </Text>
              </View>
              <Text style={[s.msgTime, isMe && s.msgTimeMe]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor="#D0D0D0"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            activeOpacity={0.85}
            disabled={!input.trim() || sending}
          >
            <Text style={s.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 20, color: "#111" },
  headerUser: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 12, fontWeight: "500", color: "#111" },
  headerName: { fontSize: 15, fontWeight: "500", color: "#111" },

  // Messages
  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: { fontSize: 13, color: "#D0D0D0" },

  msgRow: { alignItems: "flex-start", marginBottom: 4 },
  msgRowMe: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: { backgroundColor: "#111", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#F4F4F4", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: "#111", lineHeight: 20 },
  bubbleTextMe: { color: "#fff" },
  msgTime: {
    fontSize: 10,
    color: "#D0D0D0",
    marginTop: 2,
    paddingHorizontal: 2,
  },
  msgTimeMe: { textAlign: "right" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F4F4F4",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#111",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { fontSize: 18, color: "#fff", fontWeight: "500" },
});
