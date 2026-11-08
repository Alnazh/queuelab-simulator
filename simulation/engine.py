"""Mesin simulasi kejadian diskrit (DES) dengan Event Calendar berbasis list.

Strukturnya klasik: ada simulation clock, antrian berupa list FIFO,
Event Calendar yang selalu terurut, lalu main loop yang memanggil fungsi
penanganan tiap jenis kejadian (ARRIVAL dan DEPARTURE).
"""
import bisect
from dataclasses import dataclass, field
from random import Random

from .distributions import build_sampler

ARRIVAL = "ARRIVAL"
DEPARTURE = "DEPARTURE"
MAX_LOG_ROWS = 4000
MAX_WAITING_PREVIEW = 10


@dataclass
class Entity:
    """Satu pelanggan (mobil, pasien, dan sebagainya) yang bergerak melewati semua tahap."""

    entity_id: int
    arrival_time: float
    service_times: list
    waits: list = field(default_factory=list)
    exit_time: float = None


@dataclass
class ResourceState:
    """Keadaan satu sumber daya: slot yang sedang dipakai dan antrian di depannya."""

    name: str
    slots: list
    queue: list = field(default_factory=list)
    busy_time: float = 0.0
    queue_area: float = 0.0
    max_queue: int = 0

    @property
    def capacity(self):
        return len(self.slots)


@dataclass
class SimulationResult:
    metrics: dict
    detail: dict = None


