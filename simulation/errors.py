"""Kesalahan khusus untuk input pengguna yang tidak valid."""


class ValidationError(ValueError):
    """Dilempar saat data yang dikirim pengguna tidak memenuhi aturan."""
