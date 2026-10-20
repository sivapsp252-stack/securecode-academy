# SecureCode Academy - Challenge: SQL Injection in a login form
#
# login() is called by the web app for every login attempt.
# It must return the user's row if the credentials are correct, otherwise None.
#
# 1) Use "Attack the app" to bypass the login without knowing a password.
# 2) Patch this function, then press "Submit patch" to run the test suite.
#
# (Passwords are stored in plain text ONLY to keep this lab small.
#  Real apps must hash them with bcrypt/argon2.)

def login(conn, username, password):
    query = (
        "SELECT id, username, role FROM users "
        "WHERE username = '" + username + "' AND password = '" + password + "'"
    )
    return conn.execute(query).fetchone()
