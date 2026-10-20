import sqlite3


def make_db():
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT);
        INSERT INTO users (username, password, role) VALUES
            ('admin',   'S3cr3t!Adm1n', 'admin'),
            ('alice',   'wonderland',   'user'),
            ('o''brien','pass''word',   'user');
    """)
    return conn
