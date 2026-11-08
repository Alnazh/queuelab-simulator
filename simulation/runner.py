"""Menjalankan banyak replikasi, merangkum hasil, dan membandingkan skenario."""
from dataclasses import replace

from .case_model import ResourceSpec, parse_case
from .distributions import distribution_mean
from .engine import Simulation
from .errors import ValidationError
from .statistics_utils import summarize

MAX_REPLICATIONS = 200
MAX_TOTAL_ENTITIES = 30000
MAX_SWEEP_VALUES = 10
OVERALL_KEYS = ("avg_wait", "max_wait", "avg_system_time", "throughput", "completed", "end_time")


def _check_workload(case, replications, scenarios=1):
    if replications < 1 or replications > MAX_REPLICATIONS:
        raise ValidationError(f"Jumlah replikasi harus antara 1 dan {MAX_REPLICATIONS}.")
    if case.max_entities * replications * scenarios > MAX_TOTAL_ENTITIES:
        raise ValidationError(
            "Beban simulasi terlalu besar. Kurangi jumlah entitas atau replikasi."
        )


def run_replications(case, replications, base_seed, with_detail):
    """Jalankan simulasi berulang. Replikasi pertama menyimpan detail untuk grafik dan log."""
    return [
        Simulation(case, base_seed + index, record_detail=with_detail and index == 0).run()
        for index in range(replications)
    ]


def _summarize_results(results, case):
    metrics = [result.metrics for result in results]
    return {
        "overall": {key: summarize([m[key] for m in metrics]) for key in OVERALL_KEYS},
        "resources": [
            {
                "name": spec.name,
                "capacity": spec.capacity,
                **{
                    key: summarize([m["resources"][spec.name][key] for m in metrics])
                    for key in ("utilization", "avg_queue_length", "max_queue")
                },
            }
            for spec in case.resources
        ],
        "stages": [
            {
                "name": stage.name,
                "resource": stage.resource,
                "avg_wait": summarize([m["stage_waits"][index] for m in metrics]),
            }
            for index, stage in enumerate(case.stages)
        ],
    }


def estimate_load_warnings(case):
    """Beri peringatan jika rata-rata beban sebuah sumber daya mencapai 100 persen atau lebih."""
    arrival_mean = distribution_mean(case.arrival)
    if arrival_mean <= 0:
        return []
    warnings = []
    for spec in case.resources:
        demand = sum(
            distribution_mean(stage.service)
            for stage in case.stages
            if stage.resource == spec.name
        )
        load = demand / (arrival_mean * spec.capacity)
        if load >= 1:
            warnings.append(
                f"Beban {spec.name} sekitar {load * 100:.0f} persen dari kapasitasnya. "
                "Jika simulasi dibuat lebih panjang, antrian akan terus bertambah."
            )
    return warnings


def simulate(case_payload, replications, seed):
    """Titik masuk utama: validasi studi kasus, jalankan replikasi, kembalikan ringkasan dan detail."""
    case = parse_case(case_payload)
    _check_workload(case, replications)
    results = run_replications(case, replications, seed, with_detail=True)
    return {
        "settings": {
            "replications": replications,
            "seed": seed,
            "max_entities": case.max_entities,
            "time_unit": case.time_unit,
        },
        "warnings": estimate_load_warnings(case),
        "summary": _summarize_results(results, case),
        "detail": results[0].detail,
        "first_run": results[0].metrics,
    }


def _with_capacity(case, resource_name, capacity):
    resources = tuple(
        ResourceSpec(spec.name, capacity) if spec.name == resource_name else spec
        for spec in case.resources
    )
    return replace(case, resources=resources)


def sweep_capacity(case_payload, resource_name, low, high, replications, seed):
    """Ulangi simulasi dengan kapasitas sumber daya yang berbeda untuk membandingkan skenario."""
    case = parse_case(case_payload)
    if resource_name not in {spec.name for spec in case.resources}:
        raise ValidationError("Sumber daya yang dipilih tidak ditemukan.")
    if not isinstance(low, int) or not isinstance(high, int) or low < 1 or high < low:
        raise ValidationError("Rentang kapasitas tidak valid.")
    if high - low + 1 > MAX_SWEEP_VALUES:
        raise ValidationError(f"Rentang kapasitas maksimal {MAX_SWEEP_VALUES} nilai.")
    _check_workload(case, replications, scenarios=high - low + 1)
    scenarios = []
    for capacity in range(low, high + 1):
        variant = _with_capacity(case, resource_name, capacity)
        results = run_replications(variant, replications, seed, with_detail=False)
        summary = _summarize_results(results, variant)
        target = next(item for item in summary["resources"] if item["name"] == resource_name)
        scenarios.append(
            {
                "capacity": capacity,
                "avg_wait": summary["overall"]["avg_wait"],
                "avg_system_time": summary["overall"]["avg_system_time"],
                "utilization": target["utilization"],
            }
        )
    return {"resource": resource_name, "time_unit": case.time_unit, "scenarios": scenarios}
