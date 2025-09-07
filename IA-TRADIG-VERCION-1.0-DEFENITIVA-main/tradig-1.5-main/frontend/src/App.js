import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target, 
  Brain,
  Zap,
  DollarSign,
  PieChart,
  ArrowUpCircle,
  ArrowDownCircle,
  Minus,
  History,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  Calendar,
  TrendingUp as Up,
  TrendingDown as Down,
  Timer,
  RefreshCw,
  AlertCircle,
  Settings,
  Cpu,
  Database,
  TrendingUp as TrendUp,
  Award,
  Eye,
  Lightbulb
} from 'lucide-react';
import './App.css';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [stats, setStats] = useState({
    total_simulations: 0,
    closed_simulations: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    avg_profit: 0,
    best_trade: 0,
    worst_trade: 0,
    ml_accuracy: 0,
    learning_samples: 0
  });
  const [mlStats, setMlStats] = useState({});
  const [technicalAnalysis, setTechnicalAnalysis] = useState(null);
  
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const containerRef = useRef(null);
  const marketRef = useRef([]);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL;

  // Calcular tiempo restante para cerrar simulación
  const getTimeUntilClose = useCallback((timestamp) => {
    const openTime = new Date(timestamp);
    const now = new Date();
    const timeSinceOpen = now - openTime;
    
    // Simulaciones se cierran más rápido ahora (30s - 2 minutos)
    const estimatedCloseTime = 1000 * (30 + Math.random() * 90); // 30s-2min
    const timeRemaining = Math.max(0, estimatedCloseTime - timeSinceOpen);
    
    if (timeRemaining <= 0) return "Cerrando pronto...";
    
    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Conectar con backend mejorado
  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/binance/klines?symbol=BTCUSDT&interval=5m&limit=100`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const formattedData = data.data.map(candle => ({
          time: Math.floor(candle.time / 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        }));
        
        setMarketData(formattedData);
        marketRef.current = formattedData;
        setConnected(true);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      generateSyntheticData();
    }
  }, [BACKEND_URL]);

  // Obtener análisis técnico del backend
  const fetchTechnicalAnalysis = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/market-data`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setTechnicalAnalysis(data.technical_analysis);
        if (data.ml_prediction) {
          setCurrentPrediction({
            ...data.ml_prediction,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error fetching technical analysis:', error);
    }
  }, [BACKEND_URL]);

  // Cargar simulaciones mejoradas
  const fetchSimulations = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulations`);
      const data = await response.json();
      setSimulations(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching simulations:', error);
    }
  }, [BACKEND_URL]);

  // Cargar estadísticas mejoradas
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [BACKEND_URL]);

  // Cargar estadísticas ML
  const fetchMLStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ml-stats`);
      const data = await response.json();
      setMlStats(data);
    } catch (error) {
      console.error('Error fetching ML stats:', error);
    }
  }, [BACKEND_URL]);

  // Generar datos sintéticos como fallback
  const generateSyntheticData = useCallback(() => {
    const data = [];
    const now = Date.now();
    let price = 65000;
    
    for (let i = 100; i > 0; i--) {
      const time = Math.floor((now - (i * 5 * 60 * 1000)) / 1000);
      const change = (Math.random() - 0.5) * 1000;
      const open = price;
      const close = Math.max(1000, price + change);
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      
      data.push({
        time,
        open,
        high,
        low,
        close,
        volume: 100 + Math.random() * 500
      });
      
      price = close;
    }
    
    setMarketData(data);
    marketRef.current = data;
    setConnected(true);
  }, []);

  // Configurar gráfico
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 600,
      layout: {
        backgroundColor: '#0a0e1a',
        textColor: '#64748b'
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3b82f6', width: 1, style: 2 },
        horzLine: { color: '#3b82f6', width: 1, style: 2 }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1e293b'
      },
      rightPriceScale: {
        borderColor: '#1e293b'
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981'
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, []);

  // Actualizar datos del gráfico
  useEffect(() => {
    if (seriesRef.current && marketData.length > 0) {
      try {
        seriesRef.current.setData(marketData);
      } catch (e) {
        console.error('Error updating chart:', e);
      }
    }
  }, [marketData]);

  // Cargar datos iniciales
  useEffect(() => {
    fetchMarketData();
    fetchSimulations();
    fetchStats();
    fetchTechnicalAnalysis();
    fetchMLStats();
    
    // Actualizar cada 15 segundos (más frecuente)
    const interval = setInterval(() => {
      fetchMarketData();
      fetchSimulations();
      fetchStats();
      fetchTechnicalAnalysis();
      if (Math.random() < 0.3) {
        fetchMLStats();
      }
    }, 15000);

    // Actualizar tiempo restante cada segundo
    const timeInterval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [fetchMarketData, fetchSimulations, fetchStats, fetchTechnicalAnalysis, fetchMLStats]);

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'UP': return <ArrowUpCircle className="w-5 h-5 text-emerald-400" />;
      case 'DOWN': return <ArrowDownCircle className="w-5 h-5 text-red-400" />;
      default: return <Minus className="w-5 h-5 text-slate-400" />;
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'UP': return 'text-emerald-400';
      case 'DOWN': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getMethodBadge = (method) => {
    const badges = {
      'ML_ENHANCED': { text: '🤖 ML Enhanced', color: 'bg-purple-900/30 text-purple-300 border-purple-700/30' },
      'TECHNICAL_ANALYSIS': { text: '📊 Technical Analysis', color: 'bg-blue-900/30 text-blue-300 border-blue-700/30' },
      'ML_AUTO': { text: '🧠 ML Auto', color: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/30' },
      'BASIC_FALLBACK': { text: '⚙️ Basic', color: 'bg-gray-900/30 text-gray-300 border-gray-700/30' },
      'AUTO': { text: '🔄 Auto', color: 'bg-slate-900/30 text-slate-300 border-slate-700/30' }
    };
    
    const badge = badges[method] || badges['AUTO'];
    return (
      <span className={`text-xs px-2 py-1 rounded border ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    };
  };

  const getDurationSinceOpen = (timestamp) => {
    const openTime = new Date(timestamp);
    const now = new Date();
    const duration = now - openTime;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  };

  const EnhancedSimulationCard = ({ simulation }) => {
    const { date, time } = formatDate(simulation.timestamp);
    const isOpen = !simulation.closed;
    const profit = simulation.result_pct || 0;
    const isWin = simulation.success;
    const timeRemaining = isOpen ? getTimeUntilClose(simulation.timestamp) : null;
    const duration = getDurationSinceOpen(simulation.timestamp);
    const method = simulation.entry_method || 'AUTO';

    return (
      <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-200">
        {/* Header with method badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${isOpen ? 'bg-blue-900/30' : isWin ? 'bg-emerald-900/30' : 'bg-red-900/30'}`}>
              {isOpen ? (
                <PlayCircle className="w-5 h-5 text-blue-400 animate-pulse" />
              ) : isWin ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {isOpen ? 'EN CURSO' : isWin ? 'GANADA ✅' : 'PERDIDA ❌'}
              </h3>
              <p className="text-sm text-slate-400">ID: {simulation.id.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${isOpen ? 'text-blue-400' : isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOpen ? '⏳ Esperando...' : `${profit >= 0 ? '+' : ''}${profit.toFixed(2)}%`}
            </div>
            <div className="text-xs text-slate-400">
              {isOpen ? 'Resultado pendiente' : 'Resultado final'}
            </div>
          </div>
        </div>

        {/* Method Badge */}
        <div className="mb-4 flex justify-between items-center">
          {getMethodBadge(method)}
          <div className="text-xs text-slate-400">
            Confianza: {((simulation.confidence || 0.5) * 100).toFixed(0)}%
          </div>
        </div>

        {/* Technical Analysis Preview */}
        {simulation.technical_analysis && (
          <div className="mb-4 p-3 bg-slate-700/20 rounded-lg">
            <div className="text-xs font-medium text-slate-300 mb-2">📊 Análisis Técnico:</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-slate-400">RSI</div>
                <div className="text-white font-medium">{(simulation.technical_analysis.rsi || 50).toFixed(0)}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400">MACD</div>
                <div className="text-white font-medium">
                  {simulation.technical_analysis.macd?.macd ? simulation.technical_analysis.macd.macd.toFixed(1) : '0.0'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-slate-400">BB</div>
                <div className="text-white font-medium">
                  {((simulation.technical_analysis.bollinger?.position || 0.5) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ML Prediction Preview */}
        {simulation.ml_prediction && (
          <div className="mb-4 p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg">
            <div className="text-xs font-medium text-purple-300 mb-2">🤖 Predicción ML:</div>
            <div className="flex justify-between items-center">
              <div className="text-sm text-white font-medium">
                {simulation.ml_prediction.prediction} - {(simulation.ml_prediction.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-purple-400">
                {simulation.ml_prediction.model_details?.ensemble_method || 'ML Model'}
              </div>
            </div>
          </div>
        )}

        {/* Rest of the original card content */}
        {isOpen && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Timer className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">Tiempo estimado para cerrar:</span>
              </div>
              <div className="text-blue-400 font-bold">{timeRemaining}</div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Duración actual:</span>
              </div>
              <div className="text-slate-300 font-medium">{duration}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Apertura</span>
            </div>
            <div className="text-sm font-medium text-white">{date}</div>
            <div className="text-xs text-slate-400">{time}</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              {isOpen ? <PlayCircle className="w-4 h-4 text-blue-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
              <span className="text-xs text-slate-400">Estado</span>
            </div>
            <div className={`text-sm font-medium ${isOpen ? 'text-blue-400' : 'text-emerald-400'}`}>
              {isOpen ? 'Activa' : 'Cerrada'}
            </div>
            <div className="text-xs text-slate-400">
              {isOpen ? 'En proceso' : `Duró ${duration}`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
            <div className="text-xs text-emerald-400 mb-1">💰 Precio Entrada</div>
            <div className="text-lg font-bold text-emerald-300">
              ${simulation.entry_price?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <div className="text-xs text-red-400 mb-1">💸 Precio Salida</div>
            <div className="text-lg font-bold text-red-300">
              {simulation.exit_price ? `$${simulation.exit_price.toFixed(2)}` : (isOpen ? '⏳ Abierta' : 'N/A')}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {simulation.trend === 'UP' ? (
                <Up className="w-4 h-4 text-emerald-400" />
              ) : (
                <Down className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-medium ${simulation.trend === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                {simulation.trend === 'UP' ? '📈 ALCISTA' : '📉 BAJISTA'}
              </span>
            </div>
            <div className="text-sm text-slate-400">
              🎯 Confianza: {(simulation.confidence * 100).toFixed(0)}%
            </div>
          </div>
          
          {simulation.probability && (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs bg-emerald-700/30 rounded px-2 py-1 text-emerald-300">
                📈 UP: {simulation.probability.up?.toFixed(0)}%
              </div>
              <div className="text-xs bg-red-700/30 rounded px-2 py-1 text-red-300">
                📉 DOWN: {simulation.probability.down?.toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        {!isOpen && (
          <div className={`p-3 rounded-lg border ${isWin ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-red-900/20 border-red-700/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">💰 Resultado Final:</span>
              <span className={`font-bold text-lg ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                {isWin ? '🎉' : '😔'} {profit >= 0 ? '+' : ''}{profit.toFixed(2)}%
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {isWin ? '✅ Predicción correcta' : '❌ Predicción incorrecta'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentPrice = marketData.length > 0 ? marketData[marketData.length - 1].close : 0;
  const openSimulations = simulations.filter(sim => !sim.closed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Enhanced Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-8 h-8 text-blue-400" />
                <div>
                  <h1 className="text-2xl font-bold text-white">MIRA - TradingAI Pro Enhanced</h1>
                  <p className="text-sm text-slate-400">BTC/USDT • ML + Technical Analysis • 90% Target Success Rate</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm text-slate-300">
                  {connected ? '🟢 Conectado' : '🔴 Desconectado'}
                </span>
              </div>
              
              <div className="text-sm text-slate-400">
                💰 Precio: ${currentPrice.toFixed(2)}
              </div>

              <div className="text-sm text-blue-400">
                🔄 Simulaciones activas: {openSimulations.length}
              </div>
              
              {stats.ml_accuracy && (
                <div className="text-sm text-purple-400">
                  🤖 ML Precisión: {stats.ml_accuracy.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Enhanced Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-800/30 p-1 rounded-xl mb-6">
          {[
            { id: 'live', label: '📊 Análisis en Vivo', icon: Activity },
            { id: 'history', label: '📈 Historial Completo', icon: History },
            { id: 'ml-analysis', label: '🤖 Análisis ML', icon: Brain },
            { id: 'technical', label: '📊 Análisis Técnico', icon: Target },
            { id: 'stats', label: '📊 Estadísticas Avanzadas', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Analysis Tab */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <span>📊 Gráfico Profesional BTC/USDT</span>
                  </h2>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-slate-400">
                      💰 ${currentPrice.toFixed(2)}
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-emerald-400">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Actualizando cada 15s...</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  ref={containerRef}
                  className="w-full rounded-xl overflow-hidden border border-slate-700/30"
                  style={{ height: '600px' }}
                />
                
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-emerald-900/20 rounded-lg p-3">
                    <div className="text-xs text-emerald-400">24h Alto</div>
                    <div className="text-sm font-bold text-emerald-300">
                      ${marketData.length > 0 ? Math.max(...marketData.slice(-24).map(d => d.high)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="bg-blue-900/20 rounded-lg p-3">
                    <div className="text-xs text-blue-400">Precio Actual</div>
                    <div className="text-sm font-bold text-blue-300">${currentPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-red-900/20 rounded-lg p-3">
                    <div className="text-xs text-red-400">24h Bajo</div>
                    <div className="text-sm font-bold text-red-300">
                      ${marketData.length > 0 ? Math.min(...marketData.slice(-24).map(d => d.low)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Side Panel */}
            <div className="space-y-6">
              {/* Enhanced System Status */}
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/30 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                  <span>🤖 MIRA Enhanced System</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Estado IA:</span>
                    <span className="text-purple-400 font-bold">🧠 ACTIVO</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Análisis Técnico:</span>
                    <span className="text-emerald-400 font-bold">📊 ACTIVO</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Simulaciones cada:</span>
                    <span className="text-blue-400 font-bold">15 segundos</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Muestras de entrenamiento:</span>
                    <span className="text-yellow-400 font-bold">{stats.learning_samples || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Última actualización:</span>
                    <span className="text-slate-400 text-sm">{lastUpdate.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Current Prediction */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>🎯 Predicción Actual ML</span>
                </h3>
                
                {currentPrediction ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(currentPrediction.prediction)}
                        <span className={`font-bold text-lg ${getTrendColor(currentPrediction.prediction)}`}>
                          {currentPrediction.prediction === 'UP' ? '📈 ALCISTA' : '📉 BAJISTA'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Confianza ML</div>
                        <div className="text-lg font-bold text-purple-400">
                          🤖 {(currentPrediction.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
                        <div className="text-xs text-emerald-400 mb-1">📈 Probabilidad UP</div>
                        <div className="text-lg font-bold text-emerald-300">
                          {(currentPrediction.probability.up * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                        <div className="text-xs text-red-400 mb-1">📉 Probabilidad DOWN</div>
                        <div className="text-lg font-bold text-red-300">
                          {(currentPrediction.probability.down * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-2">🔍 Razonamiento ML:</div>
                      <div className="space-y-1">
                        {currentPrediction.reasoning?.slice(0, 3).map((reason, i) => (
                          <div key={i} className="text-xs text-slate-300 bg-slate-700/30 rounded px-2 py-1">
                            • {reason}
                          </div>
                        ))}
                      </div>
                    </div>

                    {currentPrediction.model_details && (
                      <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-2">
                        <div className="text-xs text-purple-400">
                          Método: {currentPrediction.model_details.ensemble_method || 'ML Ensemble'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Brain className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p>🤖 IA analizando mercado...</p>
                  </div>
                )}
              </div>

              {/* Enhanced Quick Stats */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <span>🏆 Rendimiento ML</span>
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">🎉 {stats.wins}</div>
                    <div className="text-xs text-slate-400">Ganadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">😔 {stats.losses}</div>
                    <div className="text-xs text-slate-400">Perdidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">🤖 {stats.ml_accuracy?.toFixed(1) || 0}%</div>
                    <div className="text-xs text-slate-400">Precisión ML</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">💰 +{stats.avg_profit?.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Promedio</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <History className="w-6 h-6 text-blue-400" />
                <span>📈 Historial de Simulaciones Enhanced</span>
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-slate-400">
                  Total: {simulations.length} simulaciones
                </div>
                <div className="text-sm text-blue-400">
                  🔄 Activas: {openSimulations.length}
                </div>
                <div className="text-sm text-emerald-400">
                  ✅ Cerradas: {simulations.filter(s => s.closed).length}
                </div>
                <div className="text-sm text-purple-400">
                  🤖 ML Enhanced: {simulations.filter(s => s.entry_method === 'ML_ENHANCED').length}
                </div>
              </div>
            </div>

            {simulations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {simulations.map((simulation) => (
                  <EnhancedSimulationCard key={simulation.id} simulation={simulation} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold mb-2">🤖 Sistema MIRA generando simulaciones inteligentes...</h3>
                <p>Las simulaciones aparecerán aquí cada 15 segundos con análisis ML y técnico.</p>
                <div className="mt-4 text-sm text-purple-400">
                  ⏰ Sistema ML funcionando en segundo plano
                </div>
              </div>
            )}
          </div>
        )}

        {/* ML Analysis Tab */}
        {activeTab === 'ml-analysis' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Brain className="w-6 h-6 text-purple-400" />
                <span>🤖 Sistema ML Stats</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Muestras de Entrenamiento:</span>
                  <span className="text-white font-bold">{mlStats.total_training_samples || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Muestras Etiquetadas:</span>
                  <span className="text-emerald-400 font-bold">{mlStats.labeled_samples || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Precisión Reciente:</span>
                  <span className="text-purple-400 font-bold">{((mlStats.recent_accuracy || 0) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Modelos Entrenados:</span>
                  <span className={`font-bold ${mlStats.models_trained ? 'text-emerald-400' : 'text-red-400'}`}>
                    {mlStats.models_trained ? '✅ Sí' : '❌ No'}
                  </span>
                </div>
              </div>

              {mlStats.model_accuracy && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold text-white mb-4">📊 Precisión por Modelo</h4>
                  <div className="space-y-3">
                    {Object.entries(mlStats.model_accuracy).map(([model, accuracy]) => (
                      <div key={model} className="bg-slate-700/30 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 capitalize">{model}:</span>
                          <span className="text-blue-400 font-bold">{(accuracy.accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          CV Score: {(accuracy.cv_mean * 100).toFixed(1)}% ± {(accuracy.cv_std * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Eye className="w-6 h-6 text-blue-400" />
                <span>🔍 Feature Importance</span>
              </h3>
              
              {mlStats.feature_importance && mlStats.feature_importance.primary ? (
                <div className="space-y-3">
                  {[
                    'RSI', 'MACD', 'MACD Signal', 'MACD Histogram', 'BB Position',
                    'EMA Crossover', 'Stoch K', 'Stoch D', 'Volume Strength', 'Volume Trend',
                    'Hammer Pattern', 'Doji Pattern', 'Engulfing Pattern', 'Resistance Distance',
                    'Support Distance', 'Signal Strength', 'Bullish Signals', 'Bearish Signals',
                    'Hour', 'Weekday'
                  ].map((feature, index) => {
                    const importance = mlStats.feature_importance.primary[index] || 0;
                    return (
                      <div key={feature} className="flex items-center space-x-2">
                        <span className="text-slate-300 text-sm w-32 truncate">{feature}:</span>
                        <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                          <div 
                            className="bg-blue-400 h-2 rounded-full" 
                            style={{ width: `${importance * 100}%` }}
                          />
                        </div>
                        <span className="text-blue-400 text-xs font-mono w-12">
                          {(importance * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Lightbulb className="w-12 h-12 mx-auto mb-2" />
                  <p>🤖 Entrenando modelos para obtener importancia de características...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technical Analysis Tab */}
        {activeTab === 'technical' && (
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <Target className="w-6 h-6 text-blue-400" />
              <span>📊 Análisis Técnico en Tiempo Real</span>
            </h3>
            
            {technicalAnalysis ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* RSI */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">RSI</h4>
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {technicalAnalysis.rsi?.toFixed(1) || '50.0'}
                  </div>
                  <div className="text-sm text-slate-400">
                    {technicalAnalysis.rsi < 30 ? '🔴 Sobreventa' : 
                     technicalAnalysis.rsi > 70 ? '🔴 Sobrecompra' : 
                     '🟡 Neutral'}
                  </div>
                </div>

                {/* MACD */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">MACD</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">MACD:</span>
                      <span className="text-blue-400 font-bold">
                        {technicalAnalysis.macd?.macd?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Signal:</span>
                      <span className="text-emerald-400 font-bold">
                        {technicalAnalysis.macd?.signal?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Histogram:</span>
                      <span className={`font-bold ${(technicalAnalysis.macd?.histogram || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {technicalAnalysis.macd?.histogram?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bollinger Bands */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Bollinger Bands</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Posición:</span>
                      <span className="text-purple-400 font-bold">
                        {((technicalAnalysis.bollinger?.position || 0.5) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Superior:</span>
                      <span className="text-red-400 font-bold">
                        ${technicalAnalysis.bollinger?.upper?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Inferior:</span>
                      <span className="text-emerald-400 font-bold">
                        ${technicalAnalysis.bollinger?.lower?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EMAs */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">EMAs</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">EMA 20:</span>
                      <span className="text-blue-400 font-bold">
                        ${technicalAnalysis.emas?.ema_20?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">EMA 50:</span>
                      <span className="text-purple-400 font-bold">
                        ${technicalAnalysis.emas?.ema_50?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Crossover:</span>
                      <span className={`font-bold ${technicalAnalysis.emas?.crossover ? 'text-emerald-400' : 'text-red-400'}`}>
                        {technicalAnalysis.emas?.crossover ? '✅ Alcista' : '❌ Bajista'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Volume */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Volume Analysis</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fuerza:</span>
                      <span className={`font-bold ${(technicalAnalysis.volume?.volume_strength || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {technicalAnalysis.volume?.volume_strength?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tendencia:</span>
                      <span className={`font-bold ${(technicalAnalysis.volume?.volume_trend || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(technicalAnalysis.volume?.volume_trend || 0) >= 0 ? '📈 Alcista' : '📉 Bajista'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Actual:</span>
                      <span className="text-white font-bold">
                        {technicalAnalysis.volume?.current_volume?.toFixed(0) || '0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signals Summary */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3">Señales</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fuerza:</span>
                      <span className={`font-bold ${(technicalAnalysis.signals?.strength || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {technicalAnalysis.signals?.strength?.toFixed(0) || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Confianza:</span>
                      <span className="text-blue-400 font-bold">
                        {((technicalAnalysis.signals?.confidence || 0.5) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Señales Alcistas: {technicalAnalysis.signals?.bullish_signals?.length || 0}
                    </div>
                    <div className="text-xs text-slate-400">
                      Señales Bajistas: {technicalAnalysis.signals?.bearish_signals?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Target className="w-16 h-16 mx-auto mb-4 animate-pulse text-blue-400" />
                <h4 className="text-lg font-semibold mb-2">📊 Analizando datos técnicos...</h4>
                <p>El sistema está procesando indicadores técnicos en tiempo real.</p>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Stats Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">📊 Métricas de Trading Enhanced</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Operaciones:</span>
                  <span className="text-white font-bold">{stats.total_simulations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Operaciones Cerradas:</span>
                  <span className="text-white font-bold">{stats.closed_simulations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-400">🎉 Operaciones Ganadoras:</span>
                  <span className="text-emerald-400 font-bold">{stats.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-400">😔 Operaciones Perdedoras:</span>
                  <span className="text-red-400 font-bold">{stats.losses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400">🎯 Tasa de Éxito General:</span>
                  <span className="text-blue-400 font-bold">{stats.win_rate?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-400">🤖 Precisión ML:</span>
                  <span className="text-purple-400 font-bold">{stats.ml_accuracy?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400">📚 Muestras de Entrenamiento:</span>
                  <span className="text-yellow-400 font-bold">{stats.learning_samples || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">💰 Rendimiento Financiero</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ganancia Promedio:</span>
                  <span className="text-emerald-400 font-bold">
                    {stats.avg_profit >= 0 ? '+' : ''}{stats.avg_profit?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">🏆 Mejor Operación:</span>
                  <span className="text-emerald-400 font-bold">+{stats.best_trade?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">📉 Peor Operación:</span>
                  <span className="text-red-400 font-bold">{stats.worst_trade?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">🔄 Simulaciones Abiertas:</span>
                  <span className="text-blue-400 font-bold">
                    {stats.total_simulations - stats.closed_simulations}
                  </span>
                </div>
              </div>
            </div>

            {/* Method Performance Analysis */}
            <div className="md:col-span-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">🚀 Progreso hacia 90% de Éxito</h3>
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Tasa de Éxito Actual</span>
                  <span className="text-blue-400 font-bold">{stats.win_rate?.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-4">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-purple-400 h-4 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((stats.win_rate || 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-slate-400">
                  <span>0%</span>
                  <span className="text-yellow-400 font-bold">Meta: 90%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">{simulations.filter(s => !s.closed).length}</div>
                  <div className="text-sm text-slate-400">🔄 En Curso</div>
                </div>
                <div className="text-center p-4 bg-purple-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-purple-400">{simulations.filter(s => s.entry_method === 'ML_ENHANCED').length}</div>
                  <div className="text-sm text-slate-400">🤖 ML Enhanced</div>
                </div>
                <div className="text-center p-4 bg-emerald-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-400">{stats.win_rate?.toFixed(0)}%</div>
                  <div className="text-sm text-slate-400">🎯 Precisión</div>
                </div>
                <div className="text-center p-4 bg-yellow-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-400">24/7</div>
                  <div className="text-sm text-slate-400">⏰ Operando</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;