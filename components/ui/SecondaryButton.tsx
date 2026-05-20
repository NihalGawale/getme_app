import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import { Spacing, Radius } from '../../constants/Spacing';
import { FontFamily, FontSize } from '../../constants/Typography';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
};

export default function SecondaryButton({ label, onPress, icon }: SecondaryButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.white,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: Colors.grey200,
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.black,
  },
});
