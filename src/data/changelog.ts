/**
 * The "What's new" dialog content. Shown once per user (per version) after login;
 * dismissing it stores `version` in users.seen_version. To announce a release:
 * bump `version` and rewrite `items` — only the newest release is ever shown.
 */
export interface ChangelogItem {
  title: string;
  body: string;
}

export const CHANGELOG: { version: string; items: ChangelogItem[] } = {
  version: '2.4',
  items: [
    {
      title: 'Share decks with anyone',
      body: 'Make a deck public with the padlock and it shows up under Community for everyone on this server — they get their own copy, and can pull new cards you add later.',
    },
    {
      title: 'Fill-in-the-blank cards',
      body: 'A new card type for learning words in context. Type a sentence with ___ where the answer goes.',
    },
    {
      title: 'Focus drills for trouble words',
      body: 'Stats now ranks the cards you miss most. Drill them off-schedule without touching your review dates.',
    },
  ],
};
