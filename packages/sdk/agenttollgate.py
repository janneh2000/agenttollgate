"""AgentTollgate Python SDK.

Drop-in client for AI agents that want to call paywalled APIs. Handles
the 402 -> CheckoutWithLocus -> retry round-trip transparently.

    from agenttollgate import Tollgate

    tg = Tollgate(agent_id="agent_acme_42")
    out = tg.call("image-gen-pro", body={"prompt": "tollbooth"})
    print(out.body, out.paid_micros)

Requires httpx (or substitute requests by overriding `_request`).
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

import httpx


@dataclass
class CallResult:
    ok: bool
    status: int
    body: Any
    paid_micros: int
    session_id: str
    latency_ms: int


class TollgateError(Exception):
    pass


class PaymentRequired(TollgateError):
    def __init__(self, payload: Dict[str, Any]):
        self.payload = payload
        super().__init__(payload.get("reason", "payment_required"))


class Tollgate:
    def __init__(
        self,
        agent_id: str,
        base_url: str = "https://agenttollgate.dev",
        pay: Optional[Callable[[Dict[str, Any]], None]] = None,
        timeout: float = 30.0,
    ):
        self.agent_id = agent_id
        self.base_url = base_url.rstrip("/")
        self.pay = pay or self._default_pay
        self.timeout = timeout
        self._http = httpx.Client(timeout=timeout)

    def call(
        self,
        slug: str,
        body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        max_usdc: Optional[float] = None,
    ) -> CallResult:
        url = f"{self.base_url}/api/proxy/{slug}"
        h = {
            "x-agent-id": self.agent_id,
            "content-type": "application/json",
        }
        if headers:
            h.update(headers)

        start = time.time()
        method = "POST" if body is not None else "GET"
        r = self._http.request(
            method, url, headers=h, content=json.dumps(body) if body is not None else None
        )
        if r.status_code == 402:
            pr = r.json()
            if max_usdc is not None and float(pr["price"]["amount_usdc"]) > max_usdc:
                raise TollgateError(
                    f"tollgate price {pr['price']['amount_usdc']} USDC exceeds max {max_usdc}"
                )
            self.pay(pr)
            h["x-locus-receipt"] = pr["session_id"]
            r = self._http.request(
                method, url, headers=h, content=json.dumps(body) if body is not None else None
            )

        ct = r.headers.get("content-type", "")
        body_out: Any = r.json() if "application/json" in ct else r.text
        return CallResult(
            ok=200 <= r.status_code < 400,
            status=r.status_code,
            body=body_out,
            paid_micros=int(r.headers.get("x-tollgate-amount-micros", "0")),
            session_id=r.headers.get("x-tollgate-session", ""),
            latency_ms=int((time.time() - start) * 1000),
        )

    def catalog(
        self,
        q: Optional[str] = None,
        max_usdc: Optional[float] = None,
        category: Optional[str] = None,
    ):
        params: Dict[str, Any] = {}
        if q:
            params["q"] = q
        if max_usdc is not None:
            params["max_usdc"] = max_usdc
        if category:
            params["category"] = category
        r = self._http.get(f"{self.base_url}/api/catalog", params=params)
        r.raise_for_status()
        return r.json()

    # Mock-mode default — Locus-real users replace with a callable that
    # speaks the Locus client SDK.
    def _default_pay(self, pr: Dict[str, Any]) -> None:
        self._http.post(pr["pay_url"])
