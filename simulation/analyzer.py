"""Analisis data historis untuk membantu memilih distribusi waktu."""
import math

from .errors import ValidationError
from .statistics_utils import histogram, mean, median, sample_std

MIN_DATA = 2
MAX_DATA = 5000
SMALL_SAMPLE = 30
MAX_BINS = 12


def _clean(values):
    if not isinstance(values, list):
        raise ValidationError("Data harus berupa daftar angka.")
    if not MIN_DATA <= len(values) <= MAX_DATA:
        raise ValidationError(f"Jumlah data harus antara {MIN_DATA} dan {MAX_DATA}.")
    cleaned = []
    for item in values:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            raise ValidationError("Semua data harus berupa angka.")
        if not math.isfinite(item) or item < 0:
            raise ValidationError("Data tidak boleh negatif.")
        cleaned.append(float(item))
    return cleaned


def _skewness(values, center, std):
    if std == 0:
        return 0.0
    return sum(((v - center) / std) ** 3 for v in values) / len(values)


def _suggest(values, center, std, cv, skew):
    """Pilih distribusi dari koefisien variasi (CV) dan kemiringan data."""
    if std == 0:
        return {
            "spec": {"type": "constant", "value": center},
            "reason": "Semua data bernilai sama, jadi cocok dipakai sebagai nilai tetap.",
        }
    if 0.8 <= cv <= 1.2:
        return {
            "spec": {"type": "exponential", "mean": center},
            "reason": "Koefisien variasi mendekati 1, ciri khas distribusi eksponensial.",
        }
    if cv < 0.5 and abs(skew) < 1:
        return {
            "spec": {"type": "normal", "mean": center, "std": std},
            "reason": "Data cukup merata di sekitar rata-rata dan tidak terlalu miring.",
        }
    return {
        "spec": {"type": "data", "values": values, "mode": "random"},
        "reason": "Polanya tidak jelas, jadi data dipakai langsung dengan pengambilan acak.",
    }


def analyze(values):
    """Hitung statistik deskriptif, histogram, dan saran distribusi."""
    data = _clean(values)
    center = mean(data)
    std = sample_std(data)
    cv = std / center if center > 0 else 0.0
    skew = _skewness(data, center, std)
    bins = max(3, min(MAX_BINS, math.ceil(1 + math.log2(len(data)))))
    notes = []
    if len(data) < SMALL_SAMPLE:
        notes.append(
            f"Data baru {len(data)} nilai. Sampel kecil membuat saran distribusi kurang pasti."
        )
    return {
        "count": len(data),
        "mean": center,
        "median": median(data),
        "std": std,
        "min": min(data),
        "max": max(data),
        "cv": cv,
        "skewness": skew,
        "histogram": histogram(data, bins),
        "suggestion": _suggest(data, center, std, cv, skew),
        "notes": notes,
    }
