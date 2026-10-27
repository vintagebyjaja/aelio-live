"""Green Guardians: native operations agents for thermal, power, workload, cooling and resource efficiency.

Operating mode in v1: RECOMMENDATION ONLY. No code in this module writes to
hardware, firmware, fan controls, power limits or cooling systems; there is no
such code path. The Workload Guardian's one possible action, postponing a
queued non-critical job, needs founder approval.

Telemetry is real when the host exposes it (psutil, /sys/class/thermal,
nvidia-smi, RAPL). Missing data is stored as missing and shown as
"Data unavailable"; nothing is estimated without a label. Synthetic scenarios
are flagged `simulated=1` everywhere.
"""
from __future__ import annotations

import glob
import os
import shutil
import subprocess
import time

import psutil

from . import db

AGENTS = [
    ("guardian-thermal", "Thermal Guardian", "CPU/GPU temperature, throttling, trends, critical events"),
    ("guardian-power", "Power Guardian", "CPU/GPU power, energy, idle power, efficiency"),
    ("guardian-workload", "Workload Guardian", "Scheduling, staggering, postponing non-critical jobs"),
    ("guardian-cooling", "Cooling Guardian", "Fan/cooling telemetry and safety-threshold recommendations"),
    ("guardian-resource", "Resource Guardian", "Compute efficiency, energy per run/request, water data when available"),
]
THRESH = {"cpu_temp_warn": 80.0, "cpu_temp_crit": 92.0, "gpu_temp_warn": 80.0, "gpu_temp_crit": 88.0,
          "cpu_util_idle": 5.0, "cpu_util_high": 90.0}


def seed_agents() -> None:
    seed_core_agents()
    for aid, name, caps in AGENTS:
        if not db.q1("SELECT id FROM agents WHERE id=?", (aid,)):
            db.insert("agents", {"id": aid, "name": name, "division": "Green Guardians", "engine": "operations",
                                 "kind": "deterministic rules (v1)", "capabilities": db.dumps(caps.split(", ")),
                                 "tools": db.dumps(["telemetry.read", "recommendation.create"] +
                                                   (["jobs.postpone (founder-approved)"] if "workload" in aid else [])),
                                 "permissions": db.dumps({"hardware_write": False, "firmware": False,
                                                          "mode": "recommend-only"}),
                                 "status": "active", "notes": "Rule-based; no learned model yet."})


CORE_AGENTS = [
    ("agent-orchestrator", "AELIO Native Orchestrator", "Core", "orchestrator", "deterministic state machine",
     ["task interpretation (keyword router)", "step dispatch", "state tracking", "failure escalation"],
     ["jobs.enqueue", "projects.branch", "quality.run_suite", "deploy.request"],
     {"deploy_production": False, "grant_permissions": False}),
    ("agent-code", "Code Agent", "Core", "code", "AELIO Native code model (prototype)",
     ["code generation"], ["workspace.write (task allow-list only)"],
     {"write_scope": "allowed_files of the task contract", "push": False, "secrets": False}),
    ("agent-diagnose", "Diagnose Agent", "Core", "code", "deterministic static analysis",
     ["syntax, imports, a11y, security, deployment config checks"], ["sandbox.run (read-only checks)"],
     {"write": False}),
    ("agent-quality", "Quality Lab Evaluator", "Core", "quality", "deterministic test runner",
     ["protected suites", "result parsing", "acceptance gate"], ["sandbox.run"],
     {"modify_suites": False}),
]


def seed_core_agents() -> None:
    for aid, name, div, eng, kind, caps, tools, perms in CORE_AGENTS:
        if not db.q1("SELECT id FROM agents WHERE id=?", (aid,)):
            db.insert("agents", {"id": aid, "name": name, "division": div, "engine": eng, "kind": kind,
                                 "capabilities": db.dumps(caps), "tools": db.dumps(tools),
                                 "permissions": db.dumps(perms), "status": "active", "notes": ""})


