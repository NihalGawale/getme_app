import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Index() {
  const { session, profile, loading, user } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasFreelancerProfile, setHasFreelancerProfile] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!session || !user) {
      setCheckingProfile(false);
      return;
    }

    if (profile?.role === "freelancer") {
      checkFreelancerProfile();
    } else {
      setCheckingProfile(false);
    }
  }, [loading, session, profile, user]);

  const checkFreelancerProfile = async () => {
    const { data } = await supabase
      .from("freelancer_profiles")
      .select("id, is_published")
      .eq("user_id", user!.id)
      .single();

    setHasFreelancerProfile(!!data);
    setCheckingProfile(false);
  };

  if (loading || checkingProfile) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  // Not logged in
  if (!session) return <Redirect href="/(auth)/" />;

  // Logged in but no role
  if (!profile?.role) return <Redirect href="/(auth)/role" />;

  // Freelancer with no profile yet
  if (profile.role === "freelancer" && !hasFreelancerProfile) {
    return <Redirect href="/(onboarding)/freelancer-profile" />;
  }

  // Everything complete
  return <Redirect href="/(tabs)/" />;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
