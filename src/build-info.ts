/**
 * The line on the settings page that says which code is running. Version and build number come
 * from the native shell; the commit and time come from whichever JS bundle is live, which is an
 * EAS Update more often than the one the shell shipped with. Reading the short commit against
 * `git log` is the whole point, so it leads.
 */
export type BuildFacts = {
  version: string | null;
  build: string | null;
  commit: string;
  embedded: boolean;
  updatedAt: Date | null;
  channel: string | null;
  runtimeVersion: string | null;
};

export function shortCommit(sha: string) {
  return sha.trim().slice(0, 7);
}

export function buildStamp(facts: BuildFacts, formatTime: (date: Date) => string) {
  const shell = [facts.version, facts.build ? `(${facts.build})` : ''].filter(Boolean).join(' ');
  const commit = facts.commit ? shortCommit(facts.commit) : null;
  const source = facts.embedded ? 'bundled' : 'update';
  const detail = [commit ? `${source} ${commit}` : source, facts.updatedAt ? formatTime(facts.updatedAt) : null]
    .filter(Boolean)
    .join(' · ');
  const note = [facts.channel, facts.runtimeVersion ? `runtime ${facts.runtimeVersion.slice(0, 12)}` : null].filter(Boolean).join(' · ');
  return { headline: shell || '—', detail, note, clipboard: [shell, detail, note].filter(Boolean).join('\n') };
}
