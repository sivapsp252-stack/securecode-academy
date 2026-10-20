import sys, json, ast
from fixtures import make_db

cfg = json.loads(sys.stdin.read())
NONCE = cfg["nonce"]
_print, _dumps = print, json.dumps
SRC = open("user_code.py").read()

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
    login = user_code.login
except BaseException as e:
    results.append({"name": "Code loads and defines login()", "passed": False, "detail": repr(e)})
    emit()
    sys.exit(0)


def static_check():
    tree = ast.parse(SRC)
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)
             and isinstance(n.func, ast.Attribute)
             and n.func.attr in ("execute", "executemany", "executescript")]
    if not calls:
        return False, "No .execute() call found."
    for c in calls:
        if c.func.attr == "executescript":
            return False, "executescript() cannot take parameters."
        if len(c.args) < 2:
            return False, "execute() must receive the values as a second argument (placeholders), not inside the SQL string."
        q = c.args[0]
        if isinstance(q, ast.JoinedStr) or (isinstance(q, ast.BinOp) and isinstance(q.op, (ast.Add, ast.Mod))) \
                or (isinstance(q, ast.Call) and isinstance(q.func, ast.Attribute) and q.func.attr == "format"):
            return False, "The SQL string is still built with +, %, f-string or .format()."
    return True, "All queries pass values separately from the SQL text."


def legit(u, p):
    def run():
        row = login(make_db(), u, p)
        return (row is not None, "Valid credentials were rejected." if row is None else "Login accepted.")
    return run


def rejected(u, p):
    def run():
        row = login(make_db(), u, p)
        return (row is None, "Login was bypassed - the injection still works." if row is not None else "Rejected.")
    return run


check("Uses parameterized queries (static check)", static_check)
check("Valid login still works (admin)", legit("admin", "S3cr3t!Adm1n"))
check("Valid login with apostrophes works (o'brien)", legit("o'brien", "pass'word"))
check("Wrong password is rejected", rejected("admin", "wrong"))
check("Blocks  ' OR 1=1 --  in username", rejected("' OR 1=1 --", "x"))
check("Blocks  admin' --  (comment out the password check)", rejected("admin' --", ""))
check("Blocks  ' OR '1'='1  in password", rejected("admin", "' OR '1'='1"))
check("Blocks UNION-based injection", rejected("' UNION SELECT 1,'hacker','admin' --", "x"))
emit()
