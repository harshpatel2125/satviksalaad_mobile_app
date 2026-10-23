import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { addressesApi, MIN_FULL_ADDRESS } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { readAddressesCache, writeAddressesCache } from '@/lib/home-cache';
import { trackAddressAdded } from '@/lib/analytics';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { AreaPickerModal } from '@/components/screens/addresses/area-picker-modal';

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_CHIPS = ['Home', 'Office', 'Other'] as const;
type LabelChip = typeof LABEL_CHIPS[number];

type FieldKey = 'addressLine' | 'landmark' | 'pincode';

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddAddress() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [activeLabel, setActiveLabel] = useState<LabelChip>('Home');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState<boolean>(false);

  const [values, setValues] = useState<Record<FieldKey, string>>({
    addressLine: '', landmark: '', pincode: '',
  });
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function setValue(key: FieldKey, text: string): void {
    setValues((v) => ({ ...v, [key]: text }));
    if (fieldErrors[key]) setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  async function handleSave(): Promise<void> {
    let hasError = false;
    const errors: Partial<Record<FieldKey, string>> = {};

    if (!selectedArea) {
      setAreaError('Please select a delivery area');
      hasError = true;
    }
    const full = [values.addressLine.trim(), selectedArea].filter(Boolean).join(', ');
    if (!values.addressLine.trim()) {
      errors.addressLine = 'Enter house / flat / building name';
      hasError = true;
    } else if (full.length < MIN_FULL_ADDRESS) {
      errors.addressLine = 'Enter a complete address';
      hasError = true;
    }

    if (hasError) { setFieldErrors(errors); return; }

    setSaving(true);
    setApiError(null);
    try {
      const existing = userId ? (readAddressesCache(userId) ?? []) : [];
      const effectiveDefault = isDefault || existing.length === 0;
      const res = await addressesApi.create({
        label: activeLabel,
        full_address: full,
        area: selectedArea,
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: values.pincode.trim() || null,
        landmark: values.landmark.trim() || null,
        is_default: effectiveDefault,
      });
      trackAddressAdded();
      if (userId && res.data) {
        const newAddr = { ...res.data, is_default: effectiveDefault };
        const updated = effectiveDefault
          ? [...existing.map((a) => ({ ...a, is_default: false })), newAddr]
          : [...existing, newAddr];
        writeAddressesCache(userId, updated);
      }
      void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      router.back();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Add address" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing[4], paddingBottom: Spacing[5] }]}
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
          {areaError ? (
            <Text style={[styles.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{areaError}</Text>
          ) : null}

          <Text style={[styles.fieldHeading, { color: fieldErrors.addressLine ? colors.error : colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            HOUSE / FLAT / BUILDING *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: fieldErrors.addressLine ? colors.error : colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={values.addressLine}
            onChangeText={(t) => setValue('addressLine', t)}
            placeholder="e.g. B-402, Shanti Residency"
            placeholderTextColor={colors.textMuted}
          />
          {fieldErrors.addressLine ? <Text style={[styles.fieldError, { color: colors.error, fontFamily: fonts.body }]}>{fieldErrors.addressLine}</Text> : null}

          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            LANDMARK (optional)
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={values.landmark}
            onChangeText={(t) => setValue('landmark', t)}
            placeholder="e.g. Near Prahladnagar Garden"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldHeading, { color: colors.textMuted, fontFamily: fonts.bodyMedium }]}>
            PINCODE
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontFamily: fonts.body }]}
            value={values.pincode}
            onChangeText={(t) => setValue('pincode', t)}
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
            {saving ? 'Saving…' : 'Save address'}
          </Text>
        </TouchableOpacity>
      </BottomActionBar>

      <AreaPickerModal
        visible={showAreaPicker}
        selectedArea={selectedArea}
        onSelect={(area) => { setSelectedArea(area); setAreaError(null); }}
        onClose={() => setShowAreaPicker(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },
  content:       { paddingHorizontal: Spacing[5] },

  chipsRow:      { flexDirection: 'row', gap: 8 },
  labelChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  labelChipText: { fontSize: FontSize.sm },

  fieldHeading:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 14 },
  fieldError:    { fontSize: FontSize.xs, marginTop: 4 },

  areaSelector:     { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  areaSelectorText: { fontSize: FontSize.base, flex: 1 },

  input:         { height: 48, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, fontSize: FontSize.base },
  cityField:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  defaultRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, padding: 12 },
  defaultText:   { fontSize: FontSize.sm, flex: 1 },

  apiError:      { fontSize: FontSize.xs },

  saveBtn:       { height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:   { fontSize: FontSize.base, color: '#FFFFFF' },
});
