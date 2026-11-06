/**
 * The full release history, newest first. Two consumers:
 * - The Changelog screen renders every release.
 * - The "What's new" dialog shows once per user after login (everyone who hasn't dismissed
 *   releases[0] sees it) and renders only the newest two releases. Dismissing stores
 *   releases[0].version in users.seen_version.
 * To announce a release: unshift a new entry (keep newest first — CURRENT_VERSION derives
 * from releases[0]). Old entries stay: they're the changelog.
 */
export interface ChangelogItem {
  title: string;
  body: string;
}
export interface ChangelogRelease {
  version: string;
  date: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '2.11',
    date: 'November 2026',
    items: [
      {
        title: 'Phone keyboard no longer hides the buttons',
        body: 'When the keyboard opens, the screen now shrinks to the space above it — so Show answer, Log in and Add card stay in view instead of sliding under the keys. No more closing the keyboard to tap a button.',
      },
      {
        title: 'Menu moved to the top on phones',
        body: 'The bottom tab bar is gone. Tap the ☰ button at the top right — next to your avatar, or next to the progress bar while studying — to switch between Decks, Add, Community, Språkkafé, League, Stats and Browse.',
      },
      {
        title: 'A leaner study card on phones',
        body: 'Long sentences scale down to fit instead of wrapping into a wall of text, the answer does the same, Again / Hard / Good / Easy sit on one row, and the "New card" label is gone to make room. The edit pencil moved up into the header row, next to the menu.',
      },
      {
        title: 'The cursor is where you need it',
        body: 'The Front field is focused as soon as you open Add (and again after each card you add), and the login screen starts in the Username field. On phones, input text is at least 16px so Safari no longer zooms the page when you tap a field.',
      },
    ],
  },
  {
    version: '2.10',
    date: 'September 2026',
    items: [
      {
        title: 'Rename a deck',
        body: 'On the Add tab, the selected deck now has a little pencil. Click it, type the new name, and click away (or press Enter) to save — Escape cancels. Copies other people already imported keep their own name; the Community catalog shows the new one.',
      },
      {
        title: 'Fixed: example sentences couldn’t be edited',
        body: 'The example under a card’s answer was read-only, and the "Mnemonic" box saved to a separate field. There’s now one "Example sentence" field, editable from Browse and the Study card’s pencil. Anything you had typed as a mnemonic was carried over.',
      },
    ],
  },
  {
    version: '2.9',
    date: 'August 2026',
    items: [
      {
        title: 'Ask for what you’re missing',
        body: 'The new Requests tab is a little voting board: post a feature request, upvote the ones you want, and watch their status move from open to planned to done.',
      },
      {
        title: 'A full changelog',
        body: 'Every release, newest first, in the new Changelog tab — so "what changed?" no longer disappears after this dialog closes.',
      },
    ],
  },
  {
    version: '2.8',
    date: 'August 2026',
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
    date: 'August 2026',
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
    date: 'August 2026',
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
    date: 'August 2026',
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
    date: 'August 2026',
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
  },
];

/** The version that gates the dialog: dismissing stores this. */
export const CURRENT_VERSION = CHANGELOG[0].version;
