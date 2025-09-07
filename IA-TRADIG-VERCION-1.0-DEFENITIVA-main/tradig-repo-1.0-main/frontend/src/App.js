import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const App = () => {
  // Estados principales
  const [currentSignal, setCurrentSignal] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [tradingHistory, setTradingHistory] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signal');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Referencias para actualizaciones automáticas
  const intervalRef = useRef(null);

  // Función para obtener la señal actual
  const fetchCurrentSignal = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/trading/current-signal`);
      setCurrentSignal(response.data.signal);
      setMarketData(response.data.market_data);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Error fetching current signal:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener el historial de trading
  const fetchTradingHistory = async () => {
    try {
      const response = await axios.get(`${API}/trading/signals?limit=20`);
      setTradingHistory(response.data.signals || []);
    } catch (error) {
      console.error('Error fetching trading history:', error);
    }
  };

  // Función para obtener métricas de rendimiento
  const fetchPerformance = async () => {
    try {
      const response = await axios.get(`${API}/trading/performance`);
      setPerformance(response.data);
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  };

  // Función para obtener análisis de errores
  const fetchErrors = async () => {
    try {
      const response = await axios.get(`${API}/trading/errors`);
      setErrors(response.data.errors || []);
    } catch (error) {
      console.error('Error fetching errors:', error);
    }
  };

  // Función para registrar resultado de trade manual
  const recordTradeResult = async (signalId, entryPrice, exitPrice, success) => {
    try {
      const profitLossPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      const tradeResult = {
        signal_id: signalId,
        entry_price: entryPrice,
        exit_price: exitPrice,
        profit_loss_pct: profitLossPct,
        success: success,
        exit_reason: success ? 'manual_profit' : 'manual_loss'
      };

      await axios.post(`${API}/trading/trade-result`, tradeResult);
      
      // Actualizar datos después de registrar
      await fetchPerformance();
      await fetchErrors();
      
      alert(success ? '✅ Trade exitoso registrado!' : '❌ Trade perdedor registrado');
    } catch (error) {
      console.error('Error recording trade result:', error);
      alert('Error al registrar el resultado del trade');
    }
  };

  // Inicialización y actualizaciones automáticas
  useEffect(() => {
    // Cargar datos iniciales
    fetchCurrentSignal();
    fetchTradingHistory();
    fetchPerformance();
    fetchErrors();

    // Configurar actualización automática cada 30 segundos
    intervalRef.current = setInterval(() => {
      fetchCurrentSignal();
      if (activeTab === 'history') fetchTradingHistory();
      if (activeTab === 'performance') fetchPerformance();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Actualizar datos cuando cambia la pestaña activa
  useEffect(() => {
    switch (activeTab) {
      case 'history':
        fetchTradingHistory();
        break;
      case 'performance':
        fetchPerformance();
        break;
      case 'errors':
        fetchErrors();
        break;
      default:
        break;
    }
  }, [activeTab]);

  // Componente de estado de conexión
  const ConnectionStatus = () => (
    <div className={`connection-status ${connectionStatus}`}>
      <div className={`status-indicator ${connectionStatus}`}></div>
      <span>
        {connectionStatus === 'connected' && '🟢 Conectado en tiempo real'}
        {connectionStatus === 'disconnected' && '🟡 Desconectado'}
        {connectionStatus === 'error' && '🔴 Error de conexión'}
      </span>
    </div>
  );

  // Componente de señal actual
  const SignalPanel = () => (
    <div className="panel">
      <div className="panel-header">
        <h2>🎯 Señal Actual BTS/USDT</h2>
        <button 
          onClick={fetchCurrentSignal} 
          className="refresh-btn"
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} Actualizar
        </button>
      </div>

      {currentSignal ? (
        <div className="signal-content">
          {/* Señal principal */}
          <div className={`signal-main ${currentSignal.signal.toLowerCase()}`}>
            <div className="signal-action">
              <span className="signal-label">{currentSignal.signal}</span>
              <span className="confidence">{currentSignal.confidence.toFixed(1)}%</span>
            </div>
            <div className="signal-price">
              <span>Precio: ${currentSignal.entry_price.toFixed(6)}</span>
            </div>
          </div>

          {/* Detalles de la señal */}
          <div className="signal-details">
            <div className="detail-row">
              <span>🎯 Objetivo:</span>
              <span className="target-price">${currentSignal.target_price?.toFixed(6) || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span>🛡️ Stop Loss:</span>
              <span className="stop-loss">${currentSignal.stop_loss?.toFixed(6) || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span>⏱️ Duración:</span>
              <span>{currentSignal.expected_duration || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span>📰 Sentimiento:</span>
              <span className={`sentiment ${currentSignal.news_sentiment}`}>
                {currentSignal.news_sentiment || 'neutral'}
              </span>
            </div>
          </div>

          {/* Razonamiento de la IA */}
          <div className="reasoning-section">
            <h3>🧠 Análisis de la IA:</h3>
            <ul className="reasoning-list">
              {currentSignal.reasoning?.map((reason, index) => (
                <li key={index}>{reason}</li>
              )) || <li>No hay análisis disponible</li>}
            </ul>
          </div>

          {/* Indicadores técnicos */}
          {currentSignal.technical_indicators && (
            <div className="indicators-section">
              <h3>📊 Indicadores Técnicos:</h3>
              <div className="indicators-grid">
                {Object.entries(currentSignal.technical_indicators).map(([key, value]) => (
                  <div key={key} className="indicator-item">
                    <span className="indicator-name">{key.toUpperCase()}:</span>
                    <span className="indicator-value">{value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Datos de mercado */}
          {marketData && (
            <div className="market-data-section">
              <h3>📈 Datos de Mercado:</h3>
              <div className="market-grid">
                <div className="market-item">
                  <span>Precio Actual:</span>
                  <span>${marketData.price.toFixed(6)}</span>
                </div>
                <div className="market-item">
                  <span>Cambio 24h:</span>
                  <span className={marketData.price_change_24h >= 0 ? 'positive' : 'negative'}>
                    {marketData.price_change_24h.toFixed(2)}%
                  </span>
                </div>
                <div className="market-item">
                  <span>Volumen:</span>
                  <span>{marketData.volume.toLocaleString()}</span>
                </div>
                <div className="market-item">
                  <span>RSI:</span>
                  <span>{marketData.rsi?.toFixed(2) || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="action-buttons">
            <button 
              className="copy-signal-btn"
              onClick={() => {
                const signalText = `
🎯 SEÑAL BTS/USDT
Acción: ${currentSignal.signal}
Confianza: ${currentSignal.confidence.toFixed(1)}%
Precio: $${currentSignal.entry_price.toFixed(6)}
Objetivo: $${currentSignal.target_price?.toFixed(6)}
Stop Loss: $${currentSignal.stop_loss?.toFixed(6)}
Duración: ${currentSignal.expected_duration}

📊 Análisis:
${currentSignal.reasoning?.join('\n') || 'No disponible'}

⚠️ Esto es solo una señal. Tú decides si operar.
                `;
                navigator.clipboard.writeText(signalText);
                alert('📋 Señal copiada al portapapeles!');
              }}
            >
              📋 Copiar Señal
            </button>
            
            <div className="trade-result-buttons">
              <span>¿Copiaste la señal?</span>
              <button 
                className="success-btn"
                onClick={() => recordTradeResult(
                  currentSignal.id, 
                  currentSignal.entry_price, 
                  currentSignal.target_price, 
                  true
                )}
              >
                ✅ Fue exitosa
              </button>
              <button 
                className="fail-btn"
                onClick={() => recordTradeResult(
                  currentSignal.id, 
                  currentSignal.entry_price, 
                  currentSignal.stop_loss, 
                  false
                )}
              >
                ❌ Fue perdedor
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-signal">
          <p>⏳ Cargando señal actual...</p>
        </div>
      )}
    </div>
  );

  // Componente de historial
  const HistoryPanel = () => (
    <div className="panel">
      <div className="panel-header">
        <h2>📜 Historial de Señales</h2>
        <button onClick={fetchTradingHistory} className="refresh-btn">
          🔄 Actualizar
        </button>
      </div>
      
      <div className="history-list">
        {tradingHistory.length > 0 ? (
          tradingHistory.map((signal, index) => (
            <div key={signal.id || index} className={`history-item ${signal.signal.toLowerCase()}`}>
              <div className="history-header">
                <span className={`signal-badge ${signal.signal.toLowerCase()}`}>
                  {signal.signal}
                </span>
                <span className="timestamp">
                  {new Date(signal.timestamp).toLocaleString()}
                </span>
                <span className="confidence">{signal.confidence.toFixed(1)}%</span>
              </div>
              <div className="history-details">
                <div>Precio: ${signal.entry_price.toFixed(6)}</div>
                <div>Objetivo: ${signal.target_price?.toFixed(6) || 'N/A'}</div>
                <div>Stop: ${signal.stop_loss?.toFixed(6) || 'N/A'}</div>
              </div>
              {signal.reasoning && signal.reasoning.length > 0 && (
                <div className="history-reasoning">
                  {signal.reasoning.slice(0, 2).join(' | ')}
                </div>
              )}
            </div>
          ))
        ) : (
          <p>No hay historial disponible</p>
        )}
      </div>
    </div>
  );

  // Componente de rendimiento
  const PerformancePanel = () => (
    <div className="panel">
      <div className="panel-header">
        <h2>📊 Rendimiento del Sistema</h2>
        <button onClick={fetchPerformance} className="refresh-btn">
          🔄 Actualizar
        </button>
      </div>
      
      {performance ? (
        <div className="performance-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{performance.total_trades}</div>
              <div className="stat-label">Total Trades</div>
            </div>
            <div className="stat-card success">
              <div className="stat-value">{performance.success_rate?.toFixed(1) || 0}%</div>
              <div className="stat-label">Tasa de Éxito</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{performance.successful_trades}</div>
              <div className="stat-label">Exitosos</div>
            </div>
            <div className="stat-card fail">
              <div className="stat-value">{performance.failed_trades}</div>
              <div className="stat-label">Fallidos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{performance.avg_profit_loss?.toFixed(2) || 0}%</div>
              <div className="stat-label">Promedio P&L</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{performance.model_confidence?.toFixed(1) || 50}%</div>
              <div className="stat-label">Confianza IA</div>
            </div>
          </div>

          {performance.best_trade && (
            <div className="trade-highlights">
              <div className="best-trade">
                <h3>🏆 Mejor Trade:</h3>
                <div>P&L: +{performance.best_trade.profit_loss_pct?.toFixed(2)}%</div>
                <div>Fecha: {new Date(performance.best_trade.timestamp).toLocaleDateString()}</div>
              </div>
              <div className="worst-trade">
                <h3>📉 Peor Trade:</h3>
                <div>P&L: {performance.worst_trade.profit_loss_pct?.toFixed(2)}%</div>
                <div>Fecha: {new Date(performance.worst_trade.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          )}

          {performance.recent_performance && (
            <div className="recent-performance">
              <h3>📈 Rendimiento Reciente:</h3>
              <div className="performance-list">
                {performance.recent_performance.slice(0, 10).map((trade, index) => (
                  <div key={index} className={`performance-item ${trade.success ? 'success' : 'fail'}`}>
                    <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                    <span className={trade.profit_loss_pct >= 0 ? 'positive' : 'negative'}>
                      {trade.profit_loss_pct?.toFixed(2)}%
                    </span>
                    <span>{trade.success ? '✅' : '❌'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p>⏳ Cargando datos de rendimiento...</p>
      )}
    </div>
  );

  // Componente de análisis de errores
  const ErrorsPanel = () => (
    <div className="panel">
      <div className="panel-header">
        <h2>🔍 Análisis de Errores y Aprendizaje</h2>
        <button onClick={fetchErrors} className="refresh-btn">
          🔄 Actualizar
        </button>
      </div>
      
      <div className="errors-content">
        {errors.length > 0 ? (
          errors.map((error, index) => (
            <div key={error.id || index} className="error-item">
              <div className="error-header">
                <span className="error-type">{error.error_type}</span>
                <span className="error-date">
                  {new Date(error.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="error-details">
                <div>
                  <strong>Predicción:</strong> {error.predicted} → 
                  <strong> Resultado:</strong> {error.actual}
                </div>
                <div><strong>Causa Raíz:</strong> {error.root_cause}</div>
                <div><strong>Estrategia de Corrección:</strong> {error.correction_strategy}</div>
                {error.market_context && (
                  <div className="market-context">
                    <strong>Contexto de Mercado:</strong>
                    <pre>{JSON.stringify(error.market_context, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-errors">
            <p>🎉 ¡No hay errores recientes! El sistema está aprendiendo bien.</p>
          </div>
        )}
        
        <div className="learning-summary">
          <h3>🧠 Resumen de Aprendizaje:</h3>
          <p>La IA ha analizado {errors.length} errores y está mejorando continuamente.</p>
          <p>Meta: Alcanzar 90% de tasa de éxito a través del aprendizaje continuo.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="trading-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🚀 Sistema de Trading AI Avanzado</h1>
          <p>BTS/USDT - Señales inteligentes que puedes copiar en Binance</p>
          <ConnectionStatus />
        </div>
      </header>

      {/* Navigation */}
      <nav className="app-nav">
        <button 
          className={`nav-btn ${activeTab === 'signal' ? 'active' : ''}`}
          onClick={() => setActiveTab('signal')}
        >
          🎯 Señal Actual
        </button>
        <button 
          className={`nav-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Historial
        </button>
        <button 
          className={`nav-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          📊 Rendimiento
        </button>
        <button 
          className={`nav-btn ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          🔍 Errores & IA
        </button>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {activeTab === 'signal' && <SignalPanel />}
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'performance' && <PerformancePanel />}
        {activeTab === 'errors' && <ErrorsPanel />}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="disclaimer">
            <h3>⚠️ IMPORTANTE:</h3>
            <p>
              Este sistema proporciona señales de trading educativas. 
              <strong> TÚ DECIDES si copiar las operaciones en tu cuenta real de Binance.</strong>
              Siempre gestiona tu riesgo y nunca inviertas más de lo que puedes permitirte perder.
            </p>
          </div>
          <div className="system-info">
            <p>Sistema de IA con aprendizaje continuo | Objetivo: 90% tasa de éxito</p>
            <p>Actualización automática cada 30 segundos</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;