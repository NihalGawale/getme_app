import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors } from '../../constants/Colors'
import { FontFamily, FontSize } from '../../constants/Typography'
import { Spacing, Radius } from '../../constants/Spacing'

type ConfirmModalProps = {
  visible: boolean
  emoji: string
  title: string
  subtitle: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

// Shared "emoji + title + subtitle + cancel/action button" confirmation card,
// used for hire, mark-complete, and block confirmations in chat.
export default function ConfirmModal({
  visible,
  emoji,
  title,
  subtitle,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.emoji}>{emoji}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
          <View style={s.btns}>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, danger && s.actionBtnDanger]}
              onPress={onConfirm}
              activeOpacity={0.85}
            >
              <Text style={s.actionText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    gap: Spacing.sm,
  },
  emoji: { fontSize: 44, marginBottom: Spacing.xs },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xl,
    color: Colors.black,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    color: Colors.grey500,
    textAlign: 'center',
    lineHeight: FontSize.md * 1.6,
    marginBottom: Spacing.sm,
  },
  btns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.grey500,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.black,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: { backgroundColor: Colors.danger },
  actionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.white,
  },
})
