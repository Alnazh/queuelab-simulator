"""Fungsi statistik dasar tanpa library tambahan."""
import math

# Nilai kritis t dua sisi untuk tingkat kepercayaan 95 persen, kunci = derajat kebebasan.
_T_CRITICAL_95 = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
    8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145,
    15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080,
    22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048,
    29: 2.045, 30: 2.042, 40: 2.021, 60: 2.000, 120: 1.980,
}
_Z_CRITICAL_95 = 1.960


def mean(values):
    return sum(values) / len(values) if values else 0.0


def sample_std(values):
    """Simpangan baku sampel (pembagi n - 1)."""
    if len(values) < 2:
        return 0.0
    center = mean(values)
    variance = sum((v - center) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def median(values):
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def t_critical(degrees_of_freedom):
    """Nilai t 95 persen. Untuk df di antara dua titik tabel dipakai titik yang lebih kecil."""
    if degrees_of_freedom < 1:
        return 0.0
    usable = [df for df in _T_CRITICAL_95 if df <= degrees_of_freedom]
    if degrees_of_freedom > 120:
        return _Z_CRITICAL_95
    return _T_CRITICAL_95[max(usable)]


def summarize(values):
    """Ringkas daftar nilai replikasi menjadi rata-rata, simpangan baku, dan selang 95 persen."""
    center = mean(values)
    std = sample_std(values)
    half_width = 0.0
    if len(values) > 1:
        half_width = t_critical(len(values) - 1) * std / math.sqrt(len(values))
    return {
        "mean": center,
        "std": std,
        "ci_low": center - half_width,
        "ci_high": center + half_width,
        "min": min(values) if values else 0.0,
        "max": max(values) if values else 0.0,
    }


def histogram(values, bins):
    """Hitung frekuensi per kelas. Mengembalikan batas kelas dan jumlah data per kelas."""
    low, high = min(values), max(values)
    width = (high - low) / bins if high > low else 1.0
    counts = [0] * bins
    for value in values:
        index = min(int((value - low) / width), bins - 1)
        counts[index] += 1
    edges = [low + width * i for i in range(bins + 1)]
    return {"edges": edges, "counts": counts}
