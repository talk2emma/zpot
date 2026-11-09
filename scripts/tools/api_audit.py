#!/usr/bin/env python3
"""Machine-readable API audit: every OpenAPI operation × (backend tests, mobile client, docs, auth, response schema).

Run: docker compose exec -T api python manage.py spectacular --format openapi-json > /tmp/zpot-openapi.json
     python3 scripts/tools/api_audit.py /tmp/zpot-openapi.json      → docs/api/endpoint-audit.json (+ summary on stdout)
"""
import glob, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
spec = json.load(open(sys.argv[1]))
def _expand(src):  # resolve per-file URL constants (URL = "/api/v1/reports/") used inside f-strings
    for name, val in re.findall(r'^([A-Z_]+)\s*=\s*"(/api/v1/[^"]*)"', src, re.M):
        src = src.replace("{" + name + "}", val)
    return src


tests = "\n".join(_expand(open(f).read()) for f in glob.glob(f"{ROOT}/api/tests/*.py"))
mobile = "\n".join(open(f).read() for f in glob.glob(f"{ROOT}/mobile/src/services/api/*.ts"))
docs = open(f"{ROOT}/docs/api/endpoints.md").read()

def pattern(path):  # /api/v1/sessions/{id}/end/ → regex matching literal or templated uses
    p = path.replace("/api/v1", "")
    rx = re.escape(p)
    rx = re.sub(r"\\\{[^}]+\\\}", r"(\\{[^}]+\\}|\\$\\{[^}]+\\}|[^/'\"`]+)", rx)
    return p, re.compile(rx.rstrip("/") + "/?")

rows = []
for path, ops in sorted(spec["paths"].items()):
    p, rx = pattern(path)
    for method, op in ops.items():
        if method not in ("get", "post", "put", "patch", "delete"):
            continue
        resp = op.get("responses", {})
        ok = [c for c in resp if c.startswith("2")]
        has_schema = any("content" in resp[c] for c in ok) or ok == ["204"] or (method == "delete")
        rows.append({
            "method": method.upper(), "path": p, "operation_id": op.get("operationId"), "tags": op.get("tags", []),
            "auth": "public" if {} in op.get("security", [{}]) else "jwt",
            "deprecated": bool(op.get("deprecated")),
            "response_schema": has_schema, "error_envelope": "ZpotAPIError {error:{code,message,details,request_id}}",
            "backend_tests": bool(rx.search(tests)), "mobile_client": bool(rx.search(mobile)), "documented": bool(rx.search(docs)),
        })
out = {"generated_from": "drf-spectacular OpenAPI 3", "count": len(rows),
       "summary": {k: sum(1 for r in rows if r[k]) for k in ("response_schema", "backend_tests", "mobile_client", "documented")},
       "operations": rows}
json.dump(out, open(f"{ROOT}/docs/api/endpoint-audit.json", "w"), indent=2)
print(json.dumps(out["summary"]), "of", len(rows))
for r in rows:
    gaps = [k for k in ("response_schema", "backend_tests", "documented") if not r[k]]
    if gaps:
        print("GAP", r["method"], r["path"], gaps)
