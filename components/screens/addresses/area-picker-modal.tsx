import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '@/hooks/use-top-inset';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { DELIVERY_AREAS } from '@/constants/delivery-areas';
import { useTheme } from '@/hooks/use-theme';
import { zonesApi } from '@/lib/api';
import { CACHE_TTL } from '@/lib/query-client';

interface AreaPickerModalProps {
  visible: boolean;
  selectedArea: string;
  onSelect: (area: string) => void;
  onClose: () => void;
}

export function AreaPickerModal({ visible, selectedArea, onSelect, onClose }: AreaPickerModalProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const [query, setQuery] = useState('');
  const { data } = useQuery({ queryKey: ['zones'], queryFn: zonesApi.list, staleTime: CACHE_TTL.zones });
  const areas = data?.data?.length ? data.data.map((z) => z.name) : DELIVERY_AREAS;

  const filtered: string[] = query.trim()
    ? areas.filter((a) => a.toLowerCase().includes(query.trim().toLowerCase()))
    : areas;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: topInset }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.text, fontFamily: fonts.display }]}>Select area</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.text, fontFamily: fonts.body }]}
            placeholder="Search area…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: colors.textMuted, fontFamily: fonts.body }]}>
              No matching area found.{'\n'}We currently deliver in select areas of Ahmedabad.
            </Text>
          </View>
        ) : (
          <FlatList
        showsVerticalScrollIndicator={false}
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => {
              const selected = item === selectedArea;
              return (
                <TouchableOpacity
                  style={[s.row, { borderBottomColor: colors.border }]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.rowText, { color: selected ? colors.primary : colors.text, fontFamily: selected ? fonts.bodySemibold : fonts.body }]}>
                    {item}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4] },
  title:       { fontSize: FontSize.xl },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing[5], marginVertical: Spacing[3], borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: FontSize.base, padding: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText:     { fontSize: FontSize.base },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[8], paddingTop: Spacing[8] },
  emptyText:   { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
});
