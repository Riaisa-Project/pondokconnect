import asyncio

from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


def forwarded_scope(environment, client, header):
    from backend.proxy import forwarded_hosts

    seen = {}

    async def app(scope, receive, send):
        seen.update(client=scope["client"], scheme=scope["scheme"])

    scope = {
        "type": "http",
        "client": (client, 1234),
        "scheme": "http",
        "headers": [(b"x-forwarded-for", header.encode()), (b"x-forwarded-proto", b"https")],
    }
    middleware = ProxyHeadersMiddleware(app, trusted_hosts=forwarded_hosts(environment))
    asyncio.run(middleware(scope, None, None))
    return seen


def test_render_visitors_retain_distinct_ips_through_private_and_cloudflare_proxies():
    first = forwarded_scope({"RENDER": "true"}, "10.0.0.5", "192.0.2.250, 198.51.100.10, 173.245.48.1")
    second = forwarded_scope({"RENDER": "true"}, "10.0.0.5", "192.0.2.250, 198.51.100.11, 173.245.48.1")
    assert first["client"][0] == "198.51.100.10"
    assert second["client"][0] == "198.51.100.11"
    assert first["scheme"] == second["scheme"] == "https"


def test_direct_untrusted_clients_cannot_spoof_forwarded_identity():
    result = forwarded_scope({}, "203.0.113.9", "198.51.100.99")
    assert result["client"][0] == "203.0.113.9"
    assert result["scheme"] == "http"
