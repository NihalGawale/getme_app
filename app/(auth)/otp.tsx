import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/Colors";
import { FontFamily, FontSize } from "../../constants/Typography";
import { Spacing, Radius } from "../../constants/Spacing";
import AuthScreenHeader from "../../components/AuthScreenHeader";

export default function OTPScreen() {
  const router = useRouter();
  const { phone, role } = useLocalSearchParams<{
    phone: string;
    role: string;
  }>();
  const { refreshProfile } = useAuth();
  const [otp, setOtp] = useState(""); // Add resend state at top of component
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Add timer effect
  useEffect(() => {
    if (resendTimer === 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(30);
    setOtp("");

    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setOtp(cleaned);
    if (cleaned.length === 6) {
      handleVerify(cleaned);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code ?? otp;
    if (otpCode.length < 6) return;

    setLoading(true);

    // Demo account bypass — routes to a pre-created account instead of real OTP verification
    if (phone === "+919876543210" && otpCode === "123456") {
      try {
        // Establishes a real Supabase session so RLS policies pass correctly
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: 'demo@getme.social',
          password: 'Demo#121'
        })

        if (signInError) {
          setLoading(false)
          Alert.alert('Error', signInError.message)
          return
        }

        // Session is now established — fetch the user profile
        await refreshProfile()
        setLoading(false)
        router.replace('/(tabs)/')
      } catch (e) {
        setLoading(false)
        Alert.alert('Error', 'Something went wrong')
      }
      return
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otpCode,
      type: "sms",
    });

    if (error) {
      setLoading(false);
      setOtp("");
      Alert.alert("Invalid code", "Please check the code and try again.");
      inputRef.current?.focus();
      return;
    }

    const userId = data.session?.user?.id;
    const userPhone = data.session?.user?.phone ?? null;
    const userEmail = data.session?.user?.email ?? null;

    if (!userId) {
      setLoading(false);
      Alert.alert("Error", "Session error. Please try again.");
      return;
    }

    // Check if existing user
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, role, name")
      .eq("id", userId)
      .single();

    if (existingUser) {
      // Check if user is trying to sign up with a different role
      if (role && existingUser.role && role !== existingUser.role) {
        setLoading(false);
        Alert.alert(
          "Account already exists",
          `This number is already registered as a ${existingUser.role}. Please sign in instead.`,
          [
            {
              text: "Sign in",
              onPress: async () => {
                await refreshProfile();
                router.replace("/(tabs)/");
              },
            },
            {
              text: "Cancel",
              onPress: () => {
                router.replace("/(auth)/");
              },
              style: "cancel",
            },
          ],
        );
        return;
      }

      // Existing user with same role — go home
      await refreshProfile();
      setLoading(false);

      if (existingUser.role === "freelancer") {
        const { data: fp } = await supabase
          .from("freelancer_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();
        if (!fp) {
          router.replace("/(onboarding)/freelancer-profile");
          return;
        }
      }

      if (existingUser.role === "client" && !existingUser.name) {
        router.replace("/(onboarding)/client-details");
        return;
      }

      router.replace("/(tabs)/");
      return;
    }

    // New user
    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      phone: userPhone,
      email: userEmail || null,
      role: role || "client",
    });

    if (upsertError) {
      setLoading(false);
      Alert.alert("Error", upsertError.message);
      return;
    }

    await refreshProfile();
    setLoading(false);

    if (role === "freelancer") {
      router.replace("/(onboarding)/freelancer-profile");
    } else {
      router.replace("/(onboarding)/client-details");
    }
  };

  return (
    <AuthScreenHeader
      step={3}
      title="Check your messages"
      subtitle={`We sent a code to ${phone}.`}
      keyboardAvoiding
    >
      {/* OTP container: visual boxes + real input overlay */}
      <View style={s.otpContainer}>
        {/* Visual boxes — display only, no touch events */}
        <View style={s.otpBoxesRow} pointerEvents="none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[
                s.otpBox,
                otp.length === i && s.otpBoxActive,
                otp.length > i && s.otpBoxFilled,
              ]}
            >
              <Text style={s.otpDigit}>{otp[i] ?? ""}</Text>
            </View>
          ))}
        </View>

        {/* Real input — covers the box row, nearly invisible but visible to iOS */}
        <TextInput
          ref={inputRef}
          style={s.realInput}
          value={otp}
          onChangeText={handleOtpChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus={true}
          maxLength={6}
          caretHidden={true}
          contextMenuHidden={true}
          selectionColor="transparent"
        />
      </View>

      <View style={s.resendRow}>
        <Text style={s.resendTimer}>Didn't receive it?</Text>
        <TouchableOpacity
          onPress={handleResend}
          disabled={!canResend}
          activeOpacity={0.7}
        >
          <Text style={[s.resendLink, !canResend && s.resendDisabled]}>
            {canResend ? "Resend OTP" : `Resend in ${resendTimer}s`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[s.btn, (otp.length < 6 || loading) && s.btnDisabled]}
        onPress={() => handleVerify()}
        activeOpacity={0.85}
        disabled={otp.length < 6 || loading}
      >
        <Text style={s.btnText}>{loading ? "Verifying..." : "Verify"}</Text>
      </TouchableOpacity>
    </AuthScreenHeader>
  );
}

const s = StyleSheet.create({
  // OTP container
  otpContainer: {
    position: "relative",
    height: 56,
    marginBottom: Spacing.md,
    zIndex: 999,
  },
  otpBoxesRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.grey200,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
  },
  otpBoxActive: {
    borderWidth: 1.5,
    borderColor: Colors.black,
  },
  otpBoxFilled: {
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  otpDigit: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
  },
  realInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: "transparent",
    backgroundColor: "transparent",
    zIndex: 999,
    fontSize: 40,
    letterSpacing: 38,
  },

  // Resend row
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resendLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.black,
  },
  resendDisabled: {
    color: Colors.grey300,
  },
  resendTimer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
  },

  // Verify button
  btn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
