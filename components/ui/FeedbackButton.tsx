import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Spacing, Radius } from '../../constants/Spacing'

const RATING_OPTIONS: { rating: 1 | 2 | 3; emoji: string; label: string }[] = [
  { rating: 1, emoji: '😞', label: 'Not great' },
  { rating: 2, emoji: '😐', label: "It's okay" },
  { rating: 3, emoji: '😊', label: 'Loving it' },
]

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleCancel = () => {
    setRating(null)
    setMessage('')
    setIsOpen(false)
  }

  const handleSubmit = async () => {
    if (!rating && !message.trim()) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      let role: string | null = null
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        role = userData?.role ?? null
      }
      await supabase.from('feedback').insert({
        user_id: user?.id ?? null,
        type: 'general',
        trigger: 'manual',
        rating,
        message: message.trim() || null,
        role,
      })
      setRating(null)
      setMessage('')
      setIsOpen(false)
    } catch (e) {
      console.log('Feedback error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const isDisabled = !rating && !message.trim()

  return (
    <>
      <TouchableOpacity
        style={s.floatingButton}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={20} color={Colors.white} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss()
          setIsOpen(false)
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss()
            setIsOpen(false)
          }}
        >
          <View style={s.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          style={s.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.sheet}>
              <View style={s.dragHandle} />
              <Text style={s.title}>Give your feedback</Text>
              <Text style={s.subtitle}>Help us make GetMe better</Text>

              <View style={s.ratingRow}>
                {RATING_OPTIONS.map((option) => {
                  const selected = rating === option.rating
                  return (
                    <TouchableOpacity
                      key={option.rating}
                      style={s.ratingOption}
                      onPress={() => setRating(option.rating)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.emojiPill, selected && s.emojiPillSelected]}>
                        <Text style={s.emoji}>{option.emoji}</Text>
                      </View>
                      <Text style={[s.ratingLabel, selected && s.ratingLabelSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <TextInput
                style={s.input}
                placeholder="What's on your mind? (optional)"
                placeholderTextColor={Colors.grey300}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
                blurOnSubmit={false}
              />

              <View style={s.buttonRow}>
                <TouchableOpacity
                  style={s.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.85}
                >
                  <Text style={s.cancelLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.submitButton, isDisabled && s.submitButtonDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={isDisabled}
                >
                  {submitting ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={s.submitLabel}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 10,
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  keyboardAvoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    paddingBottom: 40,
    width: '100%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  ratingOption: {
    alignItems: 'center',
  },
  emojiPill: {
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  emojiPillSelected: {
    backgroundColor: Colors.greenLight,
    transform: [{ scale: 1.15 }],
  },
  emoji: {
    fontSize: 36,
  },
  ratingLabel: {
    fontSize: FontSize.xs,
    color: Colors.grey300,
    marginTop: Spacing.xs,
  },
  ratingLabelSelected: {
    color: Colors.black,
  },
  input: {
    marginTop: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.grey200,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    minHeight: 100,
    marginBottom: Spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.grey200,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.grey500,
  },
  submitButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
})