class Simulation:
    """Satu kali jalan simulasi untuk satu studi kasus dan satu seed."""

    def __init__(self, case, seed, record_detail=False):
        self.case = case
        self.clock = 0.0
        self.event_calendar = []
        self.event_counter = 0
        self.created = 0
        self.entities = {}
        self.resources = {
            spec.name: ResourceState(spec.name, [None] * spec.capacity)
            for spec in case.resources
        }
        # Aliran acak terpisah per jenis waktu, supaya skenario berbeda memakai angka acak yang sama.
        self.arrival_sampler = build_sampler(case.arrival, Random(f"{seed}:arrival"))
        self.service_samplers = [
            build_sampler(stage.service, Random(f"{seed}:stage{index}"))
            for index, stage in enumerate(case.stages)
        ]
        self.detail = self._new_detail() if record_detail else None

    # ----- Event Calendar -------------------------------------------------

    def _schedule(self, time, kind, entity_id, stage_index=0):
        """Masukkan kejadian baru ke Event Calendar tanpa merusak urutan waktu."""
        self.event_counter += 1
        event = (time, self.event_counter, kind, entity_id, stage_index)
        bisect.insort(self.event_calendar, event)

    def _schedule_arrival(self, time):
        self.created += 1
        self._schedule(time, ARRIVAL, self.created)

    # ----- Main simulation loop -------------------------------------------

    def run(self):
        self._schedule_arrival(0.0)
        while self.event_calendar:
            time, _, kind, entity_id, stage_index = self.event_calendar.pop(0)
            self._advance_clock(time)
            if kind == ARRIVAL:
                note = self._handle_arrival(entity_id)
            else:
                note = self._handle_departure(entity_id, stage_index)
            self._record(kind, entity_id, stage_index, note)
        return self._finish()

    def _advance_clock(self, new_time):
        """Lompat ke waktu kejadian berikutnya dan kumpulkan luas area panjang antrian."""
        elapsed = new_time - self.clock
        for resource in self.resources.values():
            resource.queue_area += len(resource.queue) * elapsed
        self.clock = new_time

    # ----- Event handlers -------------------------------------------------

    def _handle_arrival(self, entity_id):
        entity = Entity(
            entity_id,
            self.clock,
            [sampler() for sampler in self.service_samplers],
        )
        self.entities[entity_id] = entity
        if self.created < self.case.max_entities:
            self._schedule_arrival(self.clock + self.arrival_sampler())
        return self._request_stage(entity, 0)

    def _handle_departure(self, entity_id, stage_index):
        entity = self.entities[entity_id]
        stage = self.case.stages[stage_index]
        resource = self.resources[stage.resource]
        slot = resource.slots.index(entity_id)
        resource.slots[slot] = None
        notes = [f"Selesai {stage.name}"]
        if resource.queue:
            notes.append(self._serve_next_in_queue(resource, slot))
        if stage_index + 1 < len(self.case.stages):
            notes.append(self._request_stage(entity, stage_index + 1))
        else:
            entity.exit_time = self.clock
            notes.append("Pergi")
        return ". ".join(notes)

    # ----- Aturan layanan -------------------------------------------------

    def _request_stage(self, entity, stage_index):
        """Entitas minta dilayani. Langsung mulai jika ada slot tersedia, kalau tidak masuk antrian."""
        stage = self.case.stages[stage_index]
        resource = self.resources[stage.resource]
        slot = self._free_slot(resource)
        if slot is None:
            resource.queue.append((entity.entity_id, stage_index, self.clock))
            resource.max_queue = max(resource.max_queue, len(resource.queue))
            return f"Masuk antrian {resource.name}"
        self._start_service(resource, slot, entity, stage_index, wait=0.0)
        return f"Mulai {stage.name} di {self._slot_label(resource, slot)}"

    def _serve_next_in_queue(self, resource, slot):
        entity_id, stage_index, enqueue_time = resource.queue.pop(0)
        entity = self.entities[entity_id]
        wait = self.clock - enqueue_time
        self._start_service(resource, slot, entity, stage_index, wait)
        stage = self.case.stages[stage_index]
        return f"Entitas {entity_id} mulai {stage.name} di {self._slot_label(resource, slot)}"

    def _start_service(self, resource, slot, entity, stage_index, wait):
        duration = entity.service_times[stage_index]
        resource.slots[slot] = entity.entity_id
        resource.busy_time += duration
        entity.waits.append(wait)
        self._schedule(self.clock + duration, DEPARTURE, entity.entity_id, stage_index)
        if self.detail is not None:
            self.detail["gantt"].append(
                {
                    "entity": entity.entity_id,
                    "resource": resource.name,
                    "slot": slot,
                    "stage": self.case.stages[stage_index].name,
                    "start": self.clock,
                    "end": self.clock + duration,
                }
            )

    @staticmethod
    def _free_slot(resource):
        for index, occupant in enumerate(resource.slots):
            if occupant is None:
                return index
        return None

    @staticmethod
    def _slot_label(resource, slot):
        if resource.capacity == 1:
            return resource.name
        return f"{resource.name} {slot + 1}"

    # ----- Pencatatan -----------------------------------------------------

    @staticmethod
    def _new_detail():
        return {"log": [], "queue_series": {}, "gantt": [], "log_truncated": False}

    def _snapshot(self):
        return {
            name: {
                "busy": list(resource.slots),
                "queue": len(resource.queue),
                "waiting": [item[0] for item in resource.queue[:MAX_WAITING_PREVIEW]],
            }
            for name, resource in self.resources.items()
        }

    def _record(self, kind, entity_id, stage_index, note):
        if self.detail is None:
            return
        for name, resource in self.resources.items():
            series = self.detail["queue_series"].setdefault(name, [[0.0, 0]])
            if series[-1][1] != len(resource.queue):
                series.append([self.clock, len(resource.queue)])
        if len(self.detail["log"]) >= MAX_LOG_ROWS:
            self.detail["log_truncated"] = True
            return
        self.detail["log"].append(
            {
                "clock": self.clock,
                "event": kind,
                "entity": entity_id,
                "stage": self.case.stages[stage_index].name,
                "note": note,
                "state": self._snapshot(),
            }
        )

    # ----- Statistik akhir ------------------------------------------------

    def _finish(self):
        finished = [e for e in self.entities.values() if e.exit_time is not None]
        total_waits = [sum(e.waits) for e in finished]
        system_times = [e.exit_time - e.arrival_time for e in finished]
        end_time = self.clock
        metrics = {
            "completed": len(finished),
            "end_time": end_time,
            "avg_wait": _average(total_waits),
            "max_wait": max(total_waits) if total_waits else 0.0,
            "avg_system_time": _average(system_times),
            "throughput": len(finished) / end_time if end_time > 0 else 0.0,
            "resources": {
                name: self._resource_metrics(resource, end_time)
                for name, resource in self.resources.items()
            },
            "stage_waits": self._stage_waits(finished),
        }
        if self.detail is not None:
            self.detail["waits"] = total_waits
            self.detail["system_times"] = system_times
            self.detail["end_time"] = end_time
        return SimulationResult(metrics, self.detail)

    @staticmethod
    def _resource_metrics(resource, end_time):
        if end_time <= 0:
            return {"utilization": 0.0, "avg_queue_length": 0.0, "max_queue": 0}
        return {
            "utilization": resource.busy_time / (resource.capacity * end_time),
            "avg_queue_length": resource.queue_area / end_time,
            "max_queue": resource.max_queue,
        }

    def _stage_waits(self, finished):
        return [
            _average([entity.waits[index] for entity in finished])
            for index in range(len(self.case.stages))
        ]


def _average(values):
    return sum(values) / len(values) if values else 0.0
