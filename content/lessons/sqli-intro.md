# How SQL injection works

Most developers learn to make code *work*. Attackers learn to make code do something **else**.

## The bug

A login form sends a username and password to the server. The server builds a SQL query by gluing strings together:

```python
query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'"
```

If the user types `alice` and `wonderland`, the database receives:

```sql
SELECT * FROM users WHERE username = 'alice' AND password = 'wonderland'
```

But if the user types `' OR 1=1 --` as the username:

```sql
SELECT * FROM users WHERE username = '' OR 1=1 --' AND password = ''
```

`OR 1=1` is always true and `--` turns the rest of the line into a comment, so the password check disappears. The attacker is logged in as the first user in the table - often the admin.

The root cause: **data was allowed to become code.**

## The fix: parameterized queries

Send the SQL *shape* and the *values* separately. The database never treats values as SQL.

```python
conn.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
```

## Things that do NOT fix it

- Removing or escaping quote characters by hand (breaks real names like *O'Brien* and is easy to bypass).
- Checking the input in JavaScript on the page - attackers skip the page and talk to your API directly.
- Blocking the word `OR`.

## Defence in depth

Use a database account with the least privileges it needs, never show raw database errors to users, and hash passwords with bcrypt or argon2.

**Next:** open the challenge, break the login, then fix it.
