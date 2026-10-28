import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { EmptyState } from '@/components/ui/empty-state';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { AddressesSkeleton } from '@/components/skeletons/addresses-skeleton';
import { AddressCard } from '@/components/screens/addresses/address-card';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { column } from '@/constants/layout';
import { useAlert } from '@/context/alert';
import { useAuth } from '@/context/auth';
import { addressesApi } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { readAddressesCache, writeAddressesCache, writeDeliveriesCache } from '@/lib/home-cache';
import { trackAddressDeleted } from '@/lib/analytics';
import { useTheme } from '@/hooks/use-theme';
import type { DeliveryAddress } from '@/types/api';

export default function AddressesScreen() {
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const { selectMode: selectModeParam } = useLocalSearchParams<{ selectMode?: string }>();
  const isSelectMode = selectModeParam === 'true';

  // Synchronous MMKV read — shows cached addresses instantly on 2nd+ opens
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(
    () => (userId ? (readAddressesCache(userId) ?? []) : []),
  );
  const [loading, setLoading] = useState(
    () => !userId || readAddressesCache(userId) === null,
  );
  const hadNoCache = useRef(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Deeplink path: userId null on mount — populate cache once auth resolves
  const cacheInitRef = useRef(userId !== null);
  useEffect(() => {
    if (cacheInitRef.current || !userId) return;
    cacheInitRef.current = true;
    const cached = readAddressesCache(userId);
    if (cached) { setAddresses(cached); setLoading(false); }
  }, [userId]);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await addressesApi.list();
      const data = res.data ?? [];
      setAddresses(data);
      if (userId) writeAddressesCache(userId, data);
      // Keep the deliveries query cache in sync so the deliveries tab always
      // reflects the latest address list without a separate network fetch.
      queryClient.setQueryData(
        ['deliveries'],
        (old: { success?: boolean; data?: { addresses?: DeliveryAddress[] } & Record<string, unknown> } | undefined) => {
          if (!old?.data) return old;
          const updatedData = { ...old.data, addresses: data };
          if (userId) writeDeliveriesCache(userId, updatedData as Parameters<typeof writeDeliveriesCache>[1]);
          return { ...old, data: updatedData };
        },
      );
    } catch {
      // keep existing state on transient failure
    }
  }, [userId]);

  // Load on mount
  useEffect(() => {
    void loadAddresses().finally(() => setLoading(false));
  }, [loadAddresses]);

  // Silent reload whenever screen gains focus (handles returning from add/edit-address)
  useFocusEffect(
    useCallback(() => {
      void loadAddresses();
    }, [loadAddresses]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAddresses();
    setRefreshing(false);
  }, [loadAddresses]);

  function handleEdit(item: DeliveryAddress) {
    router.push({
      pathname: '/edit-address',
      params: {
        id: item.id,
        label: item.label ?? '',
        full_address: item.full_address,
        area: item.area,
        landmark: item.landmark ?? '',
        pincode: item.pincode ?? '',
        is_default: String(item.is_default),
      },
    });
  }

  async function handleSetDefault(id: string) {
    // Optimistic update — instant UI, no spinner
    const optimistic = addresses.map((a) => ({ ...a, is_default: a.id === id }));
    setAddresses(optimistic);
    if (userId) writeAddressesCache(userId, optimistic);
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });

    setBusyId(id);
    try {
      await addressesApi.setDefault(id);
      void loadAddresses(); // quiet background sync
    } catch {
      // Rollback on failure
      void loadAddresses();
      showAlert('Error', 'Could not set default address. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  // Select mode: tap a card → patch both caches instantly → go back → API call in background
  function handleSelect(item: DeliveryAddress) {
    if (!item.is_default) {
      const optimisticAddresses = addresses.map((a) => ({ ...a, is_default: a.id === item.id }));

      // 1. Patch the addresses MMKV cache
      if (userId) writeAddressesCache(userId, optimisticAddresses);

      // 2. Patch the TanStack Query deliveries cache in-place (what the deliveries tab reads)
      queryClient.setQueryData(
        ['deliveries'],
        (old: { success?: boolean; data?: { addresses?: DeliveryAddress[] } & Record<string, unknown> } | undefined) => {
          if (!old?.data?.addresses) return old;
          const updatedAddresses = old.data.addresses.map((a: DeliveryAddress) => ({
            ...a,
            is_default: a.id === item.id,
          }));
          const updatedData = { ...old.data, addresses: updatedAddresses };
          // 3. Keep the MMKV deliveries cache in sync too
          if (userId) writeDeliveriesCache(userId, updatedData as Parameters<typeof writeDeliveriesCache>[1]);
          return { ...old, data: updatedData };
        },
      );

      // 4. Background API call + quiet sync (user is already back on deliveries)
      void addressesApi.setDefault(item.id)
        .then(() => loadAddresses())
        .catch(() => loadAddresses());
    }
    router.back();
  }

  async function handleDelete(id: string) {
    showAlert(
      'Delete address',
      'Are you sure you want to remove this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(id);
            try {
              await addressesApi.delete(id);
              trackAddressDeleted();
              const updated = addresses.filter((a) => a.id !== id);
              setAddresses(updated);
              if (userId) writeAddressesCache(userId, updated);
              void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
            } catch {
              showAlert('Error', 'Could not delete address. Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={isSelectMode ? 'Choose address' : 'Saved addresses'}
        onBack={() => router.back()}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[column(), s.scrollContent, { paddingTop: Spacing[5], paddingBottom: insets.bottom + Spacing[4] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={s.content}>
          {loading ? (
            <Animated.View exiting={FadeOut.duration(200)}>
              <AddressesSkeleton />
            </Animated.View>
          ) : (
            <Animated.View
              entering={hadNoCache.current
                ? FadeIn.duration(350).withInitialValues({ transform: [{ translateY: 8 }] })
                : undefined}
            >
              {addresses.length === 0 ? (
                <EmptyState
                  icon="location-outline"
                  title="No saved addresses"
                  body="Add your first delivery address below."
                />
              ) : (
                addresses.map((item) => (
                  <AddressCard
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    selectMode={isSelectMode}
                    onEdit={handleEdit}
                    onSetDefault={addresses.length > 1 ? handleSetDefault : undefined}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </Animated.View>
          )}

          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push('/add-address')}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary, fontFamily: fonts.bodyMedium }]}>
              Add new address
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 0 },
  content:       { paddingHorizontal: Spacing[5] },


  addBtn:        { height: 52, borderRadius: Radius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addBtnText:    { fontSize: FontSize.base },
});
