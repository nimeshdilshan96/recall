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
    version: '2.8',
    items: [
      {
        title: 'Språkkafé: practise for real',
        body: 'A new tab lists Norwegian language cafés around Oslo for the next 7 days (from deichman.no). Say you’re going or can’t make it — and hover the "going" count to see who else will be there.',
      },
      {
        title: 'Due cards unlock at the start of the day',
        body: 'Cards due today are ready from the start of the day, Anki-style — no more waiting until the exact minute you reviewed them yesterday. The day rolls over at 4 AM, so a late-night session still counts as today. Short learning steps keep their exact timing.',
      },
    ],
  },
  {
    version: '2.7',
    items: [
      {
        title: 'Spot new cards at a glance',
        body: 'Cards you haven’t studied yet carry a NEW badge in Browse, and a "New first" sort floats them to the top.',
      },
      {
        title: 'Tune how new cards arrive',
        body: 'The daily new-card limit now adjusts by 1, and a new setting picks which unseen cards a session introduces: oldest first, newest first, or random.',
      },
      {
        title: 'Daily goals, made honest',
        body: 'Goals now show your exact progress ("3 of 12 reviews done"), and the new-cards goal targets your own daily limit instead of a fixed 20.',
      },
    ],
  },
];

/** The version that gates the dialog: dismissing stores this. */
export const CURRENT_VERSION = CHANGELOG[0].version;
