import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Image,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import { Layout } from "../../constants/Layout";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { Feather } from "@expo/vector-icons";
import { posthog } from "../../lib/posthog";

type City = { id: string; name: string; state: string };
type Skill = { id: string; name: string; icon: string };
type Freelancer = {
  id: string;
  user_id: string;
  bio: string | null;
  skills: string[];
  portfolio_urls: string[];
  is_published: boolean;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  users: {
    name: string;
    avatar_url: string | null;
    city_id: string;
    cities: { name: string };
  };
  skill_names: string[];
  review_count: number;
  vibe_count: number;
};

const CARD_IMAGE_WIDTH = Layout.screenWidth - Layout.screenPadding * 2;

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCityModal, setShowCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCity) fetchFreelancers();
  }, [selectedCity, selectedSkill]);

  const loadInitialData = async () => {
    setLoading(true);

    const [{ data: citiesData }, { data: skillsData }] = await Promise.all([
      supabase
        .from("cities")
        .select("id, name, state")
        .eq("is_active", true)
        .order("name"),
      supabase.from("skills").select("id, name, icon").eq("is_active", true),
    ]);

    if (citiesData) setCities(citiesData);
    if (skillsData) setSkills(skillsData);

    if (profile?.city_id && citiesData) {
      const userCity = citiesData.find((c: any) => c.id === profile.city_id);
      if (userCity) setSelectedCity(userCity);
      else setSelectedCity(citiesData[0]);
    } else if (citiesData?.length) {
      setSelectedCity(citiesData[0]);
    }

    setLoading(false);
  };

  const fetchFreelancers = async () => {
    if (!selectedCity) return;

    try {
      let query = supabase
        .from("freelancer_profiles")
        .select(
          `
        id,
        user_id,
        bio,
        skills,
        portfolio_urls,
        is_published,
        whatsapp_number,
        instagram_handle,
        users!inner (
          name,
          avatar_url,
          city_id,
          cities (name)
        )
      `,
        )
        .eq("is_published", true)
        .eq("users.city_id", selectedCity.id)
        .order("created_at", { ascending: false });

      if (selectedSkill) {
        query = query.contains("skills", [selectedSkill]);
      }

      const { data, error } = await query;

      if (error) {
        console.log("Fetch error:", error.message);
        setFreelancers([]);
        return;
      }

      const enriched = ((data as any[]) ?? []).map((f) => ({
        id: f.id as string,
        user_id: f.user_id as string,
        bio: f.bio as string | null,
        skills: f.skills as string[],
        portfolio_urls: f.portfolio_urls as string[],
        is_published: f.is_published as boolean,
        whatsapp_number: f.whatsapp_number as string | null,
        instagram_handle: f.instagram_handle as string | null,
        users: {
          name: (f.users as any)?.name as string,
          avatar_url: (f.users as any)?.avatar_url as string | null,
          city_id: (f.users as any)?.city_id as string,
          cities: { name: (f.users as any)?.cities?.name as string },
        },
        skill_names: ((f.skills as string[]) ?? [])
          .map((sid: string) => skills.find((s) => s.id === sid)?.name)
          .filter((name): name is string => Boolean(name)),
        review_count: 0,
        vibe_count: 0,
      }));

      // Fetch review counts BEFORE setting state
      // Single batch query for all freelancers
      const freelancerIds = enriched.map((f) => f.user_id);
      console.log("Fetching reviews for IDs:", JSON.stringify(freelancerIds));

      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("freelancer_id, vibes, note")
        .in("freelancer_id", freelancerIds);

      const reviewCounts: Record<string, number> = {};
      const vibeCounts: Record<string, number> = {};

      if (reviewData) {
        reviewData.forEach((r: any) => {
          // Count reviews that have a note
          if (r.note) {
            reviewCounts[r.freelancer_id] =
              (reviewCounts[r.freelancer_id] ?? 0) + 1;
          }
          // Count total vibes
          (r.vibes ?? []).forEach(() => {
            vibeCounts[r.freelancer_id] =
              (vibeCounts[r.freelancer_id] ?? 0) + 1;
          });
        });
      }

      console.log("Review counts:", JSON.stringify(reviewCounts));
      console.log("Vibe counts:", JSON.stringify(vibeCounts));
      console.log("Review error:", reviewError?.message);

      // Build counts map
      const counts: Record<string, number> = {};
      if (reviewData) {
        reviewData.forEach((r: any) => {
          counts[r.freelancer_id] = (counts[r.freelancer_id] ?? 0) + 1;
        });
      }

      console.log("Final counts:", JSON.stringify(counts));

      // Merge counts into enriched BEFORE calling setFreelancers
      const enrichedWithReviews = enriched.map((f) => ({
        ...f,
        review_count: counts[f.user_id] ?? 0,
        vibe_count: vibeCounts[f.user_id] ?? 0,
      }));

      console.log(
        "Enriched with reviews:",
        JSON.stringify(
          enrichedWithReviews.map((f) => ({
            name: f.users?.name,
            user_id: f.user_id,
            review_count: f.review_count,
            vibe_count: f.vibe_count,
          })),
        ),
      );

      // Single setFreelancers call — no race condition
      setFreelancers(enrichedWithReviews);
    } catch (e) {
      console.log("Network error:", e);
      setFreelancers([]);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFreelancers();
    setRefreshing(false);
  }, [selectedCity, selectedSkill]);

  const filtered = freelancers.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const nameMatch = f.users?.name?.toLowerCase().includes(q);
    const skillMatch = f.skill_names?.some((s) => s.toLowerCase().includes(q));
    return nameMatch || skillMatch;
  });

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => city.name.toLowerCase().startsWith(query));
  }, [cities, citySearch]);

  function SkeletonCard() {
    const opacity = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, []);

    return (
      <Animated.View style={[sk.card, { opacity }]}>
        <View style={sk.header}>
          <View style={sk.avatar} />
          <View style={sk.info}>
            <View style={sk.nameLine} />
            <View style={sk.subLine} />
          </View>
        </View>
        <View style={sk.tagsRow}>
          <View style={sk.tag} />
          <View style={sk.tag} />
          <View style={sk.tag} />
        </View>
        <View style={sk.image} />
      </Animated.View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        {/* Keep the top bar and search visible */}
        <View style={s.topBar}>
          <Text style={s.logo}>
            Get<Text style={s.logoGreen}>Me</Text>
          </Text>
          <View style={s.cityPill}>
            <Text style={s.cityPillDot}>●</Text>
            <Text style={s.cityPillText}>
              {selectedCity?.name ?? "Loading..."}
            </Text>
          </View>
        </View>
        {/* Skeleton cards */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.logo}>
          Get<Text style={s.logoGreen}>Me</Text>
        </Text>
        <TouchableOpacity
          style={s.cityPill}
          onPress={() => {
            setCitySearch("");
            setShowCityModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={s.cityPillDot}>●</Text>
          <Text style={s.cityPillText}>
            {selectedCity?.name ?? "Select city"}
          </Text>
          <Feather name="chevron-down" size={12} color={Colors.grey500} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Feather name="search" size={16} color={Colors.grey400} />
        <TextInput
          style={s.searchInput}
          placeholder="Search skill or name..."
          placeholderTextColor={Colors.grey300}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={Colors.grey500} />
          </TouchableOpacity>
        )}
      </View>

      {/* Skill filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.skillsRow}
        style={s.skillsScroll}
      >
        <TouchableOpacity
          style={[s.skillChip, !selectedSkill && s.skillChipActive]}
          onPress={() => setSelectedSkill(null)}
          activeOpacity={0.8}
        >
          <Text
            style={[s.skillChipText, !selectedSkill && s.skillChipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {skills.map((skill) => (
          <TouchableOpacity
            key={skill.id}
            style={[
              s.skillChip,
              selectedSkill === skill.id && s.skillChipActive,
            ]}
            onPress={() =>
              setSelectedSkill(selectedSkill === skill.id ? null : skill.id)
            }
            activeOpacity={0.8}
          >
            <Text style={s.skillChipIcon}>{skill.icon}</Text>
            <Text
              style={[
                s.skillChipText,
                selectedSkill === skill.id && s.skillChipTextActive,
              ]}
            >
              {skill.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results header */}
      <View style={s.resultsHeader}>
        <Text style={s.resultsTitle}>Freelancers in {selectedCity?.name}</Text>
        <Text style={s.resultsCount}>{filtered.length} found</Text>
      </View>

      {/* Freelancer list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.black}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔍"
            title="No freelancers here yet"
            subtitle="Be the first to join GetMe in this city"
          />
        }
        nestedScrollEnabled={true}
        renderItem={({ item }) => (
          <View style={s.card}>
            {/* PART 1 — Tappable header */}
            <TouchableOpacity
              onPress={() => router.push(`/freelancer/${item.user_id}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardHeader}>
                <Avatar
                  uri={item.users?.avatar_url}
                  name={item.users?.name}
                  size="md"
                />
                <View style={s.cardInfo}>
                  {/* Name row — name left, review count right */}
                  <View style={s.cardNameRow}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {item.users?.name}
                    </Text>
                    {item.review_count > 0 && (
                      <Text style={s.reviewCount}>
                        ★{" "}
                        {item.review_count === 1
                          ? "1 review"
                          : `${item.review_count} reviews`}
                      </Text>
                    )}
                  </View>

                  {/* Skill + city below */}
                  <Text style={s.cardMeta}>
                    {item.skill_names[0] ?? "Freelancer"} ·{" "}
                    {item.users?.cities?.name}
                  </Text>

                  {/* Vibe count — shown separately below meta */}
                  {item.vibe_count > 0 && (
                    <Text style={s.vibeCount}>
                      ⚡ {item.vibe_count}{" "}
                      {item.vibe_count === 1 ? "vibe" : "vibes"}
                    </Text>
                  )}
                </View>
              </View>

              {item.skill_names.length > 0 && (
                <View style={s.tagsRow}>
                  {item.skill_names.slice(0, 4).map((tag, i) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>

            {/* PART 2 — Portfolio carousel (outside TouchableOpacity) */}
            {item.portfolio_urls && item.portfolio_urls.length > 0 ? (
              <View style={s.carouselWrap}>
                {(() => {
                  const displayUrls = item.portfolio_urls.slice(0, 5);
                  const hasMore = item.portfolio_urls.length > 5;
                  const carouselItems: string[] = hasMore
                    ? [...displayUrls, "VIEW_MORE"]
                    : displayUrls;
                  const totalDots = carouselItems.length;
                  return (
                    <>
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        scrollEventThrottle={16}
                        decelerationRate="fast"
                        bounces={false}
                        onScroll={(e) => {
                          const offset = e.nativeEvent.contentOffset.x;
                          const index = Math.round(offset / CARD_IMAGE_WIDTH);
                          setActiveIndex((prev) => ({
                            ...prev,
                            [item.id]: index,
                          }));
                        }}
                      >
                        {carouselItems.map((url, i) =>
                          url === "VIEW_MORE" ? (
                            <TouchableOpacity
                              key="view-more"
                              style={s.viewMoreSlide}
                              onPress={() =>
                                router.push(`/freelancer/${item.user_id}`)
                              }
                              activeOpacity={0.85}
                            >
                              <Text style={s.viewMoreIcon}>🖼️</Text>
                              <Text style={s.viewMoreText}>
                                View all photos
                              </Text>
                              <Text style={s.viewMoreCount}>
                                +{item.portfolio_urls.length - 5} more
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              key={i}
                              activeOpacity={0.95}
                              onPress={() =>
                                router.push(`/freelancer/${item.user_id}`)
                              }
                            >
                              <Image
                                source={{ uri: url }}
                                style={s.carouselImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ),
                        )}
                      </ScrollView>

                      {totalDots > 1 && (
                        <View style={s.dotsRow}>
                          {Array.from({ length: totalDots }).map((_, i) => (
                            <View
                              key={i}
                              style={[
                                s.dot,
                                i === (activeIndex[item.id] ?? 0) &&
                                  s.dotActive,
                              ]}
                            />
                          ))}
                        </View>
                      )}
                    </>
                  );
                })()}
              </View>
            ) : (
              <View style={s.noPreviewWrap}>
                <Text style={s.noPreviewText}>No preview available</Text>
              </View>
            )}
          </View>
        )}
      />

      {/* City searchable modal */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={s.cityModalContainer}>
          <View style={s.cityModalCard}>
            {/* Header */}
            <View style={s.cityModalHeader}>
              <Text style={s.cityModalTitle}>Select city</Text>
              <TouchableOpacity
                onPress={() => setShowCityModal(false)}
                activeOpacity={0.7}
                style={s.cityModalClose}
              >
                <Feather name="x" size={20} color={Colors.black} />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={s.citySearchWrap}>
              <Feather
                name="search"
                size={16}
                color={Colors.grey400}
                style={s.citySearchIcon}
              />
              <TextInput
                style={s.citySearchInput}
                placeholder="Search city or state..."
                placeholderTextColor={Colors.grey300}
                value={citySearch}
                onChangeText={setCitySearch}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />
              {citySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCitySearch("")}>
                  <Feather name="x-circle" size={16} color={Colors.grey400} />
                </TouchableOpacity>
              )}
            </View>

            {/* City list */}
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={s.cityList}
              ListEmptyComponent={
                <View style={s.cityEmptyWrap}>
                  <Text style={s.cityEmptyText}>
                    No cities found for "{citySearch}"
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.cityItem,
                    selectedCity?.id === item.id && s.cityItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCity(item);
                    setShowCityModal(false);
                    setCitySearch("");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.cityItemLeft}>
                    <Text
                      style={[
                        s.cityItemName,
                        selectedCity?.id === item.id && s.cityItemNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={s.cityItemState}>{item.state}</Text>
                  </View>
                  {selectedCity?.id === item.id && (
                    <Feather name="check" size={16} color={Colors.green} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logo: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.xxl,
    color: Colors.black,
    letterSpacing: -0.5,
  },
  logoGreen: { color: Colors.green },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  cityPillDot: { fontSize: 8, color: Colors.green },
  cityPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.black,
  },
  cityPillArrow: { width: 12 }, // unused — Feather icon used

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  searchIcon: { width: 16 }, // unused — Feather icon used
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  searchClear: { padding: 2 }, // unused — Feather icon used

  // Skills
  skillsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  skillsRow: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: "center",
    flexDirection: "row",
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    height: 34,
  },
  skillChipActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  skillChipIcon: {
    fontSize: 13,
    lineHeight: 18,
  },
  skillChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    lineHeight: 18,
  },
  skillChipTextActive: { color: Colors.white },

  // Results header
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  resultsTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.md,
    color: Colors.black,
  },
  resultsCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 10,
  },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  cardInfo: { flex: 1 },
  cardNameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: Spacing.sm,
  },
  cardName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
    marginBottom: 2,
    flex: 1,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  reviewCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.green,
    flexShrink: 0,
  },

  // Tags
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey500,
  },

  // Portfolio carousel
  carouselWrap: {
    marginTop: Spacing.sm,
    overflow: "hidden",
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  carouselImage: {
    width: CARD_IMAGE_WIDTH,
    height: CARD_IMAGE_WIDTH * 0.6,
    backgroundColor: Colors.grey100,
  },
  viewMoreSlide: {
    width: CARD_IMAGE_WIDTH,
    height: CARD_IMAGE_WIDTH * 0.6,
    backgroundColor: Colors.grey100,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  viewMoreIcon: { fontSize: 32 },
  viewMoreText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  viewMoreCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
  },
  vibeCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.green,
    marginTop: 2,
  },

  // Dot indicators
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.grey300,
  },
  dotActive: { width: 6, height: 6, backgroundColor: Colors.black },

  // No preview
  noPreviewWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    backgroundColor: Colors.offWhite,
  },
  noPreviewText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
    fontStyle: "italic",
  },

  // City modal
  cityModalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: Spacing.xl,
  },
  cityModalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    width: "100%" as any,
    maxHeight: "80%" as any,
    overflow: "hidden" as const,
  },
  cityModalHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cityModalTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
  },
  cityModalClose: {
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  citySearchWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    margin: Spacing.lg,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  citySearchIcon: {
    flexShrink: 0,
  },
  citySearchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    height: 44,
  },
  cityList: {
    maxHeight: 400,
  },
  cityItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  cityItemSelected: {
    backgroundColor: Colors.greenLight,
  },
  cityItemLeft: {
    gap: 2,
  },
  cityItemName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  cityItemNameSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.greenDark,
  },
  cityItemState: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
  },
  cityEmptyWrap: {
    padding: Spacing.xxxl,
    alignItems: "center" as const,
  },
  cityEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey400,
    textAlign: "center" as const,
  },
});

const sk = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Layout.screenPadding,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.grey100,
  },
  info: { flex: 1, gap: 6 },
  nameLine: {
    width: "50%",
    height: 14,
    borderRadius: Radius.sm,
    backgroundColor: Colors.grey100,
  },
  subLine: {
    width: "35%",
    height: 11,
    borderRadius: Radius.sm,
    backgroundColor: Colors.grey100,
  },
  tagsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tag: {
    width: 64,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: Colors.grey100,
  },
  image: {
    width: "100%",
    height: 160,
    borderRadius: Radius.sm,
    backgroundColor: Colors.grey100,
  },
});
