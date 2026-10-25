from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    """Bound JSON/base64 request bodies before FastAPI parses them, including chunked requests."""

    def __init__(self, app, max_bytes=8 * 1024 * 1024):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        response = JSONResponse({"detail": "Body permintaan maksimal 8 MiB"}, status_code=413)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0
        if declared > self.max_bytes:
            return await response(scope, receive, send)
        parts, length = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body = message.get("body", b"")
            length += len(body)
            if length > self.max_bytes:
                return await response(scope, receive, send)
            parts.append(body)
            if not message.get("more_body", False):
                break
        buffered = b"".join(parts)
        consumed = False

        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": buffered, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
