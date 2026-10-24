import { Redirect } from 'expo-router';

/** Skipping lives on the Deliveries tab, where every item of a day is skipped in one place. */
export default function SkipDeliveryScreen() {
  return <Redirect href="/(tabs)/deliveries" />;
}
