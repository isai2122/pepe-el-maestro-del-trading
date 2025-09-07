import React from "react";

interface PredictionPanelProps {
  prediction: {
    action: string;
    probUp: number;
    probDown: number;
    confidence: number;
    accuracy: number;
    reasoning: string[];
  };
  simulations: {
    id: number;
    type: "Compra" | "Venta";
    price: number;
    start: string;
    end?: string;
    result?: string;
  }[];
  errors: string[];
}

const PredictionPanel: React.FC<PredictionPanelProps> = ({
  prediction,
  simulations,
  errors,
}) => {
  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl border border-slate-700 space-y-6">
      {/* 📌 Predicción actual */}
      <div>
        <h2 className="text-xl font-bold text-sky-400 mb-3">
          🔮 Predicción actual
        </h2>
        <div className="bg-slate-900 rounded-xl p-4 shadow-md space-y-2">
          <p className="text-lg font-semibold">
            Predicción:{" "}
            <span
              className={`${
                prediction.action === "SUBIR" ? "text-green-400" : "text-red-400"
              }`}
            >
              {prediction.action}
            </span>
          </p>
          <p>
            Probabilidad subida:{" "}
            <span className="text-green-400 font-bold">
              {prediction.probUp}%
            </span>{" "}
            • bajada:{" "}
            <span className="text-red-400 font-bold">
              {prediction.probDown}%
            </span>
          </p>
          <p className="text-slate-300">Confianza: {prediction.confidence}%</p>
          <p className="text-slate-300">Modelo Acc: {prediction.accuracy}%</p>

          {/* Razonamiento */}
          <div className="mt-2">
            <h3 className="text-sky-300 font-semibold">📈 Razonamiento:</h3>
            <ul className="list-disc list-inside text-slate-400">
              {prediction.reasoning.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 📌 Simulaciones */}
      <div>
        <h2 className="text-xl font-bold text-purple-400 mb-3">🧪 Simulaciones</h2>
        {simulations.length === 0 ? (
          <p className="text-slate-400">Aún no hay simulaciones.</p>
        ) : (
          <div className="space-y-3">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="bg-slate-900 rounded-lg p-3 shadow border border-slate-700"
              >
                <p>
                  <span className="font-semibold text-sky-300">
                    {sim.type}
                  </span>{" "}
                  a <span className="text-green-400">${sim.price}</span>
                </p>
                <p className="text-slate-400 text-sm">
                  Inicio: {sim.start}{" "}
                  {sim.end && (
                    <>
                      | Fin: {sim.end} |{" "}
                      <span
                        className={`font-semibold ${
                          sim.result === "Ganancia"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {sim.result}
                      </span>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📌 Errores y aprendizaje */}
      <div>
        <h2 className="text-xl font-bold text-rose-400 mb-3">
          ⚠️ Errores recientes y aprendizaje
        </h2>
        {errors.length === 0 ? (
          <p className="text-slate-400">No hay errores registrados.</p>
        ) : (
          <ul className="list-disc list-inside text-slate-400">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PredictionPanel;