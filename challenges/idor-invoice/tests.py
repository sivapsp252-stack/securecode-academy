import sys, json
from fixtures import make_db, ALICE, BOB, ADMIN

cfg = json.loads(sys.stdin.read())
NONCE = cfg["nonce"]
_print, _dumps = print, json.dumps

import _guard
_guard.arm()

results = []


def emit():
    _print("@@RESULT@@" + NONCE + _dumps({"tests": results}, default=str), flush=True)


def check(name, fn):
    try:
        ok, detail = fn()
    except BaseException as e:
        ok, detail = False, "Raised " + repr(e)
    results.append({"name": name, "passed": bool(ok), "detail": detail})


try:
    import user_code
    get_invoice = user_code.get_invoice
except BaseException as e:
    results.append({"name": "Code loads and defines get_invoice()", "passed": False, "detail": repr(e)})
    emit()
    sys.exit(0)


def allowed(user, inv_id):
    def run():
        inv = get_invoice(make_db(), dict(user), inv_id)
        ok = isinstance(inv, dict) and inv.get("id") == inv_id
        return ok, "Invoice returned." if ok else "Legitimate access was denied."
    return run


def denied(user, inv_id):
    def run():
        try:
            inv = get_invoice(make_db(), dict(user), inv_id)
        except (PermissionError, LookupError):
            return True, "Access refused."
        return (inv is None, "Access refused." if inv is None else "Someone else's invoice was returned (IDOR still present).")
    return run


check("Owner can read own invoice (alice -> 101)", allowed(ALICE, 101))
check("Owner can read another own invoice (alice -> 103)", allowed(ALICE, 103))
check("Blocks alice reading bob's invoice (102)", denied(ALICE, 102))
check("Blocks bob reading alice's invoice (101)", denied(BOB, 101))
check("Admin can read any invoice (admin -> 102)", allowed(ADMIN, 102))
check("Unknown invoice id returns nothing (999)", denied(ALICE, 999))
emit()
