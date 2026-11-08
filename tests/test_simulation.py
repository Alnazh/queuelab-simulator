"""Unit test mesin simulasi. Jalankan dengan: python -m unittest discover tests"""
import copy
import unittest

from app import app
from simulation import ValidationError, analyze, load_presets, simulate, sweep_capacity
from simulation.case_model import parse_case
from simulation.engine import Simulation


def preset(case_id):
    return copy.deepcopy(next(p for p in load_presets() if p["id"] == case_id))


def single_server_case(gaps, services):
    """Satu petugas dengan data berurutan, supaya hasilnya bisa dihitung dengan tangan."""
    return {
        "name": "Satu petugas",
        "entity_name": "Pelanggan",
        "time_unit": "menit",
        "max_entities": len(services),
        "arrival": {"type": "data", "values": list(gaps), "mode": "sequence"},
        "resources": [{"name": "Petugas", "capacity": 1}],
        "stages": [
            {
                "name": "Layanan",
                "resource": "Petugas",
                "service": {"type": "data", "values": list(services), "mode": "sequence"},
            }
        ],
    }


class HandSimulationTest(unittest.TestCase):
    """Lima pelanggan, satu petugas: hasil hitung tangan harus sama persis."""

    def setUp(self):
        case = single_server_case(gaps=[3, 1, 5, 2], services=[2, 4, 2, 3, 2])
        self.result = Simulation(parse_case(case), seed=1).run()

    def test_all_customers_are_served(self):
        self.assertEqual(self.result.metrics["completed"], 5)

    def test_average_wait_matches_hand_calculation(self):
        # Menunggu: pelanggan 3 selama 3, pelanggan 5 selama 1, total 4 dibagi 5 pelanggan.
        self.assertAlmostEqual(self.result.metrics["avg_wait"], 0.8)

    def test_simulation_ends_when_last_customer_leaves(self):
        self.assertAlmostEqual(self.result.metrics["end_time"], 14.0)


class ReferenceImplementationTest(unittest.TestCase):
    """Mesin ini harus memberi angka yang sama dengan implementasi referensi satu server.

    Waktu acak dibangkitkan dengan NumPy (seed 42), lalu dimasukkan sebagai data
    berurutan sehingga hasilnya bisa dibandingkan langsung dengan angka referensi.
    """

    def run_reference_case(self):
        try:
            import numpy as np
        except ImportError:
            self.skipTest("NumPy diperlukan untuk membangkitkan data acak referensi.")

        np.random.seed(42)
        gaps = [float(x) for x in np.random.exponential(10, 49)]
        services = [max(1.0, float(x)) for x in np.random.normal(8, 2, 50)]
        return Simulation(parse_case(single_server_case(gaps, services)), seed=1).run().metrics

    def test_average_wait_matches_reference(self):
        self.assertAlmostEqual(self.run_reference_case()["avg_wait"], 24.97, delta=0.1)

    def test_max_wait_matches_reference(self):
        self.assertAlmostEqual(self.run_reference_case()["max_wait"], 71.91, delta=0.1)

    def test_total_time_matches_reference(self):
        self.assertAlmostEqual(self.run_reference_case()["end_time"], 464.65, delta=0.1)


class EngineBehaviourTest(unittest.TestCase):
    def test_same_seed_gives_same_result(self):
        case = parse_case(preset("bengkel"))
        first = Simulation(case, seed=7).run().metrics
        second = Simulation(case, seed=7).run().metrics
        self.assertEqual(first, second)

    def test_utilization_stays_between_zero_and_one(self):
        case = parse_case(preset("bengkel-ramai"))
        metrics = Simulation(case, seed=3).run().metrics
        for resource in metrics["resources"].values():
            self.assertTrue(0 <= resource["utilization"] <= 1.0000001)

    def test_event_calendar_is_processed_in_time_order(self):
        case = parse_case(preset("bengkel"))
        log = Simulation(case, seed=5, record_detail=True).run().detail["log"]
        clocks = [row["clock"] for row in log]
        self.assertEqual(clocks, sorted(clocks))

    def test_every_entity_visits_every_stage(self):
        case = parse_case(preset("bengkel"))
        detail = Simulation(case, seed=5, record_detail=True).run().detail
        self.assertEqual(len(detail["gantt"]), case.max_entities * len(case.stages))


class ReplicationTest(unittest.TestCase):
    def test_summary_contains_confidence_interval(self):
        result = simulate(preset("bengkel"), replications=10, seed=1)
        wait = result["summary"]["overall"]["avg_wait"]
        self.assertLessEqual(wait["ci_low"], wait["mean"])
        self.assertGreaterEqual(wait["ci_high"], wait["mean"])

    def test_overloaded_case_gives_warning(self):
        result = simulate(preset("bengkel"), replications=2, seed=1)
        self.assertTrue(any("Montir" in text for text in result["warnings"]))

    def test_more_mechanics_do_not_increase_waiting(self):
        outcome = sweep_capacity(preset("bengkel"), "Montir", 1, 4, 30, 1)
        waits = [item["avg_wait"]["mean"] for item in outcome["scenarios"]]
        self.assertEqual(waits, sorted(waits, reverse=True))


class ValidationTest(unittest.TestCase):
    def test_rejects_negative_mean(self):
        case = preset("bengkel")
        case["arrival"] = {"type": "exponential", "mean": -1}
        with self.assertRaises(ValidationError):
            simulate(case, replications=1, seed=1)

    def test_rejects_unknown_resource(self):
        case = preset("bengkel")
        case["stages"][0]["resource"] = "Tidak ada"
        with self.assertRaises(ValidationError):
            simulate(case, replications=1, seed=1)

    def test_rejects_too_heavy_workload(self):
        case = preset("bengkel")
        case["max_entities"] = 500
        with self.assertRaises(ValidationError):
            simulate(case, replications=200, seed=1)


class AnalyzerTest(unittest.TestCase):
    def test_suggests_constant_for_identical_values(self):
        self.assertEqual(analyze([5, 5, 5])["suggestion"]["spec"]["type"], "constant")

    def test_reports_basic_statistics(self):
        result = analyze([2, 4, 6, 8])
        self.assertAlmostEqual(result["mean"], 5.0)
        self.assertEqual(sum(result["histogram"]["counts"]), 4)

    def test_rejects_too_few_values(self):
        with self.assertRaises(ValidationError):
            analyze([3])


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_presets_endpoint(self):
        response = self.client.get("/api/presets")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.get_json()), 4)

    def test_simulate_endpoint(self):
        payload = {"case": preset("bengkel"), "replications": 3, "seed": 1}
        response = self.client.post("/api/simulate", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.get_json())

    def test_invalid_input_returns_400_with_message(self):
        response = self.client.post("/api/simulate", json={"case": {}})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())


if __name__ == "__main__":
    unittest.main()
