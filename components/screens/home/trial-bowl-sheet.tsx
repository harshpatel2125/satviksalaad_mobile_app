import React from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";
import { optimizedImageSource } from "@/lib/image-url";

interface TrialMeal {
  id: string;
  name: string;
  image_url: string | null;
}

interface Props {
  visible: boolean;
  trialPlanId: string;
  trialPrice: number;
  meals: TrialMeal[];
  onDismiss: () => void;
}

export function TrialBowlSheet({ visible, trialPlanId, trialPrice, meals, onDismiss }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const translateY = useSharedValue(400);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { stiffness: 300, damping: 30 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(400, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }, backdropStyle]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: colors.surface,
              width: Math.min(width, 480),
              alignSelf: "center",
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface2 }]}
            onPress={onDismiss}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.badgeText, { color: colors.primaryDark }]}>
              ✦ Try Before You Commit
            </Text>
          </View>

          <Text style={[styles.headline, { color: colors.text }]}>
            The 3-Day Protein Trial{"\n"}for ₹{trialPrice} 🥗
          </Text>

          <Text style={[styles.subtext, { color: colors.textMuted }]}>
            3 bowls with 30 g of protein each. Your first delivery is on the next delivery day or later.
          </Text>

          {meals.length > 0 && (
            <View style={styles.mealGrid}>
              {meals.slice(0, 6).map((m) => (
                <View
                  key={m.id}
                  style={[styles.mealCard, { backgroundColor: colors.surface2 }]}
                >
                  {m.image_url ? (
                    <Image
                      source={optimizedImageSource(m.image_url) ?? undefined}
                      style={styles.mealImg}
                    />
                  ) : (
                    <Text style={styles.mealEmoji}>🥗</Text>
                  )}
                  <Text
                    style={[styles.mealName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {m.name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.priceRow}>
            <View>
              <Text style={[styles.price, { color: colors.primary }]}>₹{trialPrice}</Text>
              <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
                3 bowls · free within 10 km
              </Text>
            </View>
            <View style={styles.perks}>
              {["30 g protein per bowl", "Free delivery within 10 km", "3 bowls over 3 days"].map((p) => (
                <Text key={p} style={[styles.perk, { color: colors.textMuted }]}>
                  ✓ {p}
                </Text>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary }]}
            onPress={() => {
              onDismiss();
              router.push({ pathname: "/plans", params: { planId: trialPlanId } });
            }}
          >
            <Text style={styles.ctaText}>Start the trial for ₹{trialPrice}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismiss} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>
              No thanks, I&apos;ll explore first
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 6, borderRadius: 999 },
  badge: { borderRadius: 999, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  headline: { fontSize: 20, fontWeight: "900", lineHeight: 26, marginBottom: 8 },
  subtext: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  mealGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  mealCard: { width: "30%", borderRadius: 12, padding: 8, alignItems: "center", gap: 4 },
  mealImg: { width: 48, height: 48, borderRadius: 8 },
  mealEmoji: { fontSize: 24 },
  mealName: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  price: { fontSize: 26, fontWeight: "900" },
  priceLabel: { fontSize: 11 },
  perks: { gap: 2 },
  perk: { fontSize: 11 },
  cta: { borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  ctaText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  skipBtn: { alignItems: "center" },
  skipText: { fontSize: 12 },
});
