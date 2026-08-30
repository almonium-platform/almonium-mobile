import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { AvatarMark } from '@/components/avatar-mark';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { createThemedStyles, fonts, shadows, useTheme } from '@/src/theme';
import type { PublicUserSummary, RelatedUserSummary, RelationshipAction } from '@/src/types';

type Section = 'friends' | 'requests' | 'blocked';

export default function PeopleScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>('friends');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const friends = useQuery({ queryKey: ['relationships', 'friends', firebaseUser?.uid], queryFn: api.friends, enabled: Boolean(firebaseUser) });
  const incoming = useQuery({ queryKey: ['relationships', 'incoming', firebaseUser?.uid], queryFn: api.receivedFriendRequests, enabled: Boolean(firebaseUser) });
  const outgoing = useQuery({ queryKey: ['relationships', 'outgoing', firebaseUser?.uid], queryFn: api.sentFriendRequests, enabled: Boolean(firebaseUser) });
  const blocked = useQuery({ queryKey: ['relationships', 'blocked', firebaseUser?.uid], queryFn: api.blockedUsers, enabled: Boolean(firebaseUser) });
  const results = useQuery({
    queryKey: ['relationships', 'search', submittedSearch],
    queryFn: () => api.searchUsers(submittedSearch),
    enabled: submittedSearch.length >= 3,
  });
  const mutate = useMutation({
    mutationFn: ({ relationshipId, action }: { relationshipId: string; action: RelationshipAction }) => api.manageRelationship(relationshipId, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['relationships'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const data: RelatedUserSummary[] =
    section === 'friends' ? friends.data ?? [] :
      section === 'blocked' ? blocked.data ?? [] : [...(incoming.data ?? []), ...(outgoing.data ?? [])];
  const activeQuery = section === 'friends' ? friends : section === 'blocked' ? blocked : incoming;
  const requestCount = (incoming.data?.length ?? 0) + (outgoing.data?.length ?? 0);

  function action(user: RelatedUserSummary, value: RelationshipAction) {
    mutate.mutate({ relationshipId: user.relationshipId, action: value });
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => `${item.relationshipId}-${item.id}`}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
            </Pressable>
            <View style={styles.titleCopy}><Text style={styles.eyebrow}>SOCIAL</Text><Text style={styles.title}>People</Text></View>
          </View>
          <View style={styles.tabs}>
            {(['friends', 'requests', 'blocked'] as const).map((item) => (
              <Pressable key={item} onPress={() => setSection(item)} style={[styles.tab, section === item && styles.tabActive]}>
                <Text style={[styles.tabText, section === item && styles.tabTextActive]}>
                  {item[0].toUpperCase() + item.slice(1)}{item === 'requests' && requestCount ? ` ${requestCount}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {section === 'friends' && (
            <View style={styles.searchBlock}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={19} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={() => setSubmittedSearch(search.trim())}
                  placeholder="Find someone by @handle"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                <Pressable onPress={() => setSubmittedSearch(search.trim())} disabled={search.trim().length < 3}>
                  <Text style={[styles.searchAction, search.trim().length < 3 && styles.searchDisabled]}>Search</Text>
                </Pressable>
              </View>
              {submittedSearch.length >= 3 && (
                <View style={styles.results}>
                  {results.isLoading ? <ActivityIndicator color={colors.primary} /> :
                    results.data?.length ? results.data.map((user) => <SearchResult key={user.id} user={user} />) :
                      <Text style={styles.emptyCopy}>No reader matched @{submittedSearch}.</Text>}
                </View>
              )}
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.personRow}>
          <Pressable style={styles.identity} onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: item.id } })}>
            <Avatar user={item} />
            <View style={styles.personCopy}>
              <Text style={styles.username}>@{item.username}</Text>
              <Text style={styles.relationship}>{relationshipCopy(item)}</Text>
            </View>
          </Pressable>
          <View style={styles.actions}>
            {item.relationshipStatus === 'PENDING_INCOMING' && <><SmallAction label="Accept" primary onPress={() => action(item, 'ACCEPT')} /><SmallAction label="Decline" onPress={() => action(item, 'REJECT')} /></>}
            {item.relationshipStatus === 'PENDING_OUTGOING' && <SmallAction label="Cancel" onPress={() => action(item, 'CANCEL')} />}
            {item.relationshipStatus === 'FRIENDS' && <SmallAction label="Remove" onPress={() => action(item, 'UNFRIEND')} />}
            {item.relationshipStatus === 'BLOCKED' && <SmallAction label="Unblock" onPress={() => action(item, 'UNBLOCK')} />}
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={activeQuery.isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <View style={styles.empty}>
          <Ionicons name={section === 'blocked' ? 'shield-outline' : 'people-outline'} size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>{section === 'friends' ? 'No friends here yet' : section === 'requests' ? 'No open requests' : 'Nobody is blocked'}</Text>
          <Text style={styles.emptyCopy}>{section === 'friends' ? 'Search by handle to find another reader.' : 'This list will update when something changes.'}</Text>
        </View>
      )}
    />
  );
}

function SearchResult({ user }: { user: PublicUserSummary }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: () => api.requestFriendship(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationships'] }),
  });
  return (
    <View style={styles.resultRow}>
      <Pressable style={styles.identity} onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: user.id } })}>
        <Avatar user={user} />
        <Text style={styles.username}>@{user.username}</Text>
      </Pressable>
      <Button loading={request.isPending} onPress={() => request.mutate()}>Add</Button>
    </View>
  );
}

function Avatar({ user }: { user: PublicUserSummary }) {
  return <AvatarMark premium={user.premium} size={46} />;
}

function SmallAction({ label, primary = false, onPress }: { label: string; primary?: boolean; onPress(): void }) {
  const styles = useStyles();
  return <Pressable onPress={onPress} style={[styles.smallAction, primary && styles.smallActionPrimary]}><Text style={[styles.smallActionText, primary && styles.smallActionTextPrimary]}>{label}</Text></Pressable>;
}

function relationshipCopy(user: RelatedUserSummary) {
  if (user.relationshipStatus === 'FRIENDS') return 'Friend';
  if (user.relationshipStatus === 'PENDING_INCOMING') return 'Wants to be friends';
  if (user.relationshipStatus === 'PENDING_OUTGOING') return 'You asked';
  if (user.relationshipStatus === 'BLOCKED') return 'Blocked';
  return 'Reader';
}

const useStyles = createThemedStyles((colors) => ({
  list: { flexGrow: 1, padding: 20, paddingBottom: 36, backgroundColor: colors.canvas },
  header: { gap: 13, paddingBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surface, ...shadows.field },
  titleCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, fontWeight: '600' },
  tabs: { minHeight: 46, flexDirection: 'row', borderRadius: 23, padding: 4, backgroundColor: colors.surface, ...shadows.field },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  tabActive: { backgroundColor: colors.accentSoft },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.primaryDark },
  searchBlock: { gap: 9 },
  searchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 25, paddingHorizontal: 15, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  searchAction: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  searchDisabled: { color: colors.disabledText },
  results: { gap: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, padding: 11, backgroundColor: colors.surface },
  personRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 22, padding: 13, backgroundColor: colors.surface, ...shadows.card },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  personCopy: { flex: 1, gap: 3 },
  username: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  relationship: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 5 },
  smallAction: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 10 },
  smallActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  smallActionText: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  smallActionTextPrimary: { color: colors.onPrimary },
  loader: { marginTop: 50 },
  empty: { minHeight: 310, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 24 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
}));
