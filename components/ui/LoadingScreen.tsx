import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Colors } from '../../constants/Colors'

export default function LoadingScreen() {
  return (
    <View style={s.container}>
      <ActivityIndicator color={Colors.black} size="large" />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
})
