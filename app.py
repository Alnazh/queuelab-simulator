"""Entry point aplikasi web QueueLab Simulator (Flask)."""
from flask import Flask, jsonify, render_template, request

from simulation import ValidationError, analyze, load_presets, simulate, sweep_capacity

DEFAULT_SEED = 42
DEFAULT_REPLICATIONS = 30

app = Flask(__name__)
app.json.ensure_ascii = False


def _json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ValidationError("Permintaan harus berisi JSON yang valid.")
    return body


def _integer_field(body, key, default):
    value = body.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"Field '{key}' harus berupa bilangan bulat.")
    return value


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/presets")
def presets():
    return jsonify(load_presets())


@app.post("/api/simulate")
def api_simulate():
    body = _json_body()
    result = simulate(
        body.get("case"),
        _integer_field(body, "replications", DEFAULT_REPLICATIONS),
        _integer_field(body, "seed", DEFAULT_SEED),
    )
    return jsonify(result)


@app.post("/api/sweep")
def api_sweep():
    body = _json_body()
    result = sweep_capacity(
        body.get("case"),
        body.get("resource"),
        body.get("low"),
        body.get("high"),
        _integer_field(body, "replications", DEFAULT_REPLICATIONS),
        _integer_field(body, "seed", DEFAULT_SEED),
    )
    return jsonify(result)


@app.post("/api/analyze")
def api_analyze():
    return jsonify(analyze(_json_body().get("values")))


@app.errorhandler(ValidationError)
def handle_validation_error(error):
    return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(debug=True)
