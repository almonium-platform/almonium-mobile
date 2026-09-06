import { useLocalSearchParams } from 'expo-router';

import { SharedLinkScreen } from '@/components/shared-link';

/** almonium.com/c/:publicId — one shared word. */
export default function SharedCardRoute() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <SharedLinkScreen kind="card" id={id} />;
}
