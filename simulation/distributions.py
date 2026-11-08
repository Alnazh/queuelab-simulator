"""Pembangkit bilangan acak untuk waktu antar-kedatangan dan waktu layanan.

Setiap distribusi dijelaskan oleh dictionary kecil, misalnya
{"type": "exponential", "mean": 7.25}. Fungsi build_sampler mengubahnya
menjadi fungsi tanpa argumen yang mengembalikan satu nilai acak.
"""
import itertools
import math

from .errors import ValidationError

MAX_DATA_POINTS = 5000


def _number(spec, key, minimum=None, strictly_above=False):
    """Ambil parameter numerik dari spec dan pastikan nilainya wajar."""
    value = spec.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"Parameter '{key}' harus berupa angka.")
    if not math.isfinite(value):
        raise ValidationError(f"Parameter '{key}' harus berupa angka yang terhingga.")
    if minimum is not None:
        too_small = value <= minimum if strictly_above else value < minimum
        if too_small:
            sign = "lebih besar dari" if strictly_above else "minimal"
            raise ValidationError(f"Parameter '{key}' harus {sign} {minimum}.")
    return float(value)


def _values(spec):
    """Ambil daftar nilai untuk distribusi tipe data."""
    values = spec.get("values")
    if not isinstance(values, list) or not values:
        raise ValidationError("Distribusi data membutuhkan minimal satu nilai.")
    if len(values) > MAX_DATA_POINTS:
        raise ValidationError(f"Jumlah data maksimal {MAX_DATA_POINTS} nilai.")
    cleaned = []
    for item in values:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            raise ValidationError("Semua nilai data harus berupa angka.")
        if not math.isfinite(item) or item < 0:
            raise ValidationError("Nilai data tidak boleh negatif.")
        cleaned.append(float(item))
    return cleaned


def _constant(spec, rng):
    value = _number(spec, "value", minimum=0)
    return lambda: value


def _exponential(spec, rng):
    mean = _number(spec, "mean", minimum=0, strictly_above=True)
    return lambda: rng.expovariate(1.0 / mean)


def _uniform(spec, rng):
    low = _number(spec, "min", minimum=0)
    high = _number(spec, "max", minimum=0)
    if high < low:
        raise ValidationError("Nilai 'max' tidak boleh lebih kecil dari 'min'.")
    return lambda: rng.uniform(low, high)


def _normal(spec, rng):
    mean = _number(spec, "mean", minimum=0)
    std = _number(spec, "std", minimum=0)
    floor = _number(spec, "min", minimum=0) if "min" in spec else 0.0
    return lambda: max(floor, rng.gauss(mean, std))


def _triangular(spec, rng):
    low = _number(spec, "min", minimum=0)
    mode = _number(spec, "mode", minimum=0)
    high = _number(spec, "max", minimum=0)
    if not low <= mode <= high:
        raise ValidationError("Urutan harus min <= mode <= max.")
    return lambda: rng.triangular(low, high, mode)


def _data(spec, rng):
    values = _values(spec)
    if spec.get("mode", "sequence") == "random":
        return lambda: rng.choice(values)
    cycle = itertools.cycle(values)
    return lambda: next(cycle)


_BUILDERS = {
    "constant": _constant,
    "exponential": _exponential,
    "uniform": _uniform,
    "normal": _normal,
    "triangular": _triangular,
    "data": _data,
}


def build_sampler(spec, rng):
    """Buat fungsi pembangkit nilai acak dari spesifikasi distribusi."""
    if not isinstance(spec, dict):
        raise ValidationError("Spesifikasi distribusi harus berupa objek.")
    builder = _BUILDERS.get(spec.get("type"))
    if builder is None:
        raise ValidationError(f"Jenis distribusi tidak dikenal: {spec.get('type')}.")
    return builder(spec, rng)


def distribution_mean(spec):
    """Rata-rata teoretis distribusi, dipakai untuk memperkirakan beban sistem."""
    kind = spec.get("type")
    if kind == "constant":
        return float(spec["value"])
    if kind in ("exponential", "normal"):
        return float(spec["mean"])
    if kind == "uniform":
        return (float(spec["min"]) + float(spec["max"])) / 2
    if kind == "triangular":
        return (float(spec["min"]) + float(spec["mode"]) + float(spec["max"])) / 3
    values = _values(spec)
    return sum(values) / len(values)
