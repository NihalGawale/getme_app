// import { View, Text, StyleSheet } from 'react-native'
// export default function ProfileScreen() {
//   return <View style={s.c}><Text style={s.t}>Profile — coming soon</Text></View>
// }
// const s = StyleSheet.create({ c:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#fff' }, t:{ fontSize:16, color:'#6B6B68' } })
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const { signOut, profile, user } = useAuth();

  return (
    <View style={s.container}>
      <Text style={s.title}>Profile</Text>
      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Role</Text>
          <Text style={s.infoValue}>{profile?.role ?? "—"}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Phone</Text>
          <Text style={s.infoValue}>{user?.phone ?? "—"}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>User ID</Text>
          <Text style={s.infoValue}>{user?.id?.slice(0, 12)}...</Text>
        </View>
      </View>
      <TouchableOpacity
        style={s.signOutBtn}
        onPress={signOut}
        activeOpacity={0.85}
      >
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: { fontSize: 22, fontWeight: "500", color: "#111", marginBottom: 24 },
  infoCard: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F4F4F4",
  },
  infoLabel: { fontSize: 13, color: "#6B6B68" },
  infoValue: { fontSize: 13, fontWeight: "500", color: "#111" },
  signOutBtn: {
    borderWidth: 0.5,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: { fontSize: 14, fontWeight: "500", color: "#E24B4A" },
});
