import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

export default function FreelancerProfile() {
  const { id } = useLocalSearchParams()
  return (
    <View style={s.c}>
      <Text style={s.t}>Freelancer profile</Text>
      <Text style={s.sub}>ID: {id}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  c: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff', gap:8 },
  t: { fontSize:18, fontWeight:'500', color:'#111' },
  sub: { fontSize:13, color:'#6B6B68' },
})
