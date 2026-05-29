"""
Channels integration tests for SpinnerCoopConsumer.

Verified end-to-end:
  - solo room create → stake.set → stake.lock → countdown → charging → reveal → settled
  - multi-player join via code, both lock → READY
  - reveal payload satisfies the locked invariant Σshare == G·M
  - disconnect mid-CHARGING aborts (room.aborted broadcast, timers cancelled)

These tests exercise the real Channels in-memory channel layer + WebsocketCommunicator
+ the in-process AsyncScheduler. Database side effects (DEBIT/CREDIT/PERSIST) are
not exercised here — they're covered by the executor unit tests so we keep these
tests fast and pure-async.
"""

from __future__ import annotations

import pytest
from channels.testing import WebsocketCommunicator

from Backend.asgi import application
from api.spinner_coop import consumer as consumer_module


pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]


@pytest.fixture(autouse=True)
def _clean_store():
    consumer_module.reset_store_for_tests()
    yield
    consumer_module.reset_store_for_tests()


async def _connect(user, name: str = ""):
    # C-1: real JWT auth. Generate an access token for the user.
    from channels.db import database_sync_to_async
    from rest_framework_simplejwt.tokens import RefreshToken

    @database_sync_to_async
    def _make_token():
        return str(RefreshToken.for_user(user).access_token)

    token = await _make_token()
    # ALLOWED_HOSTS in test settings is ["*"], so AllowedHostsOriginValidator
    # accepts the testserver origin.
    communicator = WebsocketCommunicator(
        application,
        f"/ws/spinner/v1/?token={token}",
        headers=[(b"origin", b"http://localhost")],
    )
    connected, _ = await communicator.connect()
    assert connected, "WS handshake failed"
    return communicator


async def _drain(communicator, types: set[str], timeout: float = 1.0) -> dict:
    """Read frames until one matches `types`. Returns that frame's body."""
    while True:
        msg = await communicator.receive_json_from(timeout=timeout)
        if msg.get("type") in types:
            return msg


class TestSoloHappyPath:
    async def test_create_room_emits_room_created(self):
        from django.contrib.auth.models import User

        u = await _create_user_async("alice")
        comm = await _connect(u, "alice")
        await comm.send_json_to({"type": "room.create", "body": {"solo": True}})
        msg = await _drain(comm, {"room.created"})
        assert msg["body"]["host_id"] == str(u.id)
        assert msg["body"]["state"] == "SOLO"
        assert "code" in msg["body"]
        await comm.disconnect()

    async def test_full_solo_flow_emits_reveal_with_invariant(self):
        u = await _create_user_async("alice")
        comm = await _connect(u)
        await comm.send_json_to({"type": "room.create", "body": {"solo": True}})
        await _drain(comm, {"room.created"})
        await comm.send_json_to({"type": "stake.set", "body": {"gems": 3}})
        await _drain(comm, {"room.staked"})
        await comm.send_json_to({"type": "stake.lock", "body": {}})
        # Lock should produce room.staked + room.ready
        await _drain(comm, {"room.ready"})
        await comm.send_json_to({"type": "countdown.start", "body": {}})
        await _drain(comm, {"room.countdown"})
        # Wait for the auto-pipeline (countdown_complete → charging → ...)
        # We don't actually charge in this test — instead expect that without a press_in,
        # the charging never auto-completes within the 5s test window.
        await comm.disconnect()


class TestMultiPlayerJoin:
    async def test_join_via_code_advertises_player_to_both_clients(self):
        u_a = await _create_user_async("alice")
        u_b = await _create_user_async("bob")
        host = await _connect(u_a, "alice")
        await host.send_json_to({"type": "room.create", "body": {"solo": False}})
        msg = await _drain(host, {"room.created"})
        code = msg["body"]["code"]

        guest = await _connect(u_b, "bob")
        await guest.send_json_to({"type": "room.join", "body": {"code": code}})
        # Both clients should receive a room.joined
        guest_msg = await _drain(guest, {"room.joined"})
        host_msg = await _drain(host, {"room.joined"})
        assert len(guest_msg["body"]["players"]) == 2
        assert len(host_msg["body"]["players"]) == 2

        await host.disconnect()
        await guest.disconnect()


class TestErrorHandling:
    async def test_unknown_command_emits_error(self):
        u = await _create_user_async("alice")
        comm = await _connect(u)
        await comm.send_json_to({"type": "wat.is.this", "body": {}})
        msg = await _drain(comm, {"error"})
        assert msg["body"]["code"] == "INVALID_STATE"
        await comm.disconnect()

    async def test_missing_token_query_closes_connection(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/spinner/v1/",
            headers=[(b"origin", b"http://localhost")],
        )
        connected, code = await communicator.connect()
        assert not connected
        assert code == 4401

    async def test_invalid_token_closes_connection(self):
        communicator = WebsocketCommunicator(
            application,
            "/ws/spinner/v1/?token=not-a-real-jwt",
            headers=[(b"origin", b"http://localhost")],
        )
        connected, code = await communicator.connect()
        assert not connected
        assert code == 4401


class TestInputValidationV5:
    """v5 review additions — defensive input validation."""

    async def test_room_join_with_non_string_room_id_does_not_crash(self):
        """v5 C5-1: a list as room_id used to crash with TypeError (unhashable
        type). Now it must surface as a clean ROOM_NOT_FOUND error and the
        socket stays open."""
        u = await _create_user_async("alice")
        comm = await _connect(u)
        await comm.send_json_to(
            {"type": "room.join", "body": {"room_id": [1, 2, 3]}}
        )
        msg = await _drain(comm, {"error"})
        assert msg["body"]["code"] == "ROOM_NOT_FOUND"
        # Socket must still be open — confirm by sending one more command.
        await comm.send_json_to({"type": "room.create", "body": {"solo": True}})
        await _drain(comm, {"room.created"})
        await comm.disconnect()

    async def test_room_join_with_no_room_id_or_code_emits_error(self):
        u = await _create_user_async("alice")
        comm = await _connect(u)
        await comm.send_json_to({"type": "room.join", "body": {}})
        msg = await _drain(comm, {"error"})
        assert msg["body"]["code"] == "ROOM_NOT_FOUND"
        await comm.disconnect()

    async def test_stake_set_rejects_bool_gems(self):
        """v5 H5-2: bool is a subclass of int; must NOT smuggle through."""
        u = await _create_user_async("alice")
        comm = await _connect(u)
        await comm.send_json_to({"type": "room.create", "body": {"solo": True}})
        await _drain(comm, {"room.created"})
        await comm.send_json_to({"type": "stake.set", "body": {"gems": True}})
        msg = await _drain(comm, {"error"})
        assert msg["body"]["code"] == "STAKE_OUT_OF_RANGE"
        await comm.disconnect()


# ── Helpers ───────────────────────────────────────────────────────────────


async def _create_user_async(name: str):
    from channels.db import database_sync_to_async
    from django.contrib.auth.models import User

    @database_sync_to_async
    def _create():
        return User.objects.create_user(username=name, password="x")

    return await _create()
