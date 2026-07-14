import { View, StyleSheet, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Spacing } from "../../constants/Spacing";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import AuthScreenHeader from "../../components/AuthScreenHeader";

export default function PhoneScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      Alert.alert(
        "Invalid number",
        "Please enter a valid 10-digit mobile number",
      );
      return;
    }

    setLoading(true);
    const formattedPhone = `+91${phone.replace(/\s/g, "")}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    router.push({
      pathname: "/(auth)/otp",
      params: { phone: formattedPhone, role: role ?? "" },
    });
  };

  return (
    <AuthScreenHeader
      step={2}
      title="Can we have your number?"
      subtitle="We'll send a one-time code to verify."
      keyboardAvoiding
    >
      <View style={s.inputWrap}>
        <Input
          prefix="+91"
          placeholder="98765 43210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={10}
        />
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label="Send me OTP"
        onPress={handleSendOTP}
        loading={loading}
        disabled={phone.length < 10}
      />
    </AuthScreenHeader>
  );
}

const s = StyleSheet.create({
  inputWrap: { marginBottom: Spacing.md },
});