def read_telemetry() -> list[dict]:
    """Read whatever real telemetry this host exposes."""
    ts = time.time()
    out = [
        {"source": "psutil", "metric": "cpu_util_pct", "value": psutil.cpu_percent(interval=0.3), "unit": "%"},
        {"source": "psutil", "metric": "mem_used_pct", "value": psutil.virtual_memory().percent, "unit": "%"},
        {"source": "psutil", "metric": "load_1m", "value": os.getloadavg()[0], "unit": "load"},
    ]
    f = psutil.cpu_freq()
    if f and f.current:
        out.append({"source": "psutil", "metric": "cpu_freq_mhz", "value": f.current, "unit": "MHz"})
    temps = getattr(psutil, "sensors_temperatures", lambda: {})() or {}
    cpu_t = [t.current for k, arr in temps.items() for t in arr if t.current]
    if not cpu_t:
        for z in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
            try:
                cpu_t.append(int(open(z).read()) / 1000.0)
            except (OSError, ValueError):
                pass
    out.append({"source": "sensors", "metric": "cpu_temp_c", "value": max(cpu_t) if cpu_t else None, "unit": "°C"})
    fans = getattr(psutil, "sensors_fans", lambda: {})() or {}
    rpm = [x.current for arr in fans.values() for x in arr]
    out.append({"source": "sensors", "metric": "fan_rpm", "value": max(rpm) if rpm else None, "unit": "rpm"})
    rapl = glob.glob("/sys/class/powercap/intel-rapl:*/energy_uj")
    val = None
    if rapl:
        try:
            val = sum(int(open(r).read()) for r in rapl) / 1e6
        except (OSError, ValueError):
            val = None
    out.append({"source": "rapl", "metric": "cpu_energy_j_counter", "value": val, "unit": "J"})
    if shutil.which("nvidia-smi"):
        try:
            r = subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu,power.draw,utilization.gpu,memory.used",
                                "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5)
            for i, line in enumerate(r.stdout.strip().splitlines()):
                t, p, u, m = [x.strip() for x in line.split(",")]
                out += [{"source": "nvidia-smi", "metric": f"gpu{i}_temp_c", "value": float(t), "unit": "°C"},
                        {"source": "nvidia-smi", "metric": f"gpu{i}_power_w", "value": float(p), "unit": "W"},
                        {"source": "nvidia-smi", "metric": f"gpu{i}_util_pct", "value": float(u), "unit": "%"},
                        {"source": "nvidia-smi", "metric": f"gpu{i}_mem_mib", "value": float(m), "unit": "MiB"}]
        except Exception:
            pass
    else:
        out.append({"source": "nvidia-smi", "metric": "gpu0_temp_c", "value": None, "unit": "°C"})
    out.append({"source": "facility", "metric": "water_liters", "value": None, "unit": "L"})
    for r in out:
        db.insert("telemetry", {"ts": ts, "source": r["source"], "metric": r["metric"], "value": r["value"],
                                "unit": r["unit"], "simulated": 0})
    return out


def _event(agent, severity, kind, message, rec, simulated, conditions, risk="low") -> dict:
    if severity == "info":  # don't repeat the same informational notice every cycle
        dup = db.q1("""SELECT * FROM guardian_events WHERE agent=? AND kind=? AND simulated=? AND ts>?
                       AND action_status IN ('recommended','acknowledged')""", (agent, kind, int(simulated), db.now() - 86400))
        if dup:
            return dup
    eid = db.new_id("gg")
    row = {"id": eid, "ts": db.now(), "agent": agent, "severity": severity, "kind": kind, "message": message,
           "recommendation": db.dumps(rec), "simulated": int(simulated), "action_status": "recommended",
           "risk": risk, "conditions": db.dumps(conditions), "before_state": db.dumps(conditions),
           "after_state": None, "result": None, "rollback_status": "n/a"}
    db.insert("guardian_events", row)
    return row


