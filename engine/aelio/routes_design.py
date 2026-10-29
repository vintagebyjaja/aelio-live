"""Web Designer routes.

  Founder (Studio Brain, behind the full Studio security gate):
    GET  /api/brain/site-design                 draft, live version, history, image library, sections
    PUT  /api/brain/site-design                 save the draft (validated)
    POST /api/brain/site-design/publish         make the draft live
    POST /api/brain/site-design/restore         copy an old version into the draft
    POST /api/brain/site-design/reset           draft back to the built-in design
    POST /api/brain/site-design/preview         short-lived private preview link
    POST /api/brain/site-assets                 upload an image  {name, data_b64}
    DELETE /api/brain/site-assets/{aid}         remove an unused image
  Public (read-only, same origin through aelio.live):
    GET  /api/public/site-design[?preview=...]  the live design (or the draft, with a valid preview token)
    GET  /api/public/site-assets/{aid}          an uploaded image
"""
from __future__ import annotations

import base64
import binascii

from starlette.responses import FileResponse, Response

from . import site_design as sd
from .server import HTTPError, J, body, founder, route

MAX_UPLOAD_JSON = 15 * 1024 * 1024


def _err(fn):
    try:
        return fn()
    except sd.DesignError as e:
        raise HTTPError(400, str(e))


@route("/api/brain/site-design", ("GET", "PUT"))
async def brain_site_design(req):
    p = founder(req, write=req.method == "PUT")
    if req.method == "PUT":
        d = await body(req)
        _err(lambda: sd.save_draft(d.get("design") or {}, p["user_id"]))
    pub = sd.published()
    return J({"draft": sd.draft(), "live": pub, "history": sd.history(), "assets": sd.assets(), "sections": sd.SECTIONS,
              "defaults": sd.DEFAULT, "changed": sd.draft() != pub["design"]})


@route("/api/brain/site-design/publish", ("POST",))
async def brain_site_publish(req):
    p = founder(req, write=True)
    note = str((await body(req)).get("note") or "")
    return J(_err(lambda: sd.publish(p["user_id"], note)))


@route("/api/brain/site-design/restore", ("POST",))
async def brain_site_restore(req):
    p = founder(req, write=True)
    v = (await body(req)).get("version")
    return J({"draft": _err(lambda: sd.restore(int(v or 0), p["user_id"]))})


@route("/api/brain/site-design/reset", ("POST",))
async def brain_site_reset(req):
    p = founder(req, write=True)
    return J({"draft": sd.reset_draft(p["user_id"])})


@route("/api/brain/site-design/preview", ("POST",))
async def brain_site_preview(req):
    founder(req, write=True)
    return J({"token": sd.preview_token(), "expires_in": sd.PREVIEW_TTL})


@route("/api/brain/site-assets", ("POST",))
async def brain_site_asset_upload(req):
    p = founder(req, write=True)
    if int(req.headers.get("content-length") or 0) > MAX_UPLOAD_JSON:
        raise HTTPError(413, "images must be 10 MB or smaller")
    d = await body(req)
    try:
        data = base64.b64decode(str(d.get("data_b64", "")), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPError(400, "the image couldn't be read")
    return J(_err(lambda: sd.add_asset(str(d.get("name") or "image"), data, p["user_id"])))


@route("/api/brain/site-assets/{aid}", ("DELETE",))
async def brain_site_asset_delete(req):
    p = founder(req, write=True)
    _err(lambda: sd.remove_asset(req.path_params["aid"], p["user_id"]))
    return J({"ok": True})


@route("/api/public/site-design")
async def public_site_design(req):
    d = sd.public(req.query_params.get("preview"))
    r = J(d)
    r.headers["cache-control"] = "no-store" if d["preview"] else "public, max-age=60"
    return r


@route("/api/public/site-assets/{aid}")
async def public_site_asset(req):
    f = sd.asset_file(req.path_params["aid"])
    if not f:
        return Response(status_code=404)
    return FileResponse(f[0], media_type=f[1], headers={"cache-control": "public, max-age=31536000, immutable",
                                                         "x-content-type-options": "nosniff"})
