# SecureCode Academy - Challenge: IDOR (Broken Object Level Authorization)
#
# get_invoice() backs  GET /api/invoices/<invoice_id>
#   db           : dict of invoice_id -> invoice
#   current_user : {"id": 1, "role": "user"}  (already authenticated)
#   invoice_id   : taken straight from the URL
#
# Return the invoice if the caller may see it, otherwise return None.
# Rules: owners can read their own invoices, admins can read any invoice.

def get_invoice(db, current_user, invoice_id):
    return db.get(invoice_id)
