Status: done
Created: 2026-07-25
Updated: 2026-07-25

# What people look for in an Obsidian people/relationship workflow

## Question

Do Obsidian users primarily need an explicit relationship-ended state, or do
they mainly want recency, follow-up and relationship context around person
notes?

## Sources and methods

Quick web review on 2026-07-25 of current Obsidian Community plugin listings,
Obsidian Forum discussions and recent r/ObsidianMD discussions. The sample is
qualitative and directional, not a representative user survey.

Sources:

- Arcadia Connect plugin listing:
  https://community.obsidian.md/plugins/arcadia-connect
- Contact Note plugin listing:
  https://community.obsidian.md/plugins/contact-note
- Obsidian Forum, simple CRM suggestions:
  https://forum.obsidian.md/t/trying-to-build-a-simple-crm-in-obsidian-suggestions-ideas/78532
- Obsidian Forum, relationship/contact management with Dataview:
  https://forum.obsidian.md/t/relationship-and-contact-management-with-dataview-when-was-the-last-time-i-called-thought-about-my-friend/27413
- r/ObsidianMD, improving friendships and family relationships:
  https://www.reddit.com/r/ObsidianMD/comments/1nw01hn/how_obsidian_helps_me_be_a_better_friend_and/
- r/ObsidianMD, contact-management recommendations:
  https://www.reddit.com/r/ObsidianMD/comments/1ttlrsa/contact_management_looking_for_recommendations/
- Obsidian Forum, typed wikilinks and relationship metadata:
  https://forum.obsidian.md/t/wikilink-types-type-inside-a-wikilink-to-add-relationship-types-auto-synced-to-yaml-frontmatter/112470

## Findings

### 1. Recency and follow-up are the dominant actionable need

Examples repeatedly center on `last_contact`, next-contact/follow-up dates,
contact cadence, due/overdue views and interaction logs. The current Arcadia
Connect listing explicitly combines last contact, follow-up due dates,
interaction logging and reminders. The community examples use Bases or
Dataview to surface people who are due or overdue rather than to maintain a
formal relationship-ending ledger.

### 2. Users want a fast people index, not only a graph

The recurring baseline is one note per person with searchable/filterable
properties, a simple table/Base, and links to meetings or daily notes. Contact
Note focuses on searchable cards, filtering, sorting, grouping and creation of
new contact notes. A recent community discussion also notes that a global
graph becomes noisy as the number of people grows, so tables/Bases tend to be
the daily interface and graphs an occasional map.

### 3. Interaction context matters more than a single relationship label

Users describe meeting notes, daily notes, backlinks, interaction logs,
topics, cadence and follow-up tasks as the useful context. Relationship types
are still valuable when they clarify a link, but the value is in making that
context authorable and queryable without forcing users to maintain duplicate
records.

### 4. Explicit lifecycle states exist, but they are not a substitute for
recency

Some personal CRM designs use a light status such as active, dormant or
archived. That is a deliberate workflow flag: “archived” means the user has
decided the relationship is done. It is not safely derivable from an old
`last_contact` date because infrequent contact, intentional pause, forgotten
follow-up and a genuinely ended relationship are different situations.

## Conclusion

People Atlas should treat `last_contact` as an observation and follow-up input,
not as an automatic relationship-state detector. A stale date may support a
derived diagnostic such as “no recent contact” or “follow-up overdue”, but it
should not silently change a relationship to `dormant` or `ended`.

For the current P3 decision, the smallest useful contract is likely:

- keep explicit `status` optional and user-authored;
- make recency/follow-up views the primary behavior around `last_contact`;
- if a user explicitly chooses to end a relationship, preserve the note and
  metadata and write a terminal state such as `ended`;
- defer automatic state inference and a separate relationship event history.

This keeps the semantic distinction between “we have not spoken recently” and
“this relationship is over”, while still supporting the users who need an
explicit archive/end decision.

## Limits

The evidence is a small, self-selected sample of public discussions and plugin
descriptions. It indicates recurring patterns but does not establish feature
prevalence, retention or the preferences of People Atlas's eventual users.
