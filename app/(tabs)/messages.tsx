import { View, Text, StyleSheet } from 'react-native'
export default function MessagesScreen() {
  return (
    <View style={s.c}>
      <Text style={s.t}>Messages — coming soon</Text>
    </View>
  )
}
const s = StyleSheet.create({
  c: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  t: { fontSize:16, color:'#6B6B68' },
})
