# How IDOR works

**IDOR** (Insecure Direct Object Reference) is a form of *Broken Access Control*, the #1 risk in the OWASP Top 10.

## The bug

An API lets a logged-in user fetch their invoice:

```
GET /api/invoices/101
```

The server checks that you are logged in - but never checks that invoice `101` is **yours**:

```python
def get_invoice(db, current_user, invoice_id):
    return db.get(invoice_id)
```

Change `101` to `102` and you read someone else's invoice. Scripts can try every number in seconds.

## The fix: authorize every object access

Authentication answers *who are you?* Authorization answers *may you touch this?* Check it on the server, on every request:

```python
invoice = db.get(invoice_id)
if invoice is None or invoice["owner_id"] != current_user["id"]:
    return None   # same answer for "missing" and "not yours"
```

## Good habits

- Never trust an ID from the client. Look the object up and compare its owner to the session user.
- Return the same response for "does not exist" and "not allowed" so attackers cannot probe for valid IDs.
- Random IDs (UUIDs) are *extra* protection, not a replacement for the ownership check.
- Write tests where user A tries to read user B's data.

**Next:** open the challenge and lock down the invoice API.
