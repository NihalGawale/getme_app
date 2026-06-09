import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Index() {
  const { session, profile, loading, user } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasFreelancerProfile, setHasFreelancerProfile] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Timeout fallback — if loading takes more than 5 seconds
  // force a re-check directly from Supabase
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading || checkingProfile) {
        console.log("Auth timeout — forcing session check");
        setTimedOut(true);
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  // Force session refresh if timed out
  useEffect(() => {
    if (!timedOut) return;
    const forceCheck = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setCheckingProfile(false);
      }
      // AuthContext onAuthStateChange will fire and handle the rest
    };
    forceCheck();
  }, [timedOut]);

  useEffect(() => {
    if (loading) return;
    if (!session || !user) {
      setCheckingProfile(false);
      return;
    }
    if (profile === undefined) return;
    if (!profile?.role) {
      setCheckingProfile(false);
      return;
    }
    if (profile.role === "freelancer") {
      checkFreelancerProfile();
    } else {
      setCheckingProfile(false);
    }
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

  if (loading || checkingProfile) {
    return (
      <View style={s.container}>
        <ActivityIndicator color="#111" size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/" />;
  if (!profile?.role) return <Redirect href="/(auth)/role" />;
  if (profile.role === "freelancer" && !hasFreelancerProfile) {
    return <Redirect href="/(onboarding)/freelancer-profile" />;
  }
  if (profile.role === "client" && !profile.name) {
    return <Redirect href="/(onboarding)/client-details" />;
  }
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
