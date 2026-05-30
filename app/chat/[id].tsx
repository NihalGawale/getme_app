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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useFocusEffect } from "expo-router";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import Avatar from "../../components/ui/Avatar";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { Icons } from "../../constants/Icons";

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

  useFocusEffect(
    useCallback(() => {
      if (id && user?.id) {
        markMessagesRead();
      }
    }, [id, user?.id]),
  );

  useEffect(() => {
    if (id && user) {
      fetchMessages();
      fetchOtherUser();
      markMessagesRead();
      const unsub = subscribeToMessages();
      const poll = setInterval(fetchMessages, 3000);
      return () => {
        unsub();
        clearInterval(poll);
      };
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
    const { data } = await supabase
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
    if (!user?.id || !id) return;
    console.log('Marking messages as read for conversation:', id);
    const { data, error } = await supabase
      .rpc('mark_messages_read', {
        p_conversation_id: id,
        p_user_id: user.id,
      });
    console.log('Marked read result:', data, 'messages updated, error:', error?.message);
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

  if (loading) {
    return <LoadingScreen />;
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
          <Text style={s.backIcon}>{Icons.back}</Text>
        </TouchableOpacity>
        <View style={s.headerUser}>
          <Avatar
            name={otherUser?.name}
            uri={otherUser?.avatar_url}
            size="sm"
          />
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
            placeholderTextColor={Colors.grey300}
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
            <Text style={s.sendBtnText}>{Icons.send}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.grey100,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: FontSize.xl, color: Colors.black },
  headerUser: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  headerName: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.black,
  },

  // Messages
  messagesList: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey300,
  },

  msgRow: { alignItems: "flex-start", marginBottom: Spacing.xs },
  msgRowMe: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
  },
  bubbleMe: { backgroundColor: Colors.black, borderBottomRightRadius: Radius.xs },
  bubbleThem: { backgroundColor: Colors.grey100, borderBottomLeftRadius: Radius.xs },
  bubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: 20,
  },
  bubbleTextMe: { color: Colors.white },
  msgTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey300,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  msgTimeMe: { textAlign: "right" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: Colors.grey100,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    fontSize: FontSize.base,
    color: Colors.black,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: Colors.black,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: {
    fontSize: 18,
    color: Colors.white,
    fontFamily: FontFamily.medium,
  },
});
