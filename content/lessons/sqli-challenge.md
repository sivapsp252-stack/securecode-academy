# Challenge: break and fix the login

The editor holds the server-side `login()` function of a small web app. It is vulnerable.

## Step 1 - Exploit

Use **Attack the app** and log in as someone without knowing their password.
Read the *SQL the database executed* panel and notice how your input changed the query.

## Step 2 - Patch

Rewrite `login()` so values are passed as **parameters** (`?` placeholders), not concatenated into the SQL string.

## Step 3 - Prove it

Press **Submit patch**. Your code runs against a hidden test suite inside the sandbox:

- legitimate users, including `o'brien`, must still be able to log in
- a set of injection payloads must all be rejected

Pass every test to earn **150 XP** and finish the module for the **SQL Slayer** badge.
