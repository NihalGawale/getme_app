import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Colors } from "../constants/Colors";

export default function Index() {
  const { session, profile, loading, user } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasFreelancerProfile, setHasFreelancerProfile] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Keep refs in sync so the timeout below always reads the latest
  // loading/checkingProfile values instead of the ones from mount.
  const loadingRef = useRef(loading);
  const checkingProfileRef = useRef(checkingProfile);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    checkingProfileRef.current = checkingProfile;
  }, [checkingProfile]);

  // Timeout fallback — if loading takes more than 5 seconds
  // force a re-check directly from Supabase
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loadingRef.current || checkingProfileRef.current) {
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
        <ActivityIndicator color={Colors.black} size="large" />
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
    backgroundColor: Colors.white,
  },
});
