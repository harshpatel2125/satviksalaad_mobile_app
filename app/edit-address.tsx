import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { ScreenHeader } from '@/components/ui/screen-header';

import { FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { addressesApi, MIN_FULL_ADDRESS } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/context/auth';
import { readAddressesCache, writeAddressesCache } from '@/lib/home-cache';
import { useTheme } from '@/hooks/use-theme';
import { AreaPickerModal } from '@/components/screens/addresses/area-picker-modal';
import type { DeliveryAddress } from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_CHIPS = ['Home', 'Office', 'Other'] as const;

type EditAddressParams = {
  id: string;
  label: string;
  full_address: string;
  area: string;
  landmark: string;
  pincode: string;
  is_default: string;
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditAddress() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId: string | null = session?.user?.id ?? null;

  const params = useLocalSearchParams<EditAddressParams>();

  const [activeLabel, setActiveLabel] = useState<string>(params.label || 'Home');
  const [isDefault, setIsDefault] = useState<boolean>(params.is_default === 'true');
  const [selectedArea, setSelectedArea] = useState<string>(params.area || '');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // full_address = "flat, building, area" — strip the trailing ", area" so the
  // user edits only the flat/building portion and we rebuild it on save.
  const [addressLine, setAddressLine] = useState<string>(() => {
    const fa = params.full_address || '';
    const area = params.area || '';
    if (area && fa.endsWith(`, ${area}`)) return fa.slice(0, -(`, ${area}`).length);
    if (area && fa === area) return '';
    return fa;
  });
  const [landmark, setLandmark] = useState<string>(params.landmark || '');
  const [pincode, setPincode] = useState<string>(params.pincode || '');
  const [addressLineError, setAddressLineError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    let hasError = false;
    if (!selectedArea) { setAreaError('Please select a delivery area'); hasError = true; }
    const full = [addressLine.trim(), selectedArea].filter(Boolean).join(', ');
    if (!addressLine.trim()) { setAddressLineError('Enter flat or building name'); hasError = true; }
    else if (full.length < MIN_FULL_ADDRESS) { setAddressLineError('Enter a complete address'); hasError = true; }
    if (hasError) return;

    setSaving(true);
    setApiError(null);
    try {
      const res = await addressesApi.update(params.id, {
        label: activeLabel,
        full_address: full,
        area: selectedArea,
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: pincode.trim() || null,
        landmark: landmark.trim() || null,
        is_default: isDefault,
      });

      if (userId && res.data) {
        const cached = readAddressesCache(userId);
        if (cached) {
          const updated = cached.map((a: DeliveryAddress) =>
            a.id === params.id ? res.data : a,
          );
          writeAddressesCache(userId, updated);
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      router.back();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to update address. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Edit address" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[column(), styles.scrollContent, { paddingTop: Spacing[4], paddingBottom: Spacing[5] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium, marginTop: 16, marginBottom: 6 }]}>
            LABEL
          </Text>
          <View style={styles.chipsRow}>
            {LABEL_CHIPS.map((lbl) => {
              const active = activeLabel === lbl;
              return (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.labelChip, { backgroundColor: active ? colors.primaryTint : colors.surface, borderColor: active ? colors.primary : colors.border, borderWidth: active ? 1.5 : 1 }]}
                  onPress={() => setActiveLabel(lbl)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.labelChipText, { color: active ? colors.primaryDark : colors.textMuted, fontFamily: active ? fonts.bodySemibold : fonts.body }]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldHeading, { color: areaError ? colors.error : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            DELIVERY AREA *
          </Text>
          <TouchableOpacity
            style={[styles.areaSelector, { backgroundColor: colors.surface, borderColor: areaError ? colors.error : selectedArea ? colors.primary : colors.border }]}
            onPress={() => { setShowAreaPicker(true); setAreaError(null); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.areaSelectorText, { color: selectedArea ? colors.text : colors.textMuted, fontFamily: fonts.body }]}>
              {selectedArea || 'Select delivery area…'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {areaError ? <Text style={[styles.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{areaError}</Text> : null}

          <Text style={[styles.fieldHeading, { color: addressLineError ? colors.error : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            HOUSE / FLAT / BUILDING *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: addressLineError ? colors.error : colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={addressLine}
            onChangeText={(t) => { setAddressLine(t); setAddressLineError(null); }}
            placeholder="e.g. B-402, Shanti Residency"
            placeholderTextColor={colors.textMuted}
          />
          {addressLineError ? <Text style={[styles.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{addressLineError}</Text> : null}

          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            LANDMARK (optional)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={landmark}
            onChangeText={setLandmark}
            placeholder="e.g. Near Prahladnagar Garden"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            PINCODE
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={pincode}
            onChangeText={setPincode}
            placeholder="380015"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={6}
          />

          {/* City — fixed, non-editable */}
          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            CITY
          </Text>
          <View style={[styles.input, styles.cityField, { backgroundColor: colors.surface2 ?? colors.surface, borderColor: colors.border }]}>
            <Text style={[{ color: colors.textMuted, fontFamily: fonts.body, fontSize: FontSize.base }]}>
              Ahmedabad
            </Text>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} style={{ opacity: 0.5 }} />
          </View>
        </View>
      </ScrollView>

      <BottomActionBar flexible style={{ gap: Spacing[2], paddingTop: Spacing[3] }}>
        <TouchableOpacity
          style={[styles.defaultRow, { backgroundColor: colors.primaryTint }]}
          onPress={() => setIsDefault((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name={isDefault ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
          <Text style={[styles.defaultText, { color: colors.primaryDark, fontFamily: fonts.bodyMedium }]}>
            Make this my default delivery address
          </Text>
        </TouchableOpacity>

        {apiError ? (
          <Text style={[styles.apiError, { color: colors.error, fontFamily: fonts.body }]}>{apiError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }, Shadows.sm as object]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { fontFamily: fonts.bodySemibold }]}>
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </TouchableOpacity>
      </BottomActionBar>

      <AreaPickerModal
        visible={showAreaPicker}
        selectedArea={selectedArea}
        onSelect={(area) => { setSelectedArea(area); setAreaError(null); }}
        onClose={() => setShowAreaPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1 },
  scroll:           { flex: 1 },
  scrollContent:    { paddingHorizontal: 0 },
  content:          { paddingHorizontal: Spacing[5] },
  chipsRow:         { flexDirection: 'row', gap: 8 },
  labelChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  labelChipText:    { fontSize: FontSize.sm },
  fieldHeading:     { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  fieldError:       { fontSize: FontSize.xs, marginTop: 4 },
  areaSelector:     { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaSelectorText: { fontSize: FontSize.base, flex: 1 },
  input:            { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, fontSize: FontSize.base },
  cityField:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  defaultRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: 12 },
  defaultText:      { fontSize: FontSize.sm, flex: 1 },
  apiError:         { fontSize: FontSize.xs },
  saveBtn:          { height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:      { fontSize: FontSize.base, color: '#FFFFFF' },
});
