from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.main import app
from backend.models.models import Pendaftaran, Ponpes
from backend.tests.test_workflows import registration


@pytest.mark.mysql
def test_concurrent_last_seat_is_reserved_once(client, db, engine, factory):
    if engine.dialect.name != "mysql":
        pytest.skip("Row locking must be tested against MySQL")
    row = db.get(Ponpes, 1)
    row.kuota_putra = 1
    db.commit()
    barrier = Barrier(2)

    def submit(nik):
        with TestClient(app) as tc:
            barrier.wait(timeout=10)
            return tc.post("/pendaftaran/kirim", json=registration(nik_santri=nik)).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit, ["1111111111111111", "2222222222222222"]))
    assert sorted(results) == [201, 409]
    with factory() as check:
        assert check.scalar(select(func.count(Pendaftaran.id))) == 1


@pytest.mark.mysql
def test_authenticated_quota_change_observes_commit_while_waiting(client, admin, engine, factory):
    """Catch a stale snapshot created by authentication before the quota row lock."""
    if engine.dialect.name != "mysql":
        pytest.skip("Transaction isolation must be tested against MySQL")
    from threading import Event, get_ident

    from sqlalchemy import event

    lock_attempt = Event()
    main_thread = get_ident()

    def observe_lock(conn, cursor, statement, parameters, context, executemany):
        if get_ident() != main_thread and "FROM ponpes" in statement and "FOR UPDATE" in statement:
            lock_attempt.set()

    event.listen(engine, "before_cursor_execute", observe_lock)
    try:
        with factory() as blocker:
            blocker.execute(select(Ponpes).where(Ponpes.id == 1).with_for_update())
            blocker.add(Pendaftaran(**registration(), nomor_registrasi="REG-202610-RACETEST00000001"))
            blocker.flush()
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(client.put, "/admin/ponpes/my", headers=admin, json={"kuota_putra": 0})
                reached_lock = lock_attempt.wait(timeout=10)
                blocker.commit()
                assert reached_lock, "Admin request did not reach ponpes lock"
                assert future.result(timeout=10).status_code == 409
        with factory() as check:
            assert check.get(Ponpes, 1).kuota_putra == 50
    finally:
        event.remove(engine, "before_cursor_execute", observe_lock)
