import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
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
import CityPickerModal from "../../components/CityPickerModal";
import type { City } from "../../types/city";
import { Feather } from "@expo/vector-icons";

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
  score: number;
  is_new_user: boolean;
  joined_days_ago: number;
};

const CARD_IMAGE_WIDTH = Layout.screenWidth - Layout.screenPadding * 2;

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState<Record<string, number>>({});
  const newUserIndexRef = useRef(0);

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
      const { data, error } = await supabase.rpc("get_ranked_freelancers", {
        p_city_id: selectedCity.id,
        p_skill_id: selectedSkill ?? null,
        p_limit: 100,
      });

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
          name: f.user_name as string,
          avatar_url: f.user_avatar_url as string | null,
          city_id: f.user_city_id as string,
          cities: { name: f.city_name as string },
        },
        skill_names: ((f.skills as string[]) ?? [])
          .map((sid: string) => skills.find((s) => s.id === sid)?.name)
          .filter((name): name is string => Boolean(name)),
        review_count: Number(f.review_count) ?? 0,
        vibe_count: Number(f.vibe_count) ?? 0,
        score: Number(f.score) ?? 0,
        is_new_user: f.is_new_user as boolean,
        joined_days_ago: f.joined_days_ago as number,
      }));

      // Separate ranked and new users
      const ranked = enriched.filter((f) => !f.is_new_user);
      const newUsers = enriched.filter((f) => f.is_new_user);

      // Interleave new users into every 5th position
      // using round-robin rotation across renders
      const COLD_START_INTERVAL = 5;
      const interleaved = [...ranked];
      let newUserIndex = newUserIndexRef.current;

      if (newUsers.length > 0) {
        for (
          let pos = COLD_START_INTERVAL - 1;
          pos < interleaved.length + Math.ceil(interleaved.length / COLD_START_INTERVAL);
          pos += COLD_START_INTERVAL
        ) {
          if (newUserIndex >= newUsers.length * 3) break;
          const newUser = newUsers[newUserIndex % newUsers.length];
          if (pos <= interleaved.length) {
            interleaved.splice(pos, 0, newUser);
          }
          newUserIndex++;
        }
        newUserIndexRef.current = newUserIndex;
      }

      setFreelancers(interleaved);
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

  const filtered = useMemo(() => {
    return freelancers.filter((f) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const nameMatch = f.users?.name?.toLowerCase().includes(q);
      const skillMatch = f.skill_names?.some((s) =>
        s.toLowerCase().includes(q),
      );
      return nameMatch || skillMatch;
    });
  }, [freelancers, search]);

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
          onPress={() => setShowCityModal(true)}
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

      <CityPickerModal
        visible={showCityModal}
        cities={cities}
        selectedCityId={selectedCity?.id}
        onSelect={(city) => {
          setSelectedCity(city);
          setShowCityModal(false);
        }}
        onClose={() => setShowCityModal(false)}
      />
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
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.black,
  },

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
