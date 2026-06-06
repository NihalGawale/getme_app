import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Spacing, Radius } from '../../constants/Spacing'
import { Layout } from '../../constants/Layout'

export default function OTPScreen() {
  const router = useRouter()
  const { phone, role } = useLocalSearchParams<{ phone: string; role: string }>()
  const { refreshProfile } = useAuth()
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6)
    setOtp(cleaned)
    if (cleaned.length === 6) {
      handleVerify(cleaned)
    }
  }

  const handleVerify = async (code?: string) => {
    const otpCode = code ?? otp
    if (otpCode.length < 6) return

    setLoading(true)

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otpCode,
      type: 'sms',
    })

    if (error) {
      setLoading(false)
      setOtp('')
      Alert.alert('Invalid code', 'Please check the code and try again.')
      inputRef.current?.focus()
      return
    }

    const userId = data.session?.user?.id
    const userPhone = data.session?.user?.phone ?? null
    const userEmail = data.session?.user?.email ?? null

    if (!userId) {
      setLoading(false)
      Alert.alert('Error', 'Session error. Please try again.')
      return
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, name')
      .eq('id', userId)
      .single()

    if (existingUser) {
      await refreshProfile()
      setLoading(false)

      if (existingUser.role === 'freelancer') {
        const { data: fp } = await supabase
          .from('freelancer_profiles')
          .select('id')
          .eq('user_id', userId)
          .single()
        if (!fp) {
          router.replace('/(onboarding)/freelancer-profile')
          return
        }
      }

      if (existingUser.role === 'client' && !existingUser.name) {
        router.replace('/(onboarding)/client-details')
        return
      }

      router.replace('/(tabs)/')
      return
    }

    // New user
    const { error: upsertError } = await supabase.from('users').upsert({
      id: userId,
      phone: userPhone,
      email: userEmail || null,
      role: role || 'client',
    })

    if (upsertError) {
      setLoading(false)
      Alert.alert('Error', upsertError.message)
      return
    }

    await refreshProfile()
    setLoading(false)

    if (role === 'freelancer') {
      router.replace('/(onboarding)/freelancer-profile')
    } else {
      router.replace('/(onboarding)/client-details')
    }
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

        <View style={s.progress}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.bar, i < 3 && s.barActive]} />
          ))}
        </View>

        <Text style={s.title}>Enter the code</Text>
        <Text style={s.sub}>Sent to {phone}.</Text>

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
                <Text style={s.otpDigit}>{otp[i] ?? ''}</Text>
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
          <Text style={s.resendLabel}>Didn't receive it?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.resendLink}>Change number</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[s.btn, (otp.length < 6 || loading) && s.btnDisabled]}
          onPress={() => handleVerify()}
          activeOpacity={0.85}
          disabled={otp.length < 6 || loading}
        >
          <Text style={s.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  container: {
    flex: 1,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: 56,
    paddingBottom: 40,
  },

  // Progress bar
  progress: { flexDirection: 'row', gap: Spacing.xs, marginBottom: 28 },
  bar: { flex: 1, height: 3, borderRadius: Radius.full, backgroundColor: Colors.grey200 },
  barActive: { backgroundColor: Colors.black },

  // Heading
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    marginBottom: Spacing.sm,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    marginBottom: Spacing.xxl,
  },

  // OTP container
  otpContainer: {
    position: 'relative',
    height: 56,
    marginBottom: Spacing.md,
    zIndex: 999,
  },
  otpBoxesRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderWidth: 0.5,
    borderColor: Colors.grey200,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
    backgroundColor: 'transparent',
    zIndex: 999,
    fontSize: 40,
    letterSpacing: 38,
  },

  // Resend row
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey300,
  },
  resendLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.black,
  },

  // Verify button
  btn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
