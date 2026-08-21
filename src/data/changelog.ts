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
  {
    version: '2.6',
    items: [
      {
        title: 'Edit cards anywhere',
        body: 'Fix a typo the moment you spot it: every card in Browse has an Edit button, and the study card has a pencil in its corner. Edits never touch your review schedule.',
      },
      {
        title: 'Sort Browse by trouble',
        body: 'A new "Most missed" sort puts your hardest cards first, and cards you miss often carry a warning badge — hover it for your miss count.',
      },
    ],
  },
];

/** The version that gates the dialog: dismissing stores this. */
export const CURRENT_VERSION = CHANGELOG[0].version;
