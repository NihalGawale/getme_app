import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../context/AuthContext";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "../lib/supabase";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import Constants from "expo-constants";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Add this function inside RootLayout
  const registerForPushNotifications = async () => {
    try {
      if (!Device.isDevice) return;

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from("users")
          .update({ push_token: token.data })
          .eq("id", session.user.id);
      }
    } catch (e) {
      console.log("Push notification setup skipped:", e);
    }
  };

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      registerForPushNotifications();
    }
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
