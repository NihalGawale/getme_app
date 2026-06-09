import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Feather, AntDesign } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import Avatar from "../../components/ui/Avatar";
import LoadingScreen from "../../components/ui/LoadingScreen";

type Skill = { id: string; name: string; icon: string };
type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
};
type OtherUser = { name: string; avatar_url: string | null };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Other user
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);

  // Refs — synchronous, no stale closure issues
  const isClientRef = useRef(false);
  const freelancerUserIdRef = useRef<string | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const freelancerSkillsRef = useRef<Skill[]>([]);
  const freelancerNameRef = useRef<string>("");
  const pendingSkillIdsRef = useRef<string[]>([]);
  const activeJobIdRef = useRef<string | null>(null);

  // State for UI rendering
  const [isClient, setIsClient] = useState(false);
  const [freelancerSkills, setFreelancerSkills] = useState<Skill[]>([]);
  const [freelancerName, setFreelancerName] = useState("");
  const [jobConfirmed, setJobConfirmed] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Modals
  const [showHireModal, setShowHireModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<"hire" | "complete">(
    "hire",
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [pendingSkillIds, setPendingSkillIds] = useState<string[]>([]);
  const confettiRef = useRef<any>(null);

  // Refresh job status every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (id && user?.id) {
        markMessagesRead();
        checkJobConfirmed();
      }

      // When screen loses focus — messages were read
      return () => {
        markMessagesRead();
      };
    }, [id, user?.id]),
  );

  // Init on mount
  useEffect(() => {
    if (id && user) {
      initChat();
      const unsub = subscribeToMessages();
      const poll = setInterval(fetchMessages, 3000);
      return () => {
        unsub();
        clearInterval(poll);
      };
    }
  }, [id, user?.id]);

  const initChat = async () => {
    try {
      await fetchMessages();
      await fetchOtherUser();
      await checkJobConfirmed();
      markMessagesRead();
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherUser = async () => {
    if (!user || !id) return;

    const { data: convo, error } = await supabase
      .from("conversations")
      .select("freelancer_id, client_id, job_confirmed")
      .eq("id", id)
      .single();

    console.log("Conversation:", convo, error?.message);
    if (!convo) return;

    // Set refs synchronously first
    const currentUserIsClient = convo.client_id === user.id;
    isClientRef.current = currentUserIsClient;
    freelancerUserIdRef.current = convo.freelancer_id;
    clientIdRef.current = convo.client_id;

    // Set state for UI
    setIsClient(currentUserIsClient);

    // Get other user
    const otherId = currentUserIsClient ? convo.freelancer_id : convo.client_id;

    const { data: otherUserData } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .eq("id", otherId)
      .single();

    if (otherUserData) {
      setOtherUser(otherUserData);
      if (currentUserIsClient) {
        freelancerNameRef.current = otherUserData.name ?? "";
        setFreelancerName(otherUserData.name ?? "");
      }
    }

    // Fetch freelancer skills if current user is client
    if (currentUserIsClient) {
      const { data: fpData } = await supabase
        .from("freelancer_profiles")
        .select("skills")
        .eq("user_id", convo.freelancer_id)
        .single();

      if (fpData?.skills?.length) {
        const { data: skillsData } = await supabase
          .from("skills")
          .select("id, name, icon")
          .in("id", fpData.skills);
        if (skillsData) {
          freelancerSkillsRef.current = skillsData;
          setFreelancerSkills(skillsData);
        }
      }
    }
  };

  const checkJobConfirmed = async () => {
    if (!id) return;

    const { data } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log("Job check:", data);

    if (!data) {
      setJobConfirmed(false);
      setActiveJobId(null);
      activeJobIdRef.current = null;
      return;
    }

    const isActive = data.status === "active" || data.status === null;
    setJobConfirmed(isActive);
    setActiveJobId(isActive ? data.id : null);
    activeJobIdRef.current = isActive ? data.id : null;
  };

  // ── Hire flow ─────────────────────────────────────────

  const handleHire = () => {
    const skills = freelancerSkillsRef.current;
    const fId = freelancerUserIdRef.current;

    console.log("handleHire — skills:", skills);
    console.log("handleHire — freelancerId:", fId);

    if (!user || !fId) {
      Alert.alert(
        "Error",
        "Could not identify the freelancer. Please try again.",
      );
      return;
    }

    if (skills.length > 1) {
      // Multiple skills — show skill selector first
      setSelectedSkills([]);
      setShowHireModal(true);
      return;
    }

    // Single skill or no skills — go straight to confirm modal
    const skillIds = skills.length === 1 ? [skills[0].id] : [];
    pendingSkillIdsRef.current = skillIds;
    setPendingSkillIds(skillIds);
    setConfirmModalType("hire");
    setShowConfirmModal(true);
  };

  const handleSkillSelectorConfirm = () => {
    // Store selected skills in ref AND state
    pendingSkillIdsRef.current = selectedSkills;
    setPendingSkillIds(selectedSkills);
    setShowHireModal(false);
    setConfirmModalType("hire");
    setShowConfirmModal(true);
  };

  const confirmJob = async () => {
    setShowConfirmModal(false);

    // Always read from ref — guaranteed up to date
    const skillIds = pendingSkillIdsRef.current;
    const freelancerId = freelancerUserIdRef.current;

    console.log("confirmJob — skillIds:", skillIds);
    console.log("confirmJob — freelancerId:", freelancerId);
    console.log("confirmJob — userId:", user?.id);

    if (!freelancerId || !user?.id) {
      Alert.alert("Error", "Missing required information.");
      return;
    }

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .insert({
        conversation_id: id,
        client_id: user.id,
        freelancer_id: freelancerId,
        skills: skillIds,
        status: "active",
      })
      .select()
      .single();

    console.log("Job insert:", jobData, jobError?.message);

    if (jobError) {
      Alert.alert("Error", jobError.message);
      return;
    }

    // Update conversation
    await supabase
      .from("conversations")
      .update({ job_confirmed: true })
      .eq("id", id);

    // Send system message
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content: "🎉 Job confirmed on GetMe!",
      is_read: false,
    });

    // Update local state
    setJobConfirmed(true);
    setActiveJobId(jobData.id);
    activeJobIdRef.current = jobData.id;
    setShowCongrats(true);

    setTimeout(() => {
      confettiRef.current?.start();
    }, 100);
  };

  // ── Mark complete flow ────────────────────────────────

  const handleMarkComplete = () => {
    setConfirmModalType("complete");
    setShowConfirmModal(true);
  };

  const markJobComplete = async () => {
    setShowConfirmModal(false);

    const jobId = activeJobIdRef.current;
    console.log("markJobComplete — jobId:", jobId);

    if (!jobId || !user) {
      Alert.alert("Error", "No active job found.");
      return;
    }

    const { error } = await supabase
      .from("jobs")
      .update({ status: "completed" })
      .eq("id", jobId);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    // Send system message
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content: "✅ Job marked as complete by the freelancer.",
      is_read: false,
    });

    // Update conversation
    await supabase
      .from("conversations")
      .update({
        job_confirmed: false,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Reset local state
    setJobConfirmed(false);
    setActiveJobId(null);
    activeJobIdRef.current = null;

    Alert.alert(
      "Job Complete! 🎉",
      "The client has been notified. They can hire you again anytime.",
    );
  };

  // ── Messages ──────────────────────────────────────────

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
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
          const newMsg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
          );
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

  // ── Helpers ───────────────────────────────────────────

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const formatDateSeparator = (timestamp: string): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const isDifferentDay = (d1: string, d2: string) =>
    new Date(d1).toDateString() !== new Date(d2).toDateString();

  const getSkillName = (skillId: string) =>
    freelancerSkillsRef.current.find((s) => s.id === skillId)?.name ?? "";

  // ── Render ────────────────────────────────────────────

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={Colors.black} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.headerUser}
          onPress={() => {
            if (!otherUser) return;
            if (isClientRef.current) {
              router.push(`/freelancer/${freelancerUserIdRef.current}`);
            } else {
              router.push(`/client/${clientIdRef.current}`);
            }
          }}
          activeOpacity={0.7}
        >
          <Avatar
            uri={otherUser?.avatar_url}
            name={otherUser?.name}
            size="sm"
          />
          <Text style={s.headerName}>{otherUser?.name ?? "Loading..."}</Text>
        </TouchableOpacity>

        {/* Client — Hire / In Progress */}
        {isClient ? (
          <TouchableOpacity
            style={[s.hireBtn, jobConfirmed && s.hireBtnInProgress]}
            onPress={handleHire}
            activeOpacity={0.8}
            disabled={jobConfirmed}
          >
            <Text
              style={[s.hireBtnText, jobConfirmed && s.hireBtnTextInProgress]}
            >
              {jobConfirmed ? "⏳ In Progress" : "Hire"}
            </Text>
          </TouchableOpacity>
        ) : /* Freelancer — Mark complete */
        jobConfirmed ? (
          <TouchableOpacity
            style={s.completeBtn}
            onPress={handleMarkComplete}
            activeOpacity={0.8}
          >
            <Text style={s.completeBtnText}>Mark complete</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 100 }} />
        )}
      </View>

      {/* ── Messages ── */}
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
        renderItem={({ item, index }) => {
          const showDate =
            index === 0 ||
            isDifferentDay(messages[index - 1].created_at, item.created_at);
          const isMe = item.sender_id === user?.id;
          return (
            <View>
              {showDate && (
                <View style={s.dateSeparator}>
                  <View style={s.dateLine} />
                  <Text style={s.dateText}>
                    {formatDateSeparator(item.created_at)}
                  </Text>
                  <View style={s.dateLine} />
                </View>
              )}
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
            </View>
          );
        }}
      />

      {/* ── Input bar ── */}
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
            <AntDesign name="send" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Skill selector modal ── */}
      <Modal
        visible={showHireModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHireModal(false)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowHireModal(false)}
        />
        <View style={s.hireSheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>
            What are you hiring {freelancerName} for?
          </Text>
          <Text style={s.sheetSub}>Select all that apply</Text>
          <View style={s.skillGrid}>
            {freelancerSkills.map((skill) => (
              <TouchableOpacity
                key={skill.id}
                style={[
                  s.skillTile,
                  selectedSkills.includes(skill.id) && s.skillTileSelected,
                ]}
                onPress={() =>
                  setSelectedSkills((prev) =>
                    prev.includes(skill.id)
                      ? prev.filter((s) => s !== skill.id)
                      : [...prev, skill.id],
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={s.skillIcon}>{skill.icon}</Text>
                <Text
                  style={[
                    s.skillName,
                    selectedSkills.includes(skill.id) && s.skillNameSelected,
                  ]}
                >
                  {skill.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[
              s.confirmActionBtn,
              selectedSkills.length === 0 && s.confirmBtnDisabled,
            ]}
            onPress={handleSkillSelectorConfirm}
            activeOpacity={0.85}
            disabled={selectedSkills.length === 0}
          >
            <Text style={s.confirmActionText}>Next</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Confirm modal (hire + complete) ── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            {confirmModalType === "hire" ? (
              <>
                <Text style={s.confirmEmoji}>🤝</Text>
                <Text style={s.confirmTitle}>Confirm hire?</Text>
                <Text style={s.confirmSub}>
                  {`You're about to hire ${freelancerName}`}
                  {pendingSkillIdsRef.current.length > 0
                    ? ` for ${pendingSkillIdsRef.current
                        .map(getSkillName)
                        .filter(Boolean)
                        .join(", ")}`
                    : ""}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.confirmEmoji}>✅</Text>
                <Text style={s.confirmTitle}>Mark as complete?</Text>
                <Text style={s.confirmSub}>
                  This will notify the client that the job is done. They'll be
                  able to hire you again.
                </Text>
              </>
            )}
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmActionBtn}
                onPress={
                  confirmModalType === "hire" ? confirmJob : markJobComplete
                }
                activeOpacity={0.85}
              >
                <Text style={s.confirmActionText}>
                  {confirmModalType === "hire" ? "Confirm" : "Mark complete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Congratulations modal ── */}
      <Modal
        visible={showCongrats}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCongrats(false)}
      >
        <View style={s.congratsOverlay}>
          <ConfettiCannon
            ref={confettiRef}
            count={120}
            origin={{
              x: Dimensions.get("window").width / 2,
              y: 0,
            }}
            autoStart={false}
            fadeOut={true}
            colors={["#1D9E75", "#111111", "#FFFFFF", "#0F6E56", "#E1F5EE"]}
          />
          <View style={s.congratsCard}>
            <Text style={s.congratsEmoji}>🎉</Text>
            <Text style={s.congratsTitle}>You hired {freelancerName}!</Text>
            <Text style={s.congratsSub}>
              This job has been confirmed on GetMe. Good luck with the project!
            </Text>
            <TouchableOpacity
              style={s.congratsBtn}
              onPress={() => setShowCongrats(false)}
              activeOpacity={0.85}
            >
              <Text style={s.congratsBtnText}>Back to chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  headerName: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.black,
    flex: 1,
  },

  // Hire button
  hireBtn: {
    backgroundColor: Colors.green,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    minWidth: 70,
    alignItems: "center",
  },
  hireBtnInProgress: {
    backgroundColor: Colors.grey200,
  },
  hireBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  hireBtnTextInProgress: {
    color: Colors.grey500,
  },

  // Mark complete button
  completeBtn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    minWidth: 100,
    alignItems: "center",
  },
  completeBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.white,
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
  bubbleMe: {
    backgroundColor: Colors.green,
    borderBottomRightRadius: Radius.xs,
  },
  bubbleThem: {
    backgroundColor: Colors.grey100,
    borderBottomLeftRadius: Radius.xs,
  },
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

  // Date separators
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  dateLine: { flex: 1, height: 0.5, backgroundColor: Colors.grey200 },
  dateText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
    paddingHorizontal: Spacing.sm,
  },

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
    paddingLeft: 3,
  },
  sendBtnDisabled: { opacity: 0.3 },

  // Overlay
  overlay: { flex: 1, backgroundColor: Colors.overlay },

  // Skill selector sheet
  hireSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  sheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  sheetSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    marginBottom: Spacing.xl,
  },
  skillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  skillTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
  },
  skillTileSelected: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  skillIcon: { fontSize: 16 },
  skillName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  skillNameSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.black,
  },
  confirmBtnDisabled: { opacity: 0.4 },

  // Confirm modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  confirmCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxxl,
    alignItems: "center",
    width: "100%",
    gap: Spacing.sm,
  },
  confirmEmoji: { fontSize: 44, marginBottom: Spacing.xs },
  confirmTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    textAlign: "center",
  },
  confirmSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: "center",
    lineHeight: FontSize.md * 1.6,
    marginBottom: Spacing.sm,
  },
  confirmBtns: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
    marginTop: Spacing.sm,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.grey500,
  },
  confirmActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  // Congrats modal
  congratsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  congratsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxxl,
    alignItems: "center",
    width: "100%",
    gap: Spacing.sm,
  },
  congratsEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  congratsTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    textAlign: "center",
  },
  congratsSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: "center",
    lineHeight: FontSize.md * 1.6,
    marginBottom: Spacing.lg,
  },
  congratsBtn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  congratsBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
