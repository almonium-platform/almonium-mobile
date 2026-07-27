import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';

import { api } from '@/src/api';
import { storage } from '@/src/firebase';
import { colors } from '@/src/theme';
import type { Avatar } from '@/src/types';

const customAvatarPath = 'avatars/users';
const defaultAvatarPath = `${customAvatarPath}/default`;

export function AvatarPicker({ currentAvatarUrl, onChanged }: {
  currentAvatarUrl: string | null;
  onChanged(): Promise<void>;
}) {
  const [defaults, setDefaults] = useState<string[]>([]);
  const [custom, setCustom] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  async function loadAvatars() {
    setLoading(true);
    try {
      const [defaultResult, customResult] = await Promise.all([
        listAll(ref(storage, defaultAvatarPath)).then((result) =>
          Promise.all(result.items.map((item) => getDownloadURL(item))),
        ),
        api.avatars(),
      ]);
      setDefaults(defaultResult);
      setCustom(customResult);
    } catch {
      Alert.alert('Could not load avatars', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAvatars();
  }, []);

  async function chooseDefault(url: string) {
    setSelecting(url);
    try {
      await api.chooseDefaultAvatar(url);
      await onChanged();
    } catch (error) {
      Alert.alert('Could not set avatar', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSelecting(null);
    }
  }

  async function chooseCustom(avatar: Avatar) {
    setSelecting(avatar.id);
    try {
      await api.chooseAvatar(avatar.id);
      await onChanged();
    } catch (error) {
      Alert.alert('Could not set avatar', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSelecting(null);
    }
  }

  async function uploadAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const file = await fetch(asset.uri).then((response) => response.blob());
      const storageRef = ref(storage, `${customAvatarPath}/${randomUUID()}`);
      await uploadBytes(storageRef, file, asset.mimeType ? { contentType: asset.mimeType } : undefined);
      const url = await getDownloadURL(storageRef);
      await api.addAvatar(url);
      await onChanged();
      await loadAvatars();
    } catch (error) {
      Alert.alert('Could not upload avatar', error instanceof Error ? error.message : 'Try another image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable disabled={uploading} onPress={() => void uploadAvatar()} style={styles.uploadButton}>
        <Ionicons name="cloud-upload-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Choose a photo'}</Text>
      </Pressable>
      <Text style={styles.hint}>Or choose one of Almonium’s avatars.</Text>
      {loading ? (
        <Text style={styles.hint}>Loading avatars…</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow}>
          {[...custom.map((avatar) => ({ key: avatar.id, url: avatar.url, onPress: () => chooseCustom(avatar) })), ...defaults.map((url) => ({ key: url, url, onPress: () => chooseDefault(url) }))].map((avatar) => {
            const selected = currentAvatarUrl === avatar.url;
            const busy = selecting === avatar.key || selecting === avatar.url;
            return (
              <Pressable key={avatar.key} disabled={Boolean(selecting) || uploading} onPress={() => void avatar.onPress()} style={[styles.avatarButton, selected && styles.avatarButtonSelected]}>
                <Image source={avatar.url} style={styles.avatar} contentFit="cover" />
                {busy && <View style={styles.busyOverlay}><Text style={styles.busyText}>…</Text></View>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 9 },
  uploadButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white },
  uploadText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  avatarRow: { gap: 10, paddingVertical: 2 },
  avatarButton: { width: 58, height: 58, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  avatarButtonSelected: { borderColor: colors.primary },
  avatar: { width: '100%', height: '100%' },
  busyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000066' },
  busyText: { color: colors.white, fontSize: 24, fontWeight: '600' },
});
