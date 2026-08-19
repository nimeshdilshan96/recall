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
];

/** The version that gates the dialog: dismissing stores this. */
export const CURRENT_VERSION = CHANGELOG[0].version;
