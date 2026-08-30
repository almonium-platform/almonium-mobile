import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { AvatarMark } from '@/components/avatar-mark';
import { api } from '@/src/api';
import { config } from '@/src/config';
import { useNotice } from '@/src/notice-context';
import { languageName } from '@/src/languages';
import { colors, fonts, shadows } from '@/src/theme';
import type { RelationshipAction, UserProfile } from '@/src/types';

export default function UserProfileScreen() {
  const { userId = '' } = useLocalSearchParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const showNotice = useNotice();
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: () => api.userProfile(userId), enabled: Boolean(userId) });
  const relationship = useMutation({
    mutationFn: ({ id, action }: { id: string; action: RelationshipAction }) => api.manageRelationship(id, action),
    onSuccess: async () => {
      await profile.refetch();
      await queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });
  const request = useMutation({ mutationFn: () => api.requestFriendship(userId), onSuccess: () => profile.refetch() });

  function manage(action: RelationshipAction) {
    if (!profile.data?.relationshipId) return;
    relationship.mutate({ id: profile.data.relationshipId, action });
  }

  if (profile.isLoading) return <View style={styles.center}><Text style={styles.meta}>Loading reader…</Text></View>;
  if (profile.isError || !profile.data) return (
    <View style={styles.center}>
      <Ionicons name="person-outline" size={42} color={colors.primary} />
      <Text style={styles.title}>Profile unavailable</Text>
      <Text style={styles.copy}>{profile.error instanceof Error ? profile.error.message : 'This profile could not be opened.'}</Text>
      <Button onPress={() => profile.refetch()}>Try again</Button>
    </View>
  );

  const user = profile.data;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Avatar profile={user} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.title}>@{user.username}</Text>
          </View>
          <Text style={styles.meta}>Joined {formatMonth(user.registeredAt)}</Text>
        </View>

        {user.hidden ? (
          <View style={styles.privateBlock}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <Text style={styles.subtitle}>This reader keeps their profile private</Text>
            <Text style={styles.copy}>Their learning languages and interests are visible to friends.</Text>
          </View>
        ) : (
          <>
            {!!user.fluentLangs?.length && <ProfileSection label="SPEAKS"><Text style={styles.copy}>{user.fluentLangs.map(languageName).join(', ')}</Text></ProfileSection>}
            {!!user.targetLangs?.length && (
              <ProfileSection label="LEARNING">
                <View style={styles.chips}>{user.targetLangs.map((target) => <View key={target.language} style={styles.chip}><Text style={styles.chipText}>{languageName(target.language)} · {target.cefrLevel}</Text></View>)}</View>
              </ProfileSection>
            )}
            {!!user.interests?.length && (
              <ProfileSection label="LIKES"><View style={styles.chips}>{user.interests.map((interest) => <View key={interest} style={styles.neutralChip}><Text style={styles.neutralChipText}>{interest}</Text></View>)}</View></ProfileSection>
            )}
          </>
        )}

        <View style={styles.actions}>
          {user.relationshipStatus === 'STRANGER' && user.acceptsRequests !== false && <Button loading={request.isPending} onPress={() => request.mutate()}>Add friend</Button>}
          {user.relationshipStatus === 'PENDING_INCOMING' && <><Button loading={relationship.isPending} onPress={() => manage('ACCEPT')}>Accept request</Button><Button variant="secondary" onPress={() => manage('REJECT')}>Decline</Button></>}
          {user.relationshipStatus === 'PENDING_OUTGOING' && <Button variant="secondary" onPress={() => manage('CANCEL')}>Cancel request</Button>}
          {user.relationshipStatus === 'FRIENDS' && <Button variant="secondary" onPress={() => manage('UNFRIEND')}>Remove friend</Button>}
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              try {
                await Share.share({ message: `${config.webBaseUrl}/users/${encodeURIComponent(user.username)}` });
              } catch {
                showNotice({ title: 'Could not share profile', message: 'Try again.', tone: 'error' });
              }
            }}
            style={styles.share}>
            <Ionicons name="share-outline" size={19} color={colors.primary} />
            <Text style={styles.shareText}>Share profile</Text>
          </Pressable>
        </View>
      </View>

      {user.relationshipStatus !== 'BLOCKED' && (
        <Pressable
          onPress={() => Alert.alert('Block this reader?', 'They will no longer be able to find or contact you.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await api.blockUser(user.id);
                  await profile.refetch();
                } catch (error) {
                  showNotice({ title: 'Could not block reader', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
                }
              },
            },
          ])}
          style={styles.blockAction}>
          <Text style={styles.blockText}>Block reader</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Avatar({ profile }: { profile: UserProfile }) {
  return <AvatarMark premium={profile.premium} size={92} />;
}

function ProfileSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.eyebrow}>{label}</Text>{children}</View>;
}

function formatMonth(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 38, gap: 13 },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  card: { alignItems: 'center', gap: 18, borderRadius: 30, padding: 24, backgroundColor: colors.surface, ...shadows.card },
  identity: { alignItems: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 27, lineHeight: 34, fontWeight: '600', textAlign: 'center' },
  subtitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 19, lineHeight: 25, fontWeight: '600', textAlign: 'center' },
  meta: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  privateBlock: { alignItems: 'center', gap: 8, borderRadius: 18, padding: 17, backgroundColor: colors.canvas },
  section: { width: '100%', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  chip: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.accentSoft },
  chipText: { color: colors.primaryDark, fontSize: 12, fontWeight: '600' },
  neutralChip: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: colors.line },
  neutralChipText: { color: colors.ink, fontSize: 12, fontWeight: '500' },
  actions: { width: '100%', gap: 9 },
  share: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shareText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  blockAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  blockText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
