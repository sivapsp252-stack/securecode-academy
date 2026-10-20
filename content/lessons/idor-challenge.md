# Challenge: lock down the invoice API

You are logged in as **alice (user #1)**. Her invoices are `101` and `103`.

## Step 1 - Exploit

Use **Attack the app** to request invoice `102`. Whose is it, and why were you allowed to read it?

## Step 2 - Patch

Update `get_invoice()` so that:

- owners can read their own invoices
- admins can read any invoice
- everyone else gets `None` (or a `PermissionError`)

## Step 3 - Prove it

Press **Submit patch**. The hidden tests check owners, another user, an admin, and an unknown ID.

Pass all of them to earn **150 XP** and the **IDOR Inspector** badge.
