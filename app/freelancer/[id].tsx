import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getOrCreateConversation } from "../../lib/conversations";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import LoadingScreen from "../../components/ui/LoadingScreen";
import Divider from "../../components/ui/Divider";
import { TextStyles } from "../../constants/Typography";
import { Feather } from "@expo/vector-icons";
import FeatherIcon from "../../components/ui/FeatherIcon";
import ReviewModal from "../../components/ReviewModal";
import SkillPills from "../../components/SkillPills";
import { VibeSummaryPills, ReviewVibePills } from "../../components/VibePills";
import PortfolioGrid from "../../components/PortfolioGrid";
import PortfolioLightbox from "../../components/PortfolioLightbox";
import type { Review } from "../../types/review";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 4) / 3);

type FreelancerProfile = {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  portfolio_urls: string[];
  whatsapp_number: string | null;
  instagram_handle: string | null;
  contact_phone: string | null;
  users: {
    name: string;
    avatar_url: string | null;
    cities: { name: string };
  };
  skill_names: string[];
};

export default function FreelancerProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [jobCount, setJobCount] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [hasCompletedJob, setHasCompletedJob] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [existingReview, setExistingReview] = useState<{
    vibes: string[];
    note: string | null;
  } | null>(null);
  const [showReviewsSheet, setShowReviewsSheet] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProfile();
      fetchJobCount();
      fetchReviews();
      if (user) checkCanReview();
    }
  }, [id, user?.id]);

  const fetchJobCount = async () => {
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("freelancer_id", id);
    setJobCount(count ?? 0);
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        job_id,
        vibes,
        note,
        created_at,
        client_id,
        users!reviews_client_id_fkey (
          name,
          avatar_url,
          city_id,
          cities (
            name
          )
        )
      `,
      )
      .eq("freelancer_id", id)
      .order("created_at", { ascending: false });

    if (data) setReviews(data as unknown as Review[]);
  };

  const checkCanReview = async () => {
    if (!user) return;
    const { data: completedJob } = await supabase
      .from("jobs")
      .select("id")
      .eq("freelancer_id", id)
      .eq("client_id", user.id)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (!completedJob) {
      setCanReview(false);
      setHasCompletedJob(false);
      return;
    }
    setHasCompletedJob(true);
    setCanReview(true);
    const { data: existingRev } = await supabase
      .from("reviews")
      .select("vibes, note")
      .eq("job_id", completedJob.id)
      .maybeSingle();
    if (existingRev) setExistingReview(existingRev);
  };

  const handleSubmitReview = async (vibes: string[], note: string) => {
    if (!user) throw new Error("Not authenticated");
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("freelancer_id", id)
      .eq("client_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!job) throw new Error("No completed job found");
    const { error } = await supabase.from("reviews").upsert(
      {
        job_id: job.id,
        freelancer_id: id,
        client_id: user.id,
        vibes,
        note: note || null,
      },
      { onConflict: "job_id" },
    );
    if (error) throw error;
    setExistingReview({ vibes, note: note || null });
    fetchReviews();
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select(
        `
        id,
        user_id,
        bio,
        skills,
        portfolio_urls,
        whatsapp_number,
        instagram_handle,
        contact_phone,
        users!inner (
          name,
          avatar_url,
          cities (name)
        )
      `,
      )
      .eq("user_id", id)
      .single();

    if (error) {
      console.log("Profile fetch error:", error.message);
      setLoading(false);
      return;
    }

    const { data: skillsData } = await supabase
      .from("skills")
      .select("id, name")
      .in("id", data.skills || []);

    const users = Array.isArray(data.users) ? data.users[0] : data.users;
    const cities = users?.cities;
    const city = Array.isArray(cities) ? cities[0] : cities;

    setProfile({
      ...data,
      users: { ...users, cities: city },
      skill_names: (skillsData || []).map((s: any) => s.name),
    } as FreelancerProfile);
    setLoading(false);
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const url = `https://wa.me/91${cleaned}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open WhatsApp"),
    );
  };

  const openInstagram = (handle: string) => {
    const cleaned = handle.replace("@", "");
    const appUrl = `instagram://user?username=${cleaned}`;
    const webUrl = `https://instagram.com/${cleaned}`;
    Linking.canOpenURL(appUrl).then((supported) => {
      Linking.openURL(supported ? appUrl : webUrl).catch(() =>
        Alert.alert("Error", "Could not open Instagram"),
      );
    });
  };

  const startChat = async () => {
    if (!user || !profile) return;

    if (user.id === profile.user_id) {
      Alert.alert("This is your profile", "You cannot message yourself.");
      return;
    }

    setStartingChat(true);

    try {
      const conversationId = await getOrCreateConversation(
        user.id,
        profile.user_id,
      );
      router.push(`/chat/${conversationId}`);
    } catch {
      Alert.alert("Error", "Could not start conversation.");
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return (
      <View style={s.loadingWrap}>
        <Text style={s.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <FeatherIcon
            name="arrow-left"
            size={24}
            color="black"
            style={s.backIcon}
          />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Avatar + name */}
        <View style={s.profileTop}>
          <Avatar
            name={profile.users?.name}
            uri={profile.users?.avatar_url}
            size="xl"
          />
          <Text style={s.name}>{profile.users?.name}</Text>
          <Text style={s.location}>
            {profile.skill_names[0] ?? "Freelancer"} ·{" "}
            {profile.users?.cities?.name}
          </Text>
          {jobCount > 0 && (
            <View style={s.jobBadge}>
              <Text style={s.jobBadgeText}>
                {jobCount} {jobCount === 1 ? "job" : "jobs"} on GetMe
              </Text>
            </View>
          )}
        </View>

        <Divider />

        {/* Bio */}
        {profile.bio ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>About</Text>
            <Text style={s.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {profile.skill_names.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Skills</Text>
            <SkillPills skills={profile.skill_names} />
          </View>
        )}

        {/* Reviews summary */}
        {reviews.length > 0 && (
          <View style={s.section}>
            <View style={s.reviewsHeaderRow}>
              <Text style={s.sectionLabel}>Reviews & Vibes</Text>
              <View style={s.reviewCountBadge}>
                <Text style={s.reviewCountText}>{reviews.length}</Text>
              </View>
            </View>

            {/* Vibe summary pills */}
            <VibeSummaryPills reviews={reviews} />

            {/* See all reviews button */}
            <TouchableOpacity
              style={s.seeAllBtn}
              onPress={() => setShowReviewsSheet(true)}
              activeOpacity={0.85}
            >
              <Text style={s.seeAllBtnText}>
                See all reviews ({reviews.length})
              </Text>
              <Feather name="chevron-right" size={16} color={Colors.black} />
            </TouchableOpacity>
          </View>
        )}

        {/* Contact buttons */}
        <View style={s.contactSection}>
          <Button
            label={startingChat ? "Opening..." : "Message"}
            onPress={startChat}
            disabled={startingChat}
            loading={startingChat}
          />
        </View>

        <Divider />

        {/* Portfolio */}
        <View style={s.portfolioSection}>
          {profile.portfolio_urls && profile.portfolio_urls.length > 0 ? (
            <>
              <View
                style={{
                  paddingHorizontal: Layout.screenPadding,
                  marginBottom: 10,
                  marginTop: Spacing.sm,
                }}
              >
                <Text style={[TextStyles.label, s.sectionLabel]}>
                  Portfolio
                </Text>
              </View>
              <PortfolioGrid
                urls={profile.portfolio_urls}
                cellSize={CELL_SIZE}
                onPressImage={(i) => {
                  setLightboxIndex(i);
                  setLightboxVisible(true);
                }}
              />
            </>
          ) : (
            <View style={s.portfolioLabelWrap}>
              <Text style={[TextStyles.label, s.sectionLabel]}>Portfolio</Text>
              <View style={s.noPortfolio}>
                <Text style={s.noPortfolioText}>
                  No portfolio images added yet
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <PortfolioLightbox
        visible={lightboxVisible}
        urls={profile.portfolio_urls}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />

      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        freelancerName={profile.users?.name ?? ""}
        hasCompletedJob={hasCompletedJob}
        existingReview={
          existingReview
            ? { vibes: existingReview.vibes, note: existingReview.note ?? "" }
            : undefined
        }
      />

      {/* Reviews bottom sheet */}
      <Modal
        visible={showReviewsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewsSheet(false)}
      >
        <View style={s.reviewSheetContainer}>
          {/* Overlay */}
          <TouchableOpacity
            style={s.reviewSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowReviewsSheet(false)}
          />

          {/* Sheet */}
          <View style={s.reviewSheet}>
            {/* Handle */}
            <View style={s.reviewSheetHandle} />

            {/* Header */}
            <View style={s.reviewSheetHeader}>
              <Text style={s.reviewSheetTitle}>Reviews</Text>
              <TouchableOpacity
                onPress={() => setShowReviewsSheet(false)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={Colors.black} />
              </TouchableOpacity>
            </View>

            {/* Reviews list */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.reviewSheetContent}
            >
              {reviews.length === 0 ? (
                <View style={s.reviewEmptyWrap}>
                  <Text style={s.reviewEmptyText}>No reviews yet</Text>
                </View>
              ) : (
                reviews.map((review, index) => (
                  <View key={review.id}>
                    <View style={s.reviewItem}>
                      {/* Client info */}
                      <View style={s.reviewClientRow}>
                        <Avatar
                          uri={review.users?.avatar_url}
                          name={review.users?.name}
                          size="sm"
                        />
                        <View style={s.reviewClientInfo}>
                          <Text style={s.reviewClientName}>
                            {review.users?.name ?? "Client"}
                          </Text>
                          <Text style={s.reviewClientMeta}>
                            {review.users?.cities?.name ?? ""}
                            {" · "}
                            {new Date(review.created_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </Text>
                        </View>
                      </View>

                      {/* Vibe pills */}
                      <ReviewVibePills vibeIds={review.vibes} />

                      {/* Note */}
                      {review.note ? (
                        <Text style={s.reviewNoteText}>"{review.note}"</Text>
                      ) : null}
                    </View>

                    {/* Divider between reviews */}
                    {index < reviews.length - 1 && (
                      <View style={s.reviewDivider} />
                    )}
                  </View>
                ))
              )}

              {/* Leave / edit review */}
              {canReview && user?.id !== profile.user_id && (
                <TouchableOpacity
                  style={s.leaveReviewBtn}
                  onPress={() => {
                    setShowReviewsSheet(false);
                    setTimeout(() => setShowReviewModal(true), 350);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.leaveReviewBtnText}>
                    {existingReview ? "Edit your review" : "Leave a review ✍️"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.lg,
    color: Colors.grey500,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: FontSize.xl, color: Colors.black },
  headerTitle: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.black,
  },

  // Profile top
  scrollContent: { paddingBottom: 100 },
  profileTop: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Layout.screenPadding,
    gap: Spacing.xs,
  },
  name: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginTop: Spacing.md,
  },
  location: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
  },
  jobBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.greenLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  jobBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.greenDark,
  },

  // Sections
  section: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Bio
  bioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: 22,
  },

  // Contact buttons
  contactSection: {
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },

  // Portfolio
  portfolioSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  portfolioLabelWrap: {
    paddingHorizontal: Layout.screenPadding,
    marginBottom: Spacing.xs,
  },
  noPortfolio: {
    paddingHorizontal: Layout.screenPadding,
    paddingVertical: Spacing.xl,
    alignItems: "center" as const,
  },
  noPortfolioText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey300,
    fontStyle: "italic" as const,
  },

  // Reviews summary
  reviewsHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewCountBadge: {
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: -8,
  },
  reviewCountText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.grey500,
  },
  seeAllBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  seeAllBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },

  // Reviews bottom sheet
  reviewSheetContainer: {
    flex: 1,
    justifyContent: "flex-end" as const,
  },
  reviewSheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  reviewSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: "80%",
    paddingTop: Spacing.md,
  },
  reviewSheetHandle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: "center" as const,
    marginBottom: Spacing.md,
  },
  reviewSheetHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  reviewSheetTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
  },
  reviewSheetContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  reviewItem: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  reviewClientRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
  },
  reviewClientInfo: {
    flex: 1,
    gap: 2,
  },
  reviewClientName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  reviewClientMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
  },
  reviewNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    lineHeight: FontSize.base * 1.6,
    fontStyle: "italic" as const,
  },
  reviewDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
  },
  reviewEmptyWrap: {
    alignItems: "center" as const,
    paddingVertical: 40,
  },
  reviewEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.grey400,
    fontStyle: "italic" as const,
  },
  leaveReviewBtn: {
    borderWidth: 1,
    borderColor: Colors.black,
    borderRadius: Radius.md,
    height: 44,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: Spacing.lg,
  },
  leaveReviewBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
});
