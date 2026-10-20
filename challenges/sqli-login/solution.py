def login(conn, username, password):
    query = "SELECT id, username, role FROM users WHERE username = ? AND password = ?"
    return conn.execute(query, (username, password)).fetchone()
