"""Web Designer: founder-only, validated, preview before publish, history + rollback, safe image uploads."""
import base64

import pytest

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40


def up(c, data, name="hero.png"):
    return c.post("/api/brain/site-assets", json={"name": name, "data_b64": base64.b64encode(data).decode()})


def test_only_the_founder_can_edit(client):
    assert client.get("/api/brain/site-design").status_code in (401, 403)
    assert client.put("/api/brain/site-design", json={"design": {}}).status_code in (401, 403)
    assert up(client, PNG).status_code in (401, 403)
    assert client.get("/api/public/site-design").json()["version"] == 0       # public read works, built-in design


@pytest.mark.parametrize("bad", [
    {"theme": {"gold": "red"}}, {"theme": {"gold": "#fff; background:url(x)"}}, {"theme": {"radius": 999}},
    {"theme": {"button": "<script>"}}, {"theme": {"css": "body{display:none}"}}, {"heroes": {"admin": {}}},
    {"heroes": {"home": {"image": "img_0000000000000000"}}}, {"heroes": {"home": {"shade": 120}}}, {"html": "<b>x</b>"},
])
def test_only_safe_structured_settings(founder, bad):
    r = founder.put("/api/brain/site-design", json={"design": bad})
    assert r.status_code == 400, r.text


def test_draft_preview_publish_rollback(founder):
    d = founder.get("/api/brain/site-design").json()
    assert d["changed"] is False and set(d["sections"]) >= {"home", "values", "green"}
    img = up(founder, PNG).json()
    assert img["mime"] == "image/png"
    design = {"theme": {"gold": "#E0B060", "button": "pill", "heading_scale": 1.1}, "heroes": {"values": {"image": img["id"], "shade": 40, "focus_x": 30}}}
    r = founder.put("/api/brain/site-design", json={"design": design}).json()
    assert r["changed"] is True and r["draft"]["theme"]["gold"] == "#e0b060"
    pub = founder.get("/api/public/site-design").json()
    assert pub["design"]["theme"]["gold"] == "#ffb83e"                            # not live until published
    tok = founder.post("/api/brain/site-design/preview").json()["token"]
    prev = founder.get(f"/api/public/site-design?preview={tok}")
    assert prev.json()["preview"] is True and prev.json()["design"]["heroes"]["values"]["image"] == img["id"]
    assert prev.headers["cache-control"] == "no-store"
    assert founder.get("/api/public/site-design?preview=guess").json()["preview"] is False
    v1 = founder.post("/api/brain/site-design/publish", json={"note": "warmer gold"}).json()["version"]
    live = founder.get("/api/public/site-design").json()
    assert live["version"] == v1 and live["design"]["theme"]["button"] == "pill"
    founder.put("/api/brain/site-design", json={"design": {"theme": {"gold": "#00ff00"}}})
    v2 = founder.post("/api/brain/site-design/publish").json()["version"]
    assert v2 == v1 + 1
    founder.post("/api/brain/site-design/restore", json={"version": v1})            # rollback = restore + publish
    founder.post("/api/brain/site-design/publish", json={"note": "rollback"})
    assert founder.get("/api/public/site-design").json()["design"]["theme"]["gold"] == "#e0b060"
    hist = founder.get("/api/brain/site-design").json()["history"]
    assert [h["version"] for h in hist][:3] == [v2 + 1, v2, v1]


def test_image_uploads_are_checked_and_served_safely(founder):
    assert up(founder, b"<html><script>alert(1)</script></html>", "x.png").status_code == 400   # content, not name, decides
    assert up(founder, b"GIF89a" + b"\x00" * 20, "x.gif").status_code == 400
    assert up(founder, b"\x89PNG\r\n\x1a\n" + b"\x00" * (10 * 1024 * 1024)).status_code in (400, 413)
    w = up(founder, WEBP, "scene.webp").json()
    assert up(founder, WEBP, "again.webp").json()["id"] == w["id"]                          # same bytes stored once
    r = founder.get(f"/api/public/site-assets/{w['id']}")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp" and r.headers["x-content-type-options"] == "nosniff"
    assert founder.get("/api/public/site-assets/../../secrets").status_code == 404
    assert founder.get("/api/public/site-assets/img_ffffffffffffffff").status_code == 404


def test_image_in_use_cannot_be_removed(founder):
    img = up(founder, PNG).json()
    founder.put("/api/brain/site-design", json={"design": {"heroes": {"home": {"image": img["id"]}}}})
    r = founder.delete(f"/api/brain/site-assets/{img['id']}")
    assert r.status_code == 400 and "Home" in r.json()["error"]
    founder.post("/api/brain/site-design/reset")
    assert founder.delete(f"/api/brain/site-assets/{img['id']}").status_code == 200
    assert founder.get(f"/api/public/site-assets/{img['id']}").status_code == 404
