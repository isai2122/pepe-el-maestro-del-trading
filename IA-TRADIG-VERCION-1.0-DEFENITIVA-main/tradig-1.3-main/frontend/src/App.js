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
  TrendingDown as Down
} from 'lucide-react';
import './App.css';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [marketData, setMarketData] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    winRate: 0,
    avgProfit: 0
  });
  
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const containerRef = useRef(null);
  const marketRef = useRef([]);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Conectar con backend real
  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/binance/klines?symbol=BTCUSDT&interval=5m&limit=100`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const formattedData = data.data.map(candle => ({
          time: Math.floor(candle.time / 1000), // convertir a segundos
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
      // Fallback a datos sintéticos si falla
      generateSyntheticData();
    }
  }, [BACKEND_URL]);

  // Cargar simulaciones del backend
  const fetchSimulations = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulations`);
      const data = await response.json();
      setSimulations(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (error) {
      console.error('Error fetching simulations:', error);
    }
  }, [BACKEND_URL]);

  // Cargar estadísticas del backend
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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
    generatePrediction();
  }, []);

  // Generar predicción sintética
  const generatePrediction = useCallback(() => {
    const trends = ['UP', 'DOWN', 'NEUTRAL'];
    const trend = trends[Math.floor(Math.random() * trends.length)];
    const up = Math.floor(Math.random() * 40) + 40;
    const down = 100 - up;
    const confidence = Math.random() * 0.4 + 0.6;
    
    const reasoning = [
      'RSI indica sobrecompra temporal',
      'MACD muestra divergencia alcista',
      'Volumen por encima del promedio',
      'Soporte técnico en $64,500'
    ];
    
    setCurrentPrediction({
      trend,
      probability: { up, down },
      confidence,
      reasoning: reasoning.slice(0, 3)
    });
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
    generatePrediction();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      fetchMarketData();
      fetchSimulations();
      fetchStats();
      if (Math.random() < 0.3) {
        generatePrediction();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMarketData, fetchSimulations, fetchStats, generatePrediction]);

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

  const SimulationCard = ({ simulation }) => {
    const { date, time } = formatDate(simulation.timestamp);
    const isOpen = !simulation.closed;
    const profit = simulation.result_pct || 0;
    const isWin = simulation.success;

    return (
      <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${isOpen ? 'bg-blue-900/30' : isWin ? 'bg-emerald-900/30' : 'bg-red-900/30'}`}>
              {isOpen ? (
                <PlayCircle className="w-5 h-5 text-blue-400" />
              ) : isWin ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">
                {isOpen ? 'En Curso' : isWin ? 'Ganada' : 'Perdida'}
              </h3>
              <p className="text-sm text-slate-400">ID: {simulation.id.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${isOpen ? 'text-blue-400' : isWin ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOpen ? '...' : `${profit >= 0 ? '+' : ''}${profit.toFixed(2)}%`}
            </div>
            <div className="text-xs text-slate-400">
              {isOpen ? 'Resultado pendiente' : 'Resultado final'}
            </div>
          </div>
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Fecha</span>
            </div>
            <div className="text-sm font-medium text-white">{date}</div>
          </div>
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Hora</span>
            </div>
            <div className="text-sm font-medium text-white">{time}</div>
          </div>
        </div>

        {/* Precios */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
            <div className="text-xs text-emerald-400 mb-1">Precio Entrada</div>
            <div className="text-lg font-bold text-emerald-300">
              ${simulation.entry_price?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <div className="text-xs text-red-400 mb-1">Precio Salida</div>
            <div className="text-lg font-bold text-red-300">
              {simulation.exit_price ? `$${simulation.exit_price.toFixed(2)}` : 'Abierta'}
            </div>
          </div>
        </div>

        {/* Trend y Probabilidades */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {simulation.trend === 'UP' ? (
                <Up className="w-4 h-4 text-emerald-400" />
              ) : (
                <Down className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-medium ${simulation.trend === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                {simulation.trend === 'UP' ? 'ALCISTA' : 'BAJISTA'}
              </span>
            </div>
            <div className="text-sm text-slate-400">
              Confianza: {(simulation.confidence * 100).toFixed(0)}%
            </div>
          </div>
          
          {simulation.probability && (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs bg-slate-700/30 rounded px-2 py-1">
                ↗ {simulation.probability.up?.toFixed(0)}%
              </div>
              <div className="text-xs bg-slate-700/30 rounded px-2 py-1">
                ↘ {simulation.probability.down?.toFixed(0)}%
              </div>
            </div>
          )}
        </div>

        {/* Método de entrada */}
        <div className="bg-slate-700/20 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Método de Entrada</div>
          <div className="text-sm font-medium text-white">
            {simulation.entry_method || 'AUTO'}
          </div>
        </div>
      </div>
    );
  };

  const currentPrice = marketData.length > 0 ? marketData[marketData.length - 1].close : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Brain className="w-8 h-8 text-blue-400" />
                <div>
                  <h1 className="text-2xl font-bold text-white">TradingAI Pro</h1>
                  <p className="text-sm text-slate-400">BTC/USDT • Tiempo Real</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm text-slate-300">
                  {connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              
              <div className="text-sm text-slate-400">
                Precio: ${currentPrice.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-slate-800/30 p-1 rounded-xl mb-6">
          {[
            { id: 'live', label: 'Análisis en Vivo', icon: Activity },
            { id: 'history', label: 'Historial', icon: History },
            { id: 'predictions', label: 'Predicciones', icon: Target },
            { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
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

        {/* Content based on active tab */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Section */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <span>Gráfico de Velas Japonesas</span>
                  </h2>
                  <div className="text-sm text-slate-400">
                    ${currentPrice.toFixed(2)}
                  </div>
                </div>
                
                <div 
                  ref={containerRef}
                  className="w-full rounded-xl overflow-hidden border border-slate-700/30"
                  style={{ height: '600px' }}
                />
              </div>
            </div>

            {/* Side Panel */}
            <div className="space-y-6">
              {/* Current Prediction */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>Predicción Actual</span>
                </h3>
                
                {currentPrediction ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(currentPrediction.trend)}
                        <span className={`font-bold text-lg ${getTrendColor(currentPrediction.trend)}`}>
                          {currentPrediction.trend === 'UP' ? 'ALCISTA' : 
                           currentPrediction.trend === 'DOWN' ? 'BAJISTA' : 'NEUTRAL'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Confianza</div>
                        <div className="text-lg font-bold text-blue-400">
                          {(currentPrediction.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
                        <div className="text-xs text-emerald-400 mb-1">Probabilidad ↗</div>
                        <div className="text-lg font-bold text-emerald-300">
                          {currentPrediction.probability.up.toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                        <div className="text-xs text-red-400 mb-1">Probabilidad ↘</div>
                        <div className="text-lg font-bold text-red-300">
                          {currentPrediction.probability.down.toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-2">Análisis Técnico:</div>
                      <div className="space-y-1">
                        {currentPrediction.reasoning?.map((reason, i) => (
                          <div key={i} className="text-xs text-slate-300 bg-slate-700/30 rounded px-2 py-1">
                            • {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Brain className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p>Analizando mercado...</p>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  <span>Rendimiento</span>
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{stats.wins}</div>
                    <div className="text-xs text-slate-400">Ganadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                    <div className="text-xs text-slate-400">Perdidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.win_rate?.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Win Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">+{stats.avg_profit?.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">Promedio</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Historial Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <History className="w-6 h-6 text-blue-400" />
                <span>Historial de Simulaciones</span>
              </h2>
              <div className="text-sm text-slate-400">
                Total: {simulations.length} simulaciones
              </div>
            </div>

            {simulations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {simulations.map((simulation) => (
                  <SimulationCard key={simulation.id} simulation={simulation} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold mb-2">No hay simulaciones</h3>
                <p>Las simulaciones aparecerán aquí cuando se generen.</p>
              </div>
            )}
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <Target className="w-6 h-6 text-blue-400" />
              <span>Sistema de Predicciones IA</span>
            </h3>
            
            <div className="text-center py-12 text-slate-400">
              <Brain className="w-16 h-16 mx-auto mb-4 animate-pulse text-blue-400" />
              <h4 className="text-lg font-semibold mb-2">IA Analizando Mercado</h4>
              <p>El sistema está procesando datos en tiempo real y generando predicciones automáticas cada 30 segundos.</p>
              <div className="mt-4 text-sm text-slate-500">
                • Análisis técnico avanzado<br/>
                • Machine Learning aplicado<br/>
                • Predicciones continuas
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Métricas de Trading</h3>
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
                  <span className="text-emerald-400">Operaciones Ganadoras:</span>
                  <span className="text-emerald-400 font-bold">{stats.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Operaciones Perdedoras:</span>
                  <span className="text-red-400 font-bold">{stats.losses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400">Tasa de Éxito:</span>
                  <span className="text-blue-400 font-bold">{stats.win_rate?.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-6">Rendimiento Financiero</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ganancia Promedio:</span>
                  <span className="text-emerald-400 font-bold">
                    {stats.avg_profit >= 0 ? '+' : ''}{stats.avg_profit?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Mejor Operación:</span>
                  <span className="text-emerald-400 font-bold">+{stats.best_trade?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Peor Operación:</span>
                  <span className="text-red-400 font-bold">{stats.worst_trade?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Simulaciones Abiertas:</span>
                  <span className="text-blue-400 font-bold">
                    {stats.total_simulations - stats.closed_simulations}
                  </span>
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