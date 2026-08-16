/**
 * The "What's new" dialog content. Shown once per user after login: everyone who hasn't
 * dismissed the NEWEST version (releases[0]) sees the dialog, which renders every release
 * in this list (keep it to the last 1–2). Dismissing stores releases[0].version in
 * users.seen_version. To announce a release: unshift a new entry and trim old ones.
 */
export interface ChangelogItem {
  title: string;
  body: string;
}
export interface ChangelogRelease {
  version: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '2.5',
    items: [
      {
        title: 'Watch your progress grow',
        body: 'Stats has a new "Mature cards over time" chart. See your long-term memory grow day by day, with 1W / 1M / 3M / 1Y views.',
      },
      {
        title: 'A full-year calendar',
        body: 'The activity calendar now shows the whole year at a glance, with month labels.',
      },
      {
        title: 'Numbers on hover',
        body: 'Hover any chart to see the exact numbers for that day.',
      },
    ],
  },
  {
    version: '2.4',
    items: [
      {
        title: 'Share decks with anyone',
        body: 'Make a deck public with the padlock and it shows up under Community for everyone on this server. They get their own copy, and can pull new cards you add later.',
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
  },
];

/** The version that gates the dialog: dismissing stores this. */
export const CURRENT_VERSION = CHANGELOG[0].version;
