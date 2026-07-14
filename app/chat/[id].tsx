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
  ScrollView,
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
import ConfirmModal from "../../components/ui/ConfirmModal";
import ReviewModal from "../../components/ReviewModal";

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
  const [hasReviewed, setHasReviewed] = useState(false);

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
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Options menu / report / block
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

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

  const REPORT_REASONS = [
    "Inappropriate messages",
    "Spam or scam",
    "Fake profile",
    "Harassment",
    "Did not show up / unprofessional",
    "Something else",
  ];

  // Shared "latest completed job" lookup used by review checks
  const fetchLatestCompletedJobId = async (): Promise<string | null> => {
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("conversation_id", id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return job?.id ?? null;
  };

  // Shared "other participant" lookup used by block/report actions
  const getOtherUserId = () =>
    isClientRef.current ? freelancerUserIdRef.current : clientIdRef.current;

  // Shared system-message insert used by hire/complete/review flows
  const sendSystemMessage = async (content: string) => {
    if (!user?.id) return;
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      content,
      is_read: false,
    });
  };

  const initChat = async () => {
    const checkExistingReview = async () => {
      if (!user?.id || !id) return;

      const jobId = await fetchLatestCompletedJobId();
      if (!jobId) return;

      // Check if review exists for this job
      const { data: review } = await supabase
        .from("reviews")
        .select("id")
        .eq("job_id", jobId)
        .eq("client_id", user.id)
        .single();

      setHasReviewed(!!review);
    };

    try {
      await fetchMessages();
      await fetchOtherUser();
      await checkIfBlocked();
      await checkJobConfirmed();
      await checkExistingReview();
      markMessagesRead();
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherUser = async () => {
    if (!user || !id) return;

    const { data: convo } = await supabase
      .from("conversations")
      .select("freelancer_id, client_id, job_confirmed")
      .eq("id", id)
      .single();

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

  const checkIfBlocked = async () => {
    if (!user?.id) return;
    const otherId = getOtherUserId();
    if (!otherId) return;

    const { data } = await supabase
      .from("blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_user_id", otherId)
      .maybeSingle();

    setIsBlocked(!!data);
  };

  // ── Hire flow ─────────────────────────────────────────

  const handleHire = () => {
    const skills = freelancerSkillsRef.current;
    const fId = freelancerUserIdRef.current;

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

  const confirmJob = async () => {
    setShowConfirmModal(false);

    // Always read from ref — guaranteed up to date
    const skillIds = pendingSkillIdsRef.current;
    const freelancerId = freelancerUserIdRef.current;

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

    if (jobError) {
      Alert.alert("Error", jobError.message);
      return;
    }

    // Update conversation
    await supabase
      .from("conversations")
      .update({ job_confirmed: true })
      .eq("id", id);

    await sendSystemMessage("🎉 Job confirmed on GetMe!");

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

    await sendSystemMessage("\u2705 Job marked as complete by the freelancer.");
    // Prompt client to leave a review
    await sendSystemMessage(
      "\u2B50 Job complete! How was working together? Leave a review.",
    );

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

  // ── Review ───────────────────────────────────────────

  const handleSubmitReview = async (vibes: string[], note: string) => {
    const jobId = await fetchLatestCompletedJobId();
    if (!jobId) throw new Error("No completed job found");

    const { error } = await supabase.from("reviews").insert({
      job_id: jobId,
      freelancer_id: freelancerUserIdRef.current,
      client_id: user!.id,
      vibes,
      note: note || null,
    });

    if (error) throw error;
    setHasReviewed(true);

    await sendSystemMessage("\u270D\uFE0F Review submitted. Thank you!");
  };

  // ── Report / Block ────────────────────────────────────

  const handleSubmitReport = async () => {
    if (!selectedReportReason || !user?.id) return;
    const otherId = getOtherUserId();
    if (!otherId) return;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: otherId,
      conversation_id: id,
      reason: selectedReportReason,
      details: reportDetails.trim() || null,
    });

    if (error) {
      Alert.alert("Error", "Could not submit report. Please try again.");
      return;
    }

    setShowReportModal(false);
    setSelectedReportReason(null);
    setReportDetails("");
    Alert.alert(
      "Report submitted",
      "Thank you. Our team will review this within 24 hours.",
    );
  };

  const handleBlock = async () => {
    if (!user?.id) return;
    const otherId = getOtherUserId();
    if (!otherId) return;

    const { error } = await supabase.from("blocks").insert({
      blocker_id: user.id,
      blocked_user_id: otherId,
    });

    if (error) {
      Alert.alert("Error", "Could not block this user. Please try again.");
      return;
    }

    setShowBlockConfirm(false);
    setIsBlocked(true);
    Alert.alert(
      "User blocked",
      "You will no longer see messages from this person.",
      [{ text: "OK", onPress: () => router.back() }],
    );
  };

  const handleUnblock = async () => {
    if (!user?.id) return;
    const otherId = getOtherUserId();
    if (!otherId) return;

    await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_user_id", otherId);

    setIsBlocked(false);
    Alert.alert("Unblocked", "You can now message each other again.");
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
      Alert.alert("Error", "Could not send message. Please try again.");
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
        ) : null}

        {/* 3-dots options menu */}
        <TouchableOpacity
          onPress={() => setShowOptionsMenu(true)}
          style={s.optionsBtn}
          activeOpacity={0.7}
        >
          <Feather name="more-vertical" size={20} color={Colors.black} />
        </TouchableOpacity>
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
              {item.content.startsWith("\u2B50") && isClient && (
                <TouchableOpacity
                  style={[
                    s.reviewPromptBtn,
                    hasReviewed && s.reviewPromptBtnDisabled,
                  ]}
                  onPress={() => setShowReviewModal(true)}
                  activeOpacity={hasReviewed ? 1 : 0.85}
                  disabled={hasReviewed}
                >
                  <Text
                    style={[
                      s.reviewPromptText,
                      hasReviewed && s.reviewPromptTextDisabled,
                    ]}
                  >
                    Leave a review
                  </Text>
                </TouchableOpacity>
              )}
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
          >
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
              onPress={() => {
                if (selectedSkills.length === 0) return;
                pendingSkillIdsRef.current = selectedSkills;
                setPendingSkillIds(selectedSkills);
                setShowHireModal(false);
                setConfirmModalType("hire");
                setShowConfirmModal(true);
              }}
              activeOpacity={0.85}
              disabled={selectedSkills.length === 0}
            >
              <Text style={s.confirmActionText}>Next →</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Confirm modal (hire + complete) ── */}
      <ConfirmModal
        visible={showConfirmModal}
        emoji={confirmModalType === "hire" ? "🤝" : "✅"}
        title={confirmModalType === "hire" ? "Confirm hire?" : "Mark as complete?"}
        subtitle={
          confirmModalType === "hire"
            ? `You're about to hire ${freelancerName}` +
              (pendingSkillIdsRef.current.length > 0
                ? ` for ${pendingSkillIdsRef.current
                    .map(getSkillName)
                    .filter(Boolean)
                    .join(", ")}`
                : "")
            : "This will notify the client that the job is done. They'll be able to hire you again."
        }
        confirmLabel={confirmModalType === "hire" ? "Confirm" : "Mark complete"}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={confirmModalType === "hire" ? confirmJob : markJobComplete}
      />

      {/* ── Review modal ── */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        freelancerName={freelancerNameRef.current}
        hasCompletedJob={true}
      />

      {/* ── Options menu ── */}
      <Modal
        visible={showOptionsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={s.optionsMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={s.optionsMenuCard}>
            <TouchableOpacity
              style={s.optionsMenuItem}
              onPress={() => {
                setShowOptionsMenu(false);
                setShowReportModal(true);
              }}
              activeOpacity={0.7}
            >
              <Feather name="flag" size={16} color={Colors.black} />
              <Text style={s.optionsMenuText}>Report</Text>
            </TouchableOpacity>

            <View style={s.optionsMenuDivider} />

            <TouchableOpacity
              style={s.optionsMenuItem}
              onPress={() => {
                setShowOptionsMenu(false);
                if (isBlocked) {
                  handleUnblock();
                } else {
                  setShowBlockConfirm(true);
                }
              }}
              activeOpacity={0.7}
            >
              <Feather
                name={isBlocked ? "user-check" : "slash"}
                size={16}
                color={Colors.danger}
              />
              <Text style={[s.optionsMenuText, { color: Colors.danger }]}>
                {isBlocked ? "Unblock" : "Block"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Report modal ── */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={s.reportModalContainer}>
          <TouchableOpacity
            style={s.reportModalOverlay}
            activeOpacity={1}
            onPress={() => setShowReportModal(false)}
          />
          <View style={s.reportSheet}>
            <View style={s.reportSheetHandle} />
            <Text style={s.reportSheetTitle}>Report this user</Text>
            <Text style={s.reportSheetSub}>
              Why are you reporting {otherUser?.name}?
            </Text>

            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  s.reportReasonItem,
                  selectedReportReason === reason && s.reportReasonItemSelected,
                ]}
                onPress={() => setSelectedReportReason(reason)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.reportReasonText,
                    selectedReportReason === reason && s.reportReasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
                {selectedReportReason === reason && (
                  <Feather name="check" size={16} color={Colors.black} />
                )}
              </TouchableOpacity>
            ))}

            <TextInput
              style={s.reportDetailsInput}
              placeholder="Additional details (optional)"
              placeholderTextColor={Colors.grey300}
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              maxLength={300}
            />

            <TouchableOpacity
              style={[
                s.reportSubmitBtn,
                !selectedReportReason && s.reportSubmitBtnDisabled,
              ]}
              onPress={handleSubmitReport}
              activeOpacity={0.85}
              disabled={!selectedReportReason}
            >
              <Text style={s.reportSubmitBtnText}>Submit report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Block confirmation modal ── */}
      <ConfirmModal
        visible={showBlockConfirm}
        emoji="🚫"
        title={`Block ${otherUser?.name}?`}
        subtitle="You will no longer see messages from them, and they won't be able to contact you on GetMe."
        confirmLabel="Block"
        onCancel={() => setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        danger
      />

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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
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
    borderWidth: StyleSheet.hairlineWidth,
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

  // Skill-selector "Next" button (also shared shape with ConfirmModal)
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

  // Review prompt
  reviewPromptBtn: {
    backgroundColor: Colors.greenLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: "center",
    marginTop: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.green,
  },
  reviewPromptText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.greenDark,
  },
  reviewPromptBtnDisabled: {
    backgroundColor: Colors.grey100,
    borderColor: Colors.border,
    opacity: 0.5,
  },
  reviewPromptTextDisabled: {
    color: Colors.grey400,
  },

  // Options menu
  optionsBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsMenuOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: Spacing.lg,
  },
  optionsMenuCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    minWidth: 160,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  optionsMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  optionsMenuText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  optionsMenuDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },

  // Report modal
  reportModalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  reportSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  reportSheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  reportSheetTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  reportSheetSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    marginBottom: Spacing.lg,
  },
  reportReasonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  reportReasonItemSelected: {
    borderColor: Colors.black,
    borderWidth: 1.5,
    backgroundColor: Colors.grey100,
  },
  reportReasonText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey500,
  },
  reportReasonTextSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.black,
  },
  reportDetailsInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 80,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    textAlignVertical: "top",
  },
  reportSubmitBtn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  reportSubmitBtnDisabled: { opacity: 0.4 },
  reportSubmitBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
