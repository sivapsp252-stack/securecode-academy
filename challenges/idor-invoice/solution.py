def get_invoice(db, current_user, invoice_id):
    invoice = db.get(invoice_id)
    if invoice is None:
        return None
    if current_user["role"] == "admin" or invoice["owner_id"] == current_user["id"]:
        return invoice
    return None
