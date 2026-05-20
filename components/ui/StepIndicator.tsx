import { View, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import { Spacing, Radius } from '../../constants/Spacing';

type StepIndicatorProps = {
  total: number;
  current: number;
};

export default function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.step,
            { backgroundColor: i < current ? Colors.black : Colors.grey200 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  step: {
    flex: 1,
    height: 3,
    borderRadius: Radius.full,
  },
});
