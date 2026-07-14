import {
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../constants/Colors";

type Props = {
  urls: string[];
  cellSize: number;
  /** View mode: tapping a cell (e.g. to open a lightbox). */
  onPressImage?: (index: number) => void;
  /** Edit mode: shows a remove badge on each cell and an "add" cell. */
  editable?: boolean;
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  maxCount?: number;
  uploading?: boolean;
};

export default function PortfolioGrid({
  urls,
  cellSize,
  onPressImage,
  editable = false,
  onRemove,
  onAdd,
  maxCount = 9,
  uploading = false,
}: Props) {
  return (
    <View style={s.grid}>
      {urls.map((url, i) =>
        editable ? (
          <View key={i} style={[s.cell, { width: cellSize, height: cellSize }]}>
            <Image source={{ uri: url }} style={s.image} />
            <TouchableOpacity style={s.removeBtn} onPress={() => onRemove?.(i)}>
              <Feather name="x" size={12} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            key={i}
            style={[s.cell, { width: cellSize, height: cellSize }]}
            onPress={() => onPressImage?.(i)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: url }}
              style={s.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ),
      )}
      {editable && urls.length < maxCount && (
        <TouchableOpacity
          style={[s.addCell, { width: cellSize, height: cellSize }]}
          onPress={onAdd}
          activeOpacity={0.7}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.grey400} />
          ) : (
            <Feather name="plus" size={24} color={Colors.grey400} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  cell: {
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.grey100,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addCell: {
    backgroundColor: Colors.grey100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
