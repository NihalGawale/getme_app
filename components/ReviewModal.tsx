import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useState, useEffect } from 'react'
import { VIBES } from '../constants/Vibes'
import { Colors } from '../constants/Colors'
import { FontFamily, FontSize } from '../constants/Typography'
import { Spacing, Radius } from '../constants/Spacing'

type ReviewModalProps = {
  visible: boolean
  onClose: () => void
  onSubmit: (vibes: string[], note: string) => Promise<void>
  freelancerName: string
  hasCompletedJob: boolean
  existingReview?: { vibes: string[]; note: string } | null
}

export default function ReviewModal({
  visible,
  onClose,
  onSubmit,
  freelancerName,
  hasCompletedJob,
  existingReview,
}: ReviewModalProps) {
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (existingReview) {
      setSelectedVibes(existingReview.vibes)
      setNote(existingReview.note ?? '')
    } else {
      setSelectedVibes([])
      setNote('')
    }
  }, [visible, existingReview])

  const availableVibes = VIBES.filter(v =>
    hasCompletedJob ? true : v.tier === 1,
  )

  const toggleVibe = (vibeId: string) => {
    setSelectedVibes(prev =>
      prev.includes(vibeId)
        ? prev.filter(v => v !== vibeId)
        : [...prev, vibeId],
    )
  }

  const handleSubmit = async () => {
    if (selectedVibes.length === 0) return
    setSubmitting(true)
    try {
      await onSubmit(selectedVibes, note.trim())
      onClose()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={rs.overlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={rs.sheet}>
        <View style={rs.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={rs.title}>
            How was working with {freelancerName}?
          </Text>
          <Text style={rs.subtitle}>
            {hasCompletedJob
              ? "You've completed a job together"
              : 'Based on your conversation'}
          </Text>

          {/* Vibe grid */}
          <View style={rs.vibeGrid}>
            {availableVibes.map(vibe => (
              <TouchableOpacity
                key={vibe.id}
                style={[
                  rs.vibeTile,
                  selectedVibes.includes(vibe.id) && rs.vibeTileSelected,
                ]}
                onPress={() => toggleVibe(vibe.id)}
                activeOpacity={0.8}
              >
                <Text style={rs.vibeEmoji}>{vibe.emoji}</Text>
                <Text
                  style={[
                    rs.vibeLabel,
                    selectedVibes.includes(vibe.id) && rs.vibeLabelSelected,
                  ]}
                >
                  {vibe.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Note input */}
          <Text style={rs.noteLabel}>
            Add a note{' '}
            <Text style={rs.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={rs.noteInput}
            placeholder="Tell others about your experience..."
            placeholderTextColor={Colors.grey300}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <Text style={rs.charCount}>{note.length}/200</Text>

          {/* Submit */}
          <TouchableOpacity
            style={[
              rs.submitBtn,
              selectedVibes.length === 0 && rs.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={selectedVibes.length === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={rs.submitBtnText}>
                {existingReview ? 'Update review' : 'Submit review'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </View>
    </Modal>
  )
}

const rs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 32,
    height: 3,
    backgroundColor: Colors.grey200,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    marginBottom: Spacing.xl,
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  vibeTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    width: '47%',
  },
  vibeTileSelected: {
    borderWidth: 1.5,
    borderColor: Colors.black,
    backgroundColor: Colors.grey100,
  },
  vibeEmoji: { fontSize: 20 },
  vibeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey500,
    flex: 1,
  },
  vibeLabelSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.black,
  },
  noteLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.black,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  optional: {
    fontFamily: FontFamily.regular,
    color: Colors.grey400,
    textTransform: 'none',
  },
  noteInput: {
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    minHeight: 80,
  },
  charCount: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  submitBtn: {
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
})
