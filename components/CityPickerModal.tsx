import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";
import { FontFamily, FontSize } from "../constants/Typography";
import { Spacing, Radius } from "../constants/Spacing";
import type { City } from "../types/city";

type Props = {
  visible: boolean;
  cities: City[];
  selectedCityId?: string | null;
  onSelect: (city: City) => void;
  onClose: () => void;
};

// Centered, searchable city picker used by the home feed and onboarding
// screens. Search is a case-insensitive prefix match on `name`.
export default function CityPickerModal({
  visible,
  cities,
  selectedCityId,
  onSelect,
  onClose,
}: Props) {
  const [citySearch, setCitySearch] = useState("");

  useEffect(() => {
    if (visible) setCitySearch("");
  }, [visible]);

  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => city.name.toLowerCase().startsWith(query));
  }, [cities, citySearch]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.cityModalContainer}>
        <View style={s.cityModalCard}>
          <View style={s.cityModalHeader}>
            <Text style={s.cityModalTitle}>Select city</Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={s.cityModalClose}
            >
              <Feather name="x" size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          <View style={s.citySearchWrap}>
            <Feather
              name="search"
              size={16}
              color={Colors.grey400}
              style={s.citySearchIcon}
            />
            <TextInput
              style={s.citySearchInput}
              placeholder="Search city..."
              placeholderTextColor={Colors.grey300}
              value={citySearch}
              onChangeText={setCitySearch}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {citySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearch("")}>
                <Feather name="x-circle" size={16} color={Colors.grey400} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredCities}
            extraData={citySearch}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={s.cityList}
            ListEmptyComponent={
              <View style={s.cityEmptyWrap}>
                <Text style={s.cityEmptyText}>
                  No cities found for "{citySearch}"
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  s.cityItem,
                  selectedCityId === item.id && s.cityItemSelected,
                ]}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <View style={s.cityItemLeft}>
                  <Text
                    style={[
                      s.cityItemName,
                      selectedCityId === item.id && s.cityItemNameSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.state ? (
                    <Text style={s.cityItemState}>{item.state}</Text>
                  ) : null}
                </View>
                {selectedCityId === item.id && (
                  <Feather name="check" size={16} color={Colors.green} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  cityModalContainer: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  cityModalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    width: "100%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  cityModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cityModalTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.black,
  },
  cityModalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  citySearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    margin: Spacing.lg,
    backgroundColor: Colors.grey100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  citySearchIcon: { flexShrink: 0 },
  citySearchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
    height: 44,
  },
  cityList: { maxHeight: 400 },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.grey100,
  },
  cityItemSelected: { backgroundColor: Colors.greenLight },
  cityItemLeft: { gap: 2 },
  cityItemName: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.black,
  },
  cityItemNameSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.greenDark,
  },
  cityItemState: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.grey400,
  },
  cityEmptyWrap: { padding: Spacing.xxxl, alignItems: "center" },
  cityEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.grey400,
    textAlign: "center",
  },
});
