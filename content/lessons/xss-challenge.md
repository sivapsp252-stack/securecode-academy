# Challenge: stop the comment hijack

The editor holds `renderComment()`, which the page uses with `innerHTML`.

## Step 1 - Exploit

Type a comment that runs JavaScript, then press **Post comment**. The widget runs inside a locked-down iframe, so it is safe to try. If your script calls `alert()`, the platform shows **XSS executed**.

## Step 2 - Patch

Change `renderComment()` so the comment is always displayed as **text**. Write an `escapeHtml` helper that encodes `& < > " '`.

## Step 3 - Prove it

Press **Run tests**. Your function is checked against six attack payloads, and two normal comments must still look right (including `I <3 secure code & 5 > 3`).

Pass everything to earn **150 XP** and the **XSS Hunter** badge.
