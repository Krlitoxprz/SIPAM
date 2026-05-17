"""
FLASK-01/02/03 — AI Microservice
Exposes prediction endpoints backed by the trained ML model.
Runs on port 5001 (separate from FastAPI on 8000).
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask, jsonify, request
from flask_cors import CORS
from marshmallow import Schema, fields, validate, ValidationError

import predict as ai

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])


# ── Validation schema ───────────────────────────────────────────────────────
class PredictSchema(Schema):
    promedio             = fields.Float(required=True, validate=validate.Range(0.0, 5.0))
    porcentaje_creditos  = fields.Float(required=True, validate=validate.Range(0.0, 100.0))
    nota_asignatura      = fields.Float(required=True, validate=validate.Range(0.0, 5.0))
    nota_entrevista      = fields.Float(load_default=3.5, validate=validate.Range(0.0, 5.0))
    tipo_monitoria       = fields.Str(
        load_default="academica",
        validate=validate.OneOf([
            "nee", "regimenes_especiales", "academica_cursos", "laboratorios",
            "tic", "permanencia_graduacion", "deportiva", "cultural",
            "biblioteca", "acreditacion", "investigacion", "academica", "administrativa",
        ]),
    )
    semestre_asignatura       = fields.Int(load_default=4, validate=validate.Range(1, 12))
    creditos_asignatura       = fields.Int(load_default=3, validate=validate.Range(1, 10))
    num_postulantes           = fields.Int(load_default=6, validate=validate.Range(1, 100))
    num_monitores_requeridos  = fields.Int(load_default=1, validate=validate.Range(1, 10))


_schema = PredictSchema()


# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "SIPAM-AI", "port": 5001})


@app.post("/predict")
def predict_endpoint():
    """
    Predict whether a student will be selected as a monitor.

    Body (JSON):
      promedio               float  0-5     required
      porcentaje_creditos    float  0-100   required
      nota_asignatura        float  0-5     required
      nota_entrevista        float  0-5     optional (default 3.5)
      tipo_monitoria         str            optional
      semestre_asignatura    int    1-12    optional
      creditos_asignatura    int    1-10    optional
      num_postulantes        int    1-100   optional
      num_monitores_requeridos int  1-10    optional
    """
    body = request.get_json(silent=True) or {}
    try:
        data = _schema.load(body)
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "detail": e.messages}), 422

    try:
        result = ai.predict(data)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": "Prediction failed", "detail": str(e)}), 500

    return jsonify(result), 200


@app.get("/models/metrics")
def models_metrics():
    """Return training and test metrics for all 3 models."""
    try:
        data = ai.get_model_metrics()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    return jsonify(data), 200


@app.get("/models/feature-importance")
def feature_importance():
    """Return feature importances for the best model (tree-based only)."""
    try:
        data = ai.get_feature_importance()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    if data is None:
        return jsonify({"message": "Feature importance not available for Neural Network"}), 200
    return jsonify(data), 200


@app.post("/predict/explain")
def predict_explain_endpoint():
    """
    Returns prediction + SHAP-based explanation of the top features.
    Same request body as POST /predict.
    Note: slower than /predict (~2s) due to KernelExplainer.
    """
    body = request.get_json(silent=True) or {}
    try:
        data = _schema.load(body)
    except ValidationError as e:
        return jsonify({"error": "Validation failed", "detail": e.messages}), 422

    try:
        prediction = ai.predict(data)
        explanation = ai.explain(data)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": "Explanation failed", "detail": str(e)}), 500

    return jsonify({**prediction, "explanation": explanation}), 200


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "Method not allowed"}), 405


# ── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("AI_PORT", 5001))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    print(f"[SIPAM-AI] Starting Flask on port {port} (debug={debug})")
    app.run(host="0.0.0.0", port=port, debug=debug)
