"""Model data studi kasus dan validasinya."""
from dataclasses import dataclass
from random import Random

from .distributions import build_sampler
from .errors import ValidationError

MAX_NAME_LENGTH = 40
MAX_RESOURCES = 8
MAX_STAGES = 8
MAX_CAPACITY = 20
MAX_ENTITIES = 500
TIME_UNITS = ("detik", "menit", "jam")


@dataclass(frozen=True)
class ResourceSpec:
    name: str
    capacity: int


@dataclass(frozen=True)
class StageSpec:
    name: str
    resource: str
    service: dict


@dataclass(frozen=True)
class CaseSpec:
    name: str
    entity_name: str
    time_unit: str
    arrival: dict
    resources: tuple
    stages: tuple
    max_entities: int


def _text(payload, key, label):
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{label} tidak boleh kosong.")
    value = value.strip()
    if len(value) > MAX_NAME_LENGTH:
        raise ValidationError(f"{label} maksimal {MAX_NAME_LENGTH} karakter.")
    return value


def _integer(value, label, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{label} harus berupa bilangan bulat.")
    if not minimum <= value <= maximum:
        raise ValidationError(f"{label} harus antara {minimum} dan {maximum}.")
    return value


def _parse_resources(raw):
    if not isinstance(raw, list) or not raw:
        raise ValidationError("Studi kasus butuh minimal satu sumber daya.")
    if len(raw) > MAX_RESOURCES:
        raise ValidationError(f"Sumber daya maksimal {MAX_RESOURCES}.")
    resources = []
    for item in raw:
        name = _text(item, "name", "Nama sumber daya")
        capacity = _integer(item.get("capacity"), f"Kapasitas {name}", 1, MAX_CAPACITY)
        resources.append(ResourceSpec(name, capacity))
    if len({r.name for r in resources}) != len(resources):
        raise ValidationError("Nama sumber daya tidak boleh kembar.")
    return tuple(resources)


def _parse_stages(raw, resources):
    if not isinstance(raw, list) or not raw:
        raise ValidationError("Studi kasus butuh minimal satu tahap layanan.")
    if len(raw) > MAX_STAGES:
        raise ValidationError(f"Tahap layanan maksimal {MAX_STAGES}.")
    known = {r.name for r in resources}
    stages = []
    for item in raw:
        name = _text(item, "name", "Nama tahap")
        resource = item.get("resource")
        if resource not in known:
            raise ValidationError(f"Tahap '{name}' memakai sumber daya yang tidak ada.")
        stages.append(StageSpec(name, resource, item.get("service")))
    return tuple(stages)


def parse_case(payload):
    """Validasi payload JSON lalu ubah menjadi CaseSpec."""
    if not isinstance(payload, dict):
        raise ValidationError("Data studi kasus tidak valid.")
    resources = _parse_resources(payload.get("resources"))
    stages = _parse_stages(payload.get("stages"), resources)
    time_unit = payload.get("time_unit", "menit")
    if time_unit not in TIME_UNITS:
        raise ValidationError("Satuan waktu harus detik, menit, atau jam.")
    max_entities = _integer(
        payload.get("max_entities"), "Jumlah entitas", 1, MAX_ENTITIES
    )
    case = CaseSpec(
        name=_text(payload, "name", "Nama studi kasus"),
        entity_name=_text(payload, "entity_name", "Nama entitas"),
        time_unit=time_unit,
        arrival=payload.get("arrival"),
        resources=resources,
        stages=stages,
        max_entities=max_entities,
    )
    _check_distributions(case)
    return case


def _check_distributions(case):
    """Bangun sampler sekali saja supaya parameter yang salah ketahuan lebih awal."""
    rng = Random(0)
    build_sampler(case.arrival, rng)
    for stage in case.stages:
        build_sampler(stage.service, rng)
