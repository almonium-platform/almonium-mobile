import { useLocalSearchParams } from 'expo-router';

import { SharedLinkScreen } from '@/components/shared-link';

/** almonium.com/d/:shareId — a shared pack. */
export default function SharedDeckRoute() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <SharedLinkScreen kind="deck" id={id} />;
}
