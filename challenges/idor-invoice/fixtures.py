def make_db():
    return {
        101: {"id": 101, "owner_id": 1, "item": "Pentest retainer", "amount": 4200},
        102: {"id": 102, "owner_id": 2, "item": "Bob's salary advance", "amount": 9000},
        103: {"id": 103, "owner_id": 1, "item": "Cloud hosting", "amount": 310},
    }


ALICE = {"id": 1, "role": "user"}
BOB = {"id": 2, "role": "user"}
ADMIN = {"id": 99, "role": "admin"}
