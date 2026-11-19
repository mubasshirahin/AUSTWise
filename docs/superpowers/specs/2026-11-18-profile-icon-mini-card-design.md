# Profile icon → mini stats card everywhere (short design)

**Intent:** Every profile icon behaves like the Student Directory: hover/click
opens the mini stats card; the profile opens only via "View profile" on the card.

**Goals**
- Notice Board: poster avatar on each notice card opens the mini card.
- Same for: Messages header, Mentor Requests, Admin Panel (2 lists), Batch Drive.
- Remove the bell-icon stats popover added earlier (JSX + CSS).

**Non-goals:** Active Members keeps its own popover (live presence dot).

**Anti-goals:** No gradients/glows (house style). Clicking the avatar must not
toggle the notice expand.

**Approach (chosen):** reuse `MemberAvatarPreview` (`src/features/community/DirectoryShared.jsx`).
Rejected: new card component (duplication); reusing `MemberPopover` (gradient banner).

**Data:** notices store only name/role/section → look up the poster by
`postedBy` in `getCachedMembers()`; fall back to notice fields.

**Builder's calls:** exact stats rows per site, avatar sizes, click stopPropagation.

**Done when:** desktop + mobile, card opens above neighbours, inside viewport, build passes.