def evaluate(readings: dict, simulated: bool) -> list[dict]:
    """Monitor -> Predict -> Recommend. Deterministic rules (performer: deterministic:guardian-rules-v1)."""
    ev = []
    t = readings.get("cpu_temp_c")
    queued = db.q("SELECT id,kind,priority FROM jobs WHERE status='queued' AND critical=0")
    running = db.q("SELECT id,kind FROM jobs WHERE status='running'")
    if t is None:
        ev.append(_event("guardian-thermal", "info", "data_unavailable",
                         "CPU temperature: Data unavailable on this host. Thermal monitoring is limited to utilisation.",
                         {"action": "none", "note": "Run the studio on hardware that exposes sensors."}, simulated, readings))
    elif t >= THRESH["cpu_temp_crit"]:
        ev.append(_event("guardian-thermal", "critical", "thermal_critical",
                         f"CPU at {t:.1f}°C, at or above the critical threshold of {THRESH['cpu_temp_crit']}°C.",
                         {"action": "pause_new_training_jobs", "requires_approval": True,
                          "hardware_change": False, "note": "Firmware and OS thermal protection stay in control."},
                         simulated, readings, risk="medium"))
    elif t >= THRESH["cpu_temp_warn"]:
        rec = {"action": "postpone_noncritical_jobs", "job_ids": [j["id"] for j in queued][:5],
               "requires_approval": True, "hardware_change": False}
        ev.append(_event("guardian-workload", "warning", "thermal_rising",
                         f"CPU at {t:.1f}°C (warning ≥{THRESH['cpu_temp_warn']}°C). " + (
                             f"Recommend postponing {len(queued)} queued non-critical job(s) until temperature falls."
                             if queued else "No queued jobs to postpone; recommend not starting new training until "
                             "temperature falls."), rec, simulated, readings))
        ev.append(_event("guardian-cooling", "warning", "cooling_demand",
                         "Cooling demand is rising. Check airflow and confirm fans respond. No fan or firmware "
                         "settings were changed.", {"action": "inspect_airflow", "hardware_change": False},
                         simulated, readings))
    u = readings.get("cpu_util_pct")
    if u is not None and u < THRESH["cpu_util_idle"] and not running:
        ev.append(_event("guardian-power", "info", "idle_capacity",
                         f"CPU utilisation {u:.1f}% with no running jobs. Batch queued training here, or let the host idle down.",
                         {"action": "consolidate_or_idle", "hardware_change": False}, simulated, readings))
    if readings.get("water_liters") is None:
        ev.append(_event("guardian-resource", "info", "water_data_unavailable",
                         "Water use: Data unavailable. No facility meter is connected, so no water figure is reported.",
                         {"action": "connect_facility_data_when_available"}, simulated, readings))
    return ev


def run_cycle() -> dict:
    vals = {r["metric"]: r["value"] for r in read_telemetry()}
    return {"readings": vals, "events": evaluate(vals, simulated=False)}


def synthetic_thermal_scenario() -> dict:
    """Clearly labelled SIMULATION: a rising-temperature scenario to test the agents."""
    readings = {"cpu_temp_c": 84.5, "cpu_util_pct": 97.0, "water_liters": None, "SIMULATED": True}
    for m, v in (("cpu_temp_c", 84.5), ("cpu_util_pct", 97.0)):
        db.insert("telemetry", {"ts": db.now(), "source": "synthetic-scenario", "metric": m, "value": v,
                                "unit": "", "simulated": 1})
    events = evaluate(readings, simulated=True)
    return {"simulated": True, "readings": readings, "events": events,
            "hardware_settings_changed": False}


def decide(event_id: str, approve: bool, actor: str) -> dict:
    e = db.q1("SELECT * FROM guardian_events WHERE id=?", (event_id,))
    if not e or e["action_status"] != "recommended":
        raise ValueError("event not pending")
    rec = db.loads(e["recommendation"], {})
    if not rec.get("requires_approval"):
        db.update("guardian_events", "id", event_id, action_status="acknowledged")
        return {"status": "acknowledged"}
    if not approve:
        db.update("guardian_events", "id", event_id, action_status="rejected")
        return {"status": "rejected"}
    applied = []
    if rec.get("action") == "postpone_noncritical_jobs" and not e["simulated"]:
        from .jobs import postpone
        applied = [j for j in rec.get("job_ids", []) if postpone(j, 600)]
    db.update("guardian_events", "id", event_id, action_status="approved",
              result=db.dumps({"postponed_jobs": applied, "hardware_change": False,
                               "note": "Simulated events record the decision only." if e["simulated"] else ""}),
              rollback_status="jobs resume automatically after 10 minutes" if applied else "n/a")
    db.audit("founder", actor, "guardian.approved", event_id, {"applied": applied})
    return {"status": "approved", "postponed": applied}
