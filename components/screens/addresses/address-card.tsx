import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DeliveryAddress } from '@/types/api';

function addressIcon(label: string | null): React.ComponentProps<typeof Ionicons>['name'] {
  const l = (label ?? '').toLowerCase();
  if (l.includes('office') || l.includes('work')) return 'briefcase-outline';
  if (l.includes('home')) return 'home-outline';
  return 'location-outline';
}

interface AddressCardProps {
  item: DeliveryAddress;
  onSetDefault?: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: DeliveryAddress) => void;
  /** Called when card body is tapped in select mode */
  onSelect?: (item: DeliveryAddress) => void;
  /** When true: card body selects, action row shows only Edit */
  selectMode?: boolean;
  busy?: boolean;
}

export function AddressCard({ item, onSetDefault, onDelete, onEdit, onSelect, selectMode, busy }: AddressCardProps) {
  const { colors, fonts } = useTheme();
  const icon = addressIcon(item.label);
  const displayLabel = item.label ?? item.area;

  const addressLine = [
    item.full_address,
    item.city,
    item.pincode,
  ].filter(Boolean).join(' · ');

  // Shared card info block
  const infoBlock = (
    <View style={s.topRow}>
      <View style={[s.iconBox, { backgroundColor: item.is_default ? colors.sageSoft : colors.surface2 }]}>
        <Ionicons
          name={icon}
          size={16}
          color={item.is_default ? colors.primaryDark : colors.textMuted}
        />
      </View>

      <View style={s.info}>
        <View style={s.labelRow}>
          <Text style={[s.label, { color: colors.text, fontFamily: fonts.bodySemibold }]}>
            {displayLabel}
          </Text>
          {item.is_default && (
            <View style={[s.defaultPill, { backgroundColor: colors.primaryBg }]}>
              <Text style={[s.defaultText, { color: colors.primaryDark, fontFamily: fonts.bodyBold }]}>
                Default
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[s.addressText, { color: colors.textMuted, fontFamily: fonts.body }]}
          numberOfLines={2}
        >
          {addressLine}
        </Text>

        {item.landmark ? (
          <Text style={[s.landmark, { color: colors.textMuted, fontFamily: fonts.body }]}>
            Near {item.landmark}
          </Text>
        ) : null}
      </View>

      {selectMode && (
        <Ionicons
          name={item.is_default ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={item.is_default ? colors.primary : colors.border}
          style={{ marginLeft: 4, flexShrink: 0 }}
        />
      )}
    </View>
  );

  if (selectMode) {
    return (
      <View
        style={[
          s.card,
          {
            backgroundColor: colors.surface,
            borderWidth: item.is_default ? 1.5 : 1,
            borderColor: item.is_default ? colors.primary : colors.border,
          },
        ]}
      >
        {/* Tappable body — selects this address and goes back */}
        <TouchableOpacity activeOpacity={0.72} disabled={busy} onPress={() => onSelect?.(item)}>
          {infoBlock}
        </TouchableOpacity>

        {/* Edit action — separate touch area, does not trigger selection */}
        <View style={[s.actions, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onEdit(item)}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.primary} />
            <Text style={[s.actionText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: item.is_default ? colors.primary : colors.border,
        },
      ]}
    >
      {infoBlock}

      {/* Action row — normal mode: Edit + Set primary + Delete */}
      <View style={[s.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => onEdit(item)}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={[s.actionText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
            Edit
          </Text>
        </TouchableOpacity>

        <View style={[s.actionDivider, { backgroundColor: colors.border }]} />

        {!item.is_default && onSetDefault && (
          <>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => onSetDefault(item.id)}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Ionicons name="star-outline" size={14} color={colors.primary} />
              <Text style={[s.actionText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
                Set primary
              </Text>
            </TouchableOpacity>
            <View style={[s.actionDivider, { backgroundColor: colors.border }]} />
          </>
        )}

        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => onDelete(item.id)}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color={colors.error} />
          <Text style={[s.actionText, { color: colors.error, fontFamily: fonts.bodyMedium }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:          { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing[3] },
  topRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], padding: Spacing[4] },
  iconBox:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  info:          { flex: 1, gap: 3 },
  labelRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  label:         { fontSize: FontSize.base },
  defaultPill:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  defaultText:   { fontSize: 9, letterSpacing: 0.3 },
  addressText:   { fontSize: FontSize.sm, lineHeight: FontSize.sm * 1.5 },
  landmark:      { fontSize: FontSize.xs, opacity: 0.7 },

  actions:       { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11 },
  actionText:    { fontSize: FontSize.xs },
  actionDivider: { width: StyleSheet.hairlineWidth, height: 20 },
});
