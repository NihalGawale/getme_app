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
    // Wait until auth is fully loaded
    if (loading) return;

    // No session — no need to check anything
    if (!session || !user) {
      setCheckingProfile(false);
      return;
    }

    // Profile not loaded yet — wait
    if (profile === undefined) return;

    // No role yet — no need to check further
    if (!profile?.role) {
      setCheckingProfile(false);
      return;
    }

    // Client — no further async checks needed
    if (profile.role === "client") {
      setCheckingProfile(false);
      return;
    }

    // Freelancer — check if profile exists
    if (profile.role === "freelancer") {
      checkFreelancerProfile();
      return;
    }

    setCheckingProfile(false);
  }, [loading, session, profile, user]);

  const checkFreelancerProfile = async () => {
    const { data } = await supabase
      .from("freelancer_profiles")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    setHasFreelancerProfile(!!data);
    setCheckingProfile(false);
  };

  // Still loading
  if (loading || checkingProfile) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  // Not logged in
  if (!session) return <Redirect href="/(auth)/" />;

  // No role yet
  if (!profile?.role) return <Redirect href="/(auth)/role" />;

  // Freelancer with no profile
  if (profile.role === "freelancer" && !hasFreelancerProfile) {
    return <Redirect href="/(onboarding)/freelancer-profile" />;
  }

  // Client with no name — go to details screen
  if (profile.role === "client" && !profile.name) {
    console.log("Client has no name — routing to client-details");
    return <Redirect href="/(onboarding)/client-details" />;
  }

  // All good — go home
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
