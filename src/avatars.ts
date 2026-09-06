/**
 * A profile's avatar is one of the pictures the clients ship, or the first letter of the name.
 * Nothing is uploaded anywhere. The five animals are addressed by the same URL the web client
 * stores, so a choice made on either client shows on both.
 */
export const animals = ['owl', 'fox', 'stag', 'whale', 'rabbit'] as const;
export type Animal = (typeof animals)[number];

/** Species names live in accessibility labels only, never as a caption under a drawing. */
export const animalLabels: Record<Animal, string> = {
  owl: 'Owl',
  fox: 'Fox',
  stag: 'Stag',
  whale: 'Whale',
  rabbit: 'Hare',
};

const defaultAvatarPath = /assets\/img\/avatars\/default\/(owl|fox|stag|whale|rabbit)\.png(?:[?#].*)?$/;

/** The rendered disc size below which the engraving stops reading and the schematic takes over. */
export const engravingMinimumSize = 48;

/** The URL the web client stores for a bundled animal, on the web origin this build points at. */
export function avatarUrlFor(animal: Animal, webBaseUrl: string) {
  return `${webBaseUrl}/assets/img/avatars/default/${animal}.png`;
}

export function animalFromUrl(avatarUrl: string | null | undefined): Animal | null {
  const match = avatarUrl?.match(defaultAvatarPath)?.[1];
  return (match as Animal | undefined) ?? null;
}

export function avatarLetter(username: string | null | undefined) {
  return username?.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? '·';
}

/**
 * The line schematics, 64×64, stroke 3 for the silhouette and 2.5 for the face. Same silhouette
 * as the engraving, same ink; a single file covers every size below 48.
 */
export const schematics: Record<Animal, { outline: string; detail: string }> = {
  fox: {
    outline: 'M13 12 26 20c4-2 8-2 12 0l13-8-3 20c2 4 3 8 2 12-2 10-9 16-18 16S16 54 14 44c-1-4 0-8 2-12l-3-20Z',
    detail: 'M22 34c3-2 6-2 10 0 4-2 7-2 10 0M27 43l5 4 5-4M32 47v6',
  },
  owl: {
    outline: 'M17 16c8-6 22-6 30 0 5 4 8 12 7 22-1 13-9 21-22 21S11 51 10 38c-1-10 2-18 7-22Z',
    detail: 'M18 30c3-6 10-8 14-2 4-6 11-4 14 2-1 7-6 11-14 14-8-3-13-7-14-14Zm10 1h.1M36 31h.1M29 41l3 5 3-5',
  },
  rabbit: {
    outline: 'M25 27C15 18 15 5 21 4c6-1 10 12 11 22 1-10 5-23 11-22 6 1 6 14-4 23 8 3 13 10 12 18-1 10-8 15-19 15s-18-5-19-15c-1-8 4-15 12-18Z',
    detail: 'M23 41c3-2 6-1 9 3 3-4 6-5 9-3M28 47l4 3 4-3M32 50v5',
  },
  stag: {
    outline: 'M24 27C17 21 11 15 10 7m9 15L18 9m-2 8-7-4m31 14c7-6 13-12 14-20m-9 15 1-13m2 8 7-4M20 30l-8-4 3 10 7 2c-2 5-2 11 0 16 3 5 7 7 10 7s7-2 10-7c2-5 2-11 0-16l7-2 3-10-8 4',
    detail: 'M25 43c4-2 10-2 14 0M28 50l4 3 4-3',
  },
  whale: {
    outline: 'M8 29C16 17 35 13 49 20c5 2 8 6 8 11l5-5c1 6-1 11-6 14-6 11-22 15-37 9C9 45 5 38 8 29Z',
    detail: 'M12 32c10 2 19 6 27 13M20 27h.1M42 22c2-4 5-6 8-7',
  },
};
