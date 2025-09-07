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
  Lightbulb,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Radio,
  Shield,
  Star
} from 'lucide-react';
import './App.css';

const RealTimeApp = () => {
  const [wsConnected, setWsConnected] = useState(false);
  const [marketData, setMarketData] = useState([]);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [realTimePrice, setRealTimePrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [volume24h, setVolume24h] = useState(0);
  const [dataSource, setDataSource] = useState('connecting');
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
    learning_samples: 0,
    system_version: "MIRA_Enhanced_v2.0_REAL",
    error_learning_active: true,
    progress_to_90_percent: 0,
    realtime_connection: false
  });
  const [mlStats, setMlStats] = useState({});
  const [technicalAnalysis, setTechnicalAnalysis] = useState(null);
  
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const marketRef = useRef([]);
  const previousPriceRef = useRef(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const WS_URL = BACKEND_URL.replace('http', 'ws') + '/ws/market-data';

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Formatear tiempo
  const formatTime = useCallback((date) => {
    return new Date(date).toLocaleTimeString('es-ES');
  }, []);

  // Obtener icono de tendencia
  const getTrendIcon = useCallback((trend) => {
    return trend === 'UP' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  }, []);

  // Obtener color de tendencia
  const getTrendColor = useCallback((trend) => {
    return trend === 'UP' ? 'text-emerald-400' : 'text-red-400';
  }, []);

  // Formatear números grandes
  const formatLargeNumber = useCallback((num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  }, []);

  // Calcular precio actual desde datos de mercado
  const currentPrice = realTimePrice || (marketData.length > 0 ? marketData[marketData.length - 1].close : 0);

  // Simulaciones abiertas
  const openSimulations = simulations.filter(s => !s.closed);
  const realSimulations = simulations.filter(s => s.entry_method?.includes('REAL'));

  // WebSocket connection for REAL data
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        console.log('🔌 Conectando WebSocket REAL:', WS_URL);
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket REAL conectado');
          setWsConnected(true);
          setDataSource('binance_live');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'market_update' || message.type === 'initial_data') {
              const data = message.data;
              
              // Verificar que son datos REALES
              if (message.real_data && message.source === 'binance_live') {
                setDataSource('100% REAL BINANCE LIVE');
                
                // Actualizar precio en tiempo real
                if (data.close) {
                  const newPrice = parseFloat(data.close);
                  const oldPrice = previousPriceRef.current;
                  
                  setRealTimePrice(newPrice);
                  setPriceChange(newPrice - oldPrice);
                  previousPriceRef.current = newPrice;
                  
                  // Actualizar datos del gráfico si es una vela cerrada
                  if (data.is_closed) {
                    const newCandle = {
                      time: Math.floor(data.time / 1000),
                      open: parseFloat(data.open),
                      high: parseFloat(data.high),
                      low: parseFloat(data.low),
                      close: parseFloat(data.close),
                      volume: parseFloat(data.volume)
                    };
                    
                    setMarketData(prev => {
                      const updated = [...prev];
                      // Reemplazar la última vela si es del mismo tiempo, o agregar nueva
                      if (updated.length > 0 && updated[updated.length - 1].time === newCandle.time) {
                        updated[updated.length - 1] = newCandle;
                      } else {
                        updated.push(newCandle);
                        // Mantener solo las últimas 500 velas
                        if (updated.length > 500) {
                          updated.shift();
                        }
                      }
                      return updated;
                    });
                  }
                  
                  setLastUpdate(new Date());
                }
              }
            }
          } catch (error) {
            console.error('❌ Error procesando mensaje WebSocket REAL:', error);
          }
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket REAL desconectado, reintentando...');
          setWsConnected(false);
          setDataSource('disconnected');
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('❌ Error WebSocket REAL:', error);
          setWsConnected(false);
          setDataSource('error');
        };

      } catch (error) {
        console.error('❌ Error creando WebSocket REAL:', error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [WS_URL]);

  // Obtener datos históricos REALES iniciales
  const fetchInitialMarketData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/binance/klines?symbol=BTCUSDT&interval=1m&limit=500`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const formattedData = data.data.map(item => ({
          time: Math.floor(item.time / 1000),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        }));
        
        setMarketData(formattedData);
        marketRef.current = formattedData;
        
        // Establecer precio inicial si no tenemos datos de WebSocket
        if (formattedData.length > 0 && !realTimePrice) {
          setRealTimePrice(formattedData[formattedData.length - 1].close);
          previousPriceRef.current = formattedData[formattedData.length - 1].close;
        }
        
        // Marcar fuente de datos
        setDataSource(data.source === 'binance_real' ? '100% REAL BINANCE' : 'REAL HTTP FALLBACK');
        
        return formattedData;
      } else {
        console.error('❌ No se pudieron obtener datos REALES de Binance');
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching REAL market data:', error);
      return [];
    }
  }, [BACKEND_URL, realTimePrice]);

  // Obtener datos de precio en tiempo real
  const fetchRealtimePrice = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/realtime-price`);
      const data = await response.json();
      
      if (data.price && data.source === "100% REAL BINANCE") {
        setPriceChange24h(data.price_change_24h || 0);
        setVolume24h(data.volume_24h || 0);
        setDataSource('100% REAL BINANCE LIVE');
      }
    } catch (error) {
      console.error('❌ Error fetching REAL price:', error);
    }
  }, [BACKEND_URL]);

  // Obtener análisis de mercado REAL avanzado
  const fetchMarketAnalysis = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/market-data`);
      const data = await response.json();
      
      if (data && data.status === 'success' && data.data_source === "100% REAL BINANCE") {
        if (data.technical_analysis) {
          setTechnicalAnalysis(data.technical_analysis);
        }
        
        if (data.ml_prediction) {
          setCurrentPrediction(data.ml_prediction);
        }
        
        // Actualizar datos adicionales REALES
        if (data.current_price) setRealTimePrice(data.current_price);
        if (data.price_change_24h) setPriceChange24h(data.price_change_24h);
        if (data.volume_24h) setVolume24h(data.volume_24h);
        
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('❌ Error fetching REAL market analysis:', error);
    }
  }, [BACKEND_URL]);

  // Obtener simulaciones REALES
  const fetchSimulations = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulations?limit=50`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const sortedSimulations = data.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        setSimulations(sortedSimulations);
      }
    } catch (error) {
      console.error('❌ Error fetching REAL simulations:', error);
    }
  }, [BACKEND_URL]);

  // Obtener estadísticas avanzadas REALES
  const fetchAdvancedStats = useCallback(async () => {
    try {
      const [statsResponse, mlStatsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/stats`),
        fetch(`${BACKEND_URL}/api/enhanced-ml-stats`)
      ]);
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
      
      if (mlStatsResponse.ok) {
        const mlData = await mlStatsResponse.json();
        setMlStats(mlData);
      }
    } catch (error) {
      console.error('❌ Error fetching REAL advanced stats:', error);
    }
  }, [BACKEND_URL]);

  // Inicializar gráfico
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chartWidth = isMobile ? window.innerWidth - 40 : containerRef.current.clientWidth;
    const chartHeight = isMobile ? 300 : 600;

    const chart = createChart(containerRef.current, {
      width: chartWidth,
      height: chartHeight,
      layout: {
        background: { color: '#0f172a' },
        textColor: '#e2e8f0',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        const { width } = entries[0].contentRect;
        chartRef.current.applyOptions({
          width: Math.max(width, 300),
          height: isMobile ? 300 : 600
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [isMobile]);

  // Actualizar datos del gráfico
  useEffect(() => {
    if (seriesRef.current && marketData.length > 0) {
      seriesRef.current.setData(marketData);
    }
  }, [marketData]);

  // Cargar datos iniciales REALES
  useEffect(() => {
    const loadInitialData = async () => {
      await fetchInitialMarketData();
      await fetchRealtimePrice();
      await fetchSimulations();
      await fetchAdvancedStats();
      await fetchMarketAnalysis();
    };

    loadInitialData();
  }, [fetchInitialMarketData, fetchRealtimePrice, fetchSimulations, fetchAdvancedStats, fetchMarketAnalysis]);

  // Actualización automática para datos REALES que no vienen por WebSocket
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetchRealtimePrice();
      await fetchSimulations();
      await fetchAdvancedStats();
      await fetchMarketAnalysis();
    }, 10000); // Cada 10 segundos para datos complementarios

    return () => clearInterval(interval);
  }, [fetchRealtimePrice, fetchSimulations, fetchAdvancedStats, fetchMarketAnalysis]);

  // Componente para mostrar una simulación REAL
  const EnhancedSimulationCard = ({ simulation }) => {
    const isOpen = !simulation.closed;
    const profit = simulation.result_pct || 0;
    const isProfit = profit > 0;
    const confidence = (simulation.confidence * 100).toFixed(0);
    const isRealData = simulation.entry_method?.includes('REAL') || simulation.real_market_data;
    
    return (
      <div className={`bg-slate-800/40 backdrop-blur-sm border rounded-2xl p-4 transition-all duration-300 ${
        isOpen ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 
        isProfit ? 'border-emerald-500/50' : 'border-red-500/50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {isRealData && <Shield className="w-4 h-4 text-green-400" />}
            {isOpen ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span className="text-blue-400 font-semibold text-sm">🔄 ACTIVA</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                {isProfit ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className={`font-semibold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '✅ GANADA' : '❌ PERDIDA'}
                </span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {formatTime(simulation.timestamp)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Predicción:</span>
            <div className="flex items-center space-x-1">
              {getTrendIcon(simulation.trend)}
              <span className={`font-bold ${getTrendColor(simulation.trend)}`}>
                {simulation.trend === 'UP' ? '📈 ALCISTA' : '📉 BAJISTA'}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Confianza:</span>
            <span className="text-purple-400 font-bold">{confidence}%</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">Precio Entrada:</span>
            <span className="text-white font-mono">${simulation.entry_price?.toFixed(2)}</span>
          </div>

          {!isOpen && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Precio Salida:</span>
                <span className="text-white font-mono">${simulation.exit_price?.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Resultado:</span>
                <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {profit > 0 ? '+' : ''}{profit.toFixed(2)}%
                </span>
              </div>
            </>
          )}

          <div className="text-xs text-slate-500 mt-2 p-2 bg-slate-700/30 rounded flex items-center justify-between">
            <span>
              Método: {simulation.entry_method?.replace(/_/g, ' ') || 'DESCONOCIDO'}
            </span>
            {isRealData && (
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-green-400" />
                <span className="text-green-400 text-xs font-bold">REAL</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Enhanced Header with REAL Data Status */}
      <div className="bg-slate-800/40 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                🚀 TradingAI Pro - MIRA Enhanced v2.0 
                <span className="text-emerald-400 ml-2">100% REAL</span>
              </h1>
              <p className="text-slate-400 text-sm md:text-base">
                Sistema de Trading con IA + Datos 100% REALES de Binance • Actualizaciones Fluidas
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-6">
              <div className="flex items-center space-x-2">
                {wsConnected ? (
                  <Shield className="w-5 h-5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <div className="text-xs">
                  <div className={`font-semibold ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                    {wsConnected ? '🔒 DATOS REALES' : '❌ DESCONECTADO'}
                  </div>
                  <div className="text-slate-400">{dataSource}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="text-xl md:text-2xl font-bold text-white">
                    ${currentPrice.toFixed(2)}
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    {priceChange !== 0 && (
                      <span className={`font-semibold ${priceChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}
                      </span>
                    )}
                    {priceChange24h !== 0 && (
                      <span className={`font-semibold ${priceChange24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        24h: {priceChange24h > 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-slate-400">
                <div>🕒 {formatTime(lastUpdate)}</div>
                <div className="flex items-center space-x-1 mt-1">
                  <Radio className="w-3 h-3" />
                  <span>Vol: {formatLargeNumber(volume24h)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Enhanced Navigation Tabs */}
        <div className={`flex ${isMobile ? 'flex-wrap' : 'space-x-1'} bg-slate-800/30 p-1 rounded-xl mb-6 ${isMobile ? 'gap-1' : ''}`}>
          {[
            { id: 'live', label: isMobile ? '📊 Live' : '📊 Análisis REAL Tiempo Real', icon: Activity },
            { id: 'history', label: isMobile ? '📈 Historial' : '📈 Historial REAL', icon: History },
            { id: 'ml-analysis', label: isMobile ? '🤖 ML' : '🤖 Análisis ML REAL', icon: Brain },
            { id: 'technical', label: isMobile ? '📊 Técnico' : '📊 Análisis Técnico REAL', icon: Target },
            { id: 'stats', label: isMobile ? '📊 Stats' : '📊 Estadísticas REALES', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-2 md:px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isMobile ? 'flex-1 text-xs' : ''} ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className={isMobile ? 'text-xs' : ''}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Analysis Tab with REAL Data Features */}
        {activeTab === 'live' && (
          <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-6`}>
            <div className={isMobile ? '' : 'lg:col-span-2'}>
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 space-y-2 md:space-y-0">
                  <h2 className="text-lg md:text-xl font-semibold text-white flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    <span>📊 Gráfico REAL BTC/USDT</span>
                    {wsConnected && <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">100% REAL</span>}
                  </h2>
                  <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                    <div className="text-sm text-slate-400">
                      💰 ${currentPrice.toFixed(2)}
                      {priceChange !== 0 && (
                        <span className={`ml-2 ${priceChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ({priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-emerald-400">
                      {wsConnected ? (
                        <Shield className="w-3 h-3" />
                      ) : (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      )}
                      <span>{wsConnected ? 'Datos REALES' : 'Conectando...'}</span>
                    </div>
                  </div>
                </div>
                
                <div 
                  ref={containerRef}
                  className="w-full rounded-xl overflow-hidden border border-slate-700/30"
                  style={{ height: isMobile ? '300px' : '600px' }}
                />
                
                <div className="mt-4 grid grid-cols-3 gap-2 md:gap-4 text-center">
                  <div className="bg-emerald-900/20 rounded-lg p-2 md:p-3">
                    <div className="text-xs text-emerald-400">24h Alto</div>
                    <div className="text-sm font-bold text-emerald-300">
                      ${marketData.length > 0 ? Math.max(...marketData.slice(-24).map(d => d.high)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="bg-blue-900/20 rounded-lg p-2 md:p-3">
                    <div className="text-xs text-blue-400">Precio REAL</div>
                    <div className="text-sm font-bold text-blue-300">${currentPrice.toFixed(2)}</div>
                  </div>
                  <div className="bg-red-900/20 rounded-lg p-2 md:p-3">
                    <div className="text-xs text-red-400">24h Bajo</div>
                    <div className="text-sm font-bold text-red-300">
                      ${marketData.length > 0 ? Math.min(...marketData.slice(-24).map(d => d.low)).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Side Panel with REAL Data Status */}
            <div className="space-y-6">
              {/* REAL Data System Status */}
              <div className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-emerald-700/30 rounded-2xl p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <span>🔒 Sistema REAL Enhanced</span>
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Conexión WebSocket:</span>
                    <span className={`font-bold text-sm ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                      {wsConnected ? '🔒 REAL CONECTADO' : '❌ DESCONECTADO'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Fuente de Datos:</span>
                    <span className="text-emerald-400 font-bold text-sm">100% BINANCE</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Estado IA:</span>
                    <span className="text-purple-400 font-bold text-sm">🧠 ACTIVO</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Precio Actual REAL:</span>
                    <span className="text-emerald-400 font-bold text-sm">${currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Cambio 24h:</span>
                    <span className={`font-bold text-sm ${priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Volumen 24h:</span>
                    <span className="text-blue-400 font-bold text-sm">{formatLargeNumber(volume24h)} BTC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Última actualización:</span>
                    <span className="text-slate-400 text-xs">{formatTime(lastUpdate)}</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Current Prediction with REAL Data */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>🎯 Predicción ML con Datos REALES</span>
                </h3>
                
                {currentPrediction ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(currentPrediction.prediction)}
                        <span className={`font-bold ${isMobile ? 'text-base' : 'text-lg'} ${getTrendColor(currentPrediction.prediction)}`}>
                          {currentPrediction.prediction === 'UP' ? '📈 ALCISTA' : '📉 BAJISTA'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Confianza ML</div>
                        <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-purple-400`}>
                          🤖 {(currentPrediction.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
                        <div className="text-xs text-emerald-400 mb-1">📈 Prob. UP</div>
                        <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-emerald-300`}>
                          {(currentPrediction.probability.up * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                        <div className="text-xs text-red-400 mb-1">📉 Prob. DOWN</div>
                        <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-red-300`}>
                          {(currentPrediction.probability.down * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-2">🔍 Razonamiento ML:</div>
                      <div className="space-y-1">
                        {currentPrediction.reasoning?.slice(0, isMobile ? 2 : 3).map((reason, i) => (
                          <div key={i} className="text-xs text-slate-300 bg-slate-700/30 rounded px-2 py-1">
                            • {reason}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-2">
                      <div className="text-xs text-emerald-400 flex items-center space-x-1">
                        <Shield className="w-3 h-3" />
                        <span>Basado en datos 100% REALES de Binance</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Brain className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                    <p>🤖 IA analizando datos REALES de Binance...</p>
                  </div>
                )}
              </div>

              {/* Enhanced Quick Stats with REAL Data */}
              <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <span>🏆 Rendimiento REAL</span>
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

                <div className="mt-4 text-center">
                  <div className="text-xs text-emerald-400 flex items-center justify-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>Basado en {realSimulations.length} simulaciones con datos REALES</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab with REAL Data Filter */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
              <h2 className="text-xl md:text-2xl font-bold text-white flex items-center space-x-2">
                <History className="w-6 h-6 text-emerald-400" />
                <span>📈 Historial con Datos REALES</span>
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="text-slate-400">
                  Total: {simulations.length} simulaciones
                </div>
                <div className="text-blue-400">
                  🔄 Activas: {openSimulations.length}
                </div>
                <div className="text-emerald-400">
                  ✅ Cerradas: {simulations.filter(s => s.closed).length}
                </div>
                <div className="text-emerald-400 flex items-center space-x-1">
                  <Shield className="w-4 h-4" />
                  <span>REALES: {realSimulations.length}</span>
                </div>
              </div>
            </div>

            {simulations.length > 0 ? (
              <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4 md:gap-6`}>
                {simulations.map((simulation) => (
                  <EnhancedSimulationCard key={simulation.id} simulation={simulation} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold mb-2">🤖 Sistema MIRA generando simulaciones con datos REALES...</h3>
                <p>Las simulaciones aparecerán aquí usando datos 100% reales de Binance.</p>
                <div className="mt-4 text-sm text-emerald-400 flex items-center justify-center space-x-1">
                  <Shield className="w-4 h-4" />
                  <span>Sistema funcionando con conexión WebSocket REAL</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ML Analysis Tab with REAL Data */}
        {activeTab === 'ml-analysis' && (
          <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Brain className="w-6 h-6 text-purple-400" />
                <span>🤖 Sistema ML con Datos REALES</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Conexión REAL:</span>
                  <span className={`font-bold ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                    {wsConnected ? '🔒 ACTIVA' : '❌ INACTIVA'}
                  </span>
                </div>
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
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Simulaciones REALES:</span>
                  <span className="text-emerald-400 font-bold">{realSimulations.length}</span>
                </div>
              </div>

              {/* Progress to 90% with REAL Data */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>🎯 Progreso a 90% con Datos REALES</span>
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Precisión Actual</span>
                    <span className="text-blue-400 font-bold">{stats.ml_accuracy?.toFixed(1) || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-emerald-400 to-blue-400 h-3 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min((stats.ml_accuracy || 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>0%</span>
                    <span className="text-yellow-400 font-bold">Meta: 90%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Eye className="w-6 h-6 text-blue-400" />
                <span>🔍 Feature Importance REAL</span>
              </h3>
              
              {mlStats.feature_importance && mlStats.feature_importance.primary ? (
                <div className="space-y-3">
                  {[
                    'RSI', 'MACD', 'MACD Signal', 'MACD Histogram', 'BB Position',
                    'EMA Crossover', 'Stoch K', 'Stoch D', 'Volume Strength', 'Volume Trend',
                    'Hammer Pattern', 'Doji Pattern', 'Engulfing Pattern', 'Resistance Distance',
                    'Support Distance', 'Signal Strength', 'Bullish Signals', 'Bearish Signals',
                    'Hour', 'Weekday'
                  ].slice(0, isMobile ? 10 : 20).map((feature, index) => {
                    const importance = mlStats.feature_importance.primary[index] || 0;
                    return (
                      <div key={feature} className="flex items-center space-x-2">
                        <span className={`text-slate-300 ${isMobile ? 'text-xs' : 'text-sm'} w-24 md:w-32 truncate`}>{feature}:</span>
                        <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                          <div 
                            className="bg-emerald-400 h-2 rounded-full" 
                            style={{ width: `${importance * 100}%` }}
                          />
                        </div>
                        <span className="text-emerald-400 text-xs font-mono w-12">
                          {(importance * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Lightbulb className="w-12 h-12 mx-auto mb-2" />
                  <p>🤖 Entrenando modelos con datos REALES para obtener importancia de características...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Technical Analysis Tab with REAL Data */}
        {activeTab === 'technical' && (
          <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <Target className="w-6 h-6 text-emerald-400" />
              <span>📊 Análisis Técnico con Datos REALES</span>
              {wsConnected && <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">100% REAL</span>}
            </h3>
            
            {technicalAnalysis ? (
              <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4 md:gap-6`}>
                {/* RSI */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <span>RSI</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </h4>
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
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <span>MACD</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </h4>
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

                {/* Volume Analysis REAL */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <span>Volume REAL</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">24h Volume:</span>
                      <span className="text-emerald-400 font-bold">
                        {formatLargeNumber(volume24h)}
                      </span>
                    </div>
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
                  </div>
                </div>

                {/* Señales REALES */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <span>Señales REALES</span>
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </h4>
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
                <Target className="w-16 h-16 mx-auto mb-4 animate-pulse text-emerald-400" />
                <h4 className="text-lg font-semibold mb-2">📊 Analizando datos técnicos REALES de Binance...</h4>
                <p>El sistema está procesando indicadores técnicos con datos 100% reales de WebSocket.</p>
              </div>
            )}
          </div>
        )}

        {/* Stats Tab with REAL Data Focus */}
        {activeTab === 'stats' && (
          <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span>📊 Métricas Trading REALES</span>
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Conexión Datos REALES:</span>
                  <span className={`font-bold ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                    {wsConnected ? '🔒 ACTIVA' : '❌ INACTIVA'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Total Operaciones:</span>
                  <span className="text-white font-bold">{stats.total_simulations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Operaciones REALES:</span>
                  <span className="text-emerald-400 font-bold">{realSimulations.length}</span>
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
                  <span className="text-blue-400">🎯 Tasa de Éxito REAL:</span>
                  <span className="text-blue-400 font-bold">{stats.win_rate?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-purple-400">🤖 Precisión ML REAL:</span>
                  <span className="text-purple-400 font-bold">{stats.ml_accuracy?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400">📚 Muestras Entrenamiento:</span>
                  <span className="text-yellow-400 font-bold">{stats.learning_samples || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>💰 Rendimiento Financiero REAL</span>
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Precio Actual REAL:</span>
                  <span className="text-emerald-400 font-bold">${currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Cambio 24h REAL:</span>
                  <span className={`font-bold ${priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                  </span>
                </div>
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
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Vol. 24h REAL:</span>
                  <span className="text-blue-400 font-bold">{formatLargeNumber(volume24h)} BTC</span>
                </div>
              </div>
            </div>

            {/* Progress Bar with REAL Data Focus */}
            <div className={`${isMobile ? '' : 'md:col-span-2'} bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 md:p-6`}>
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span>🚀 Progreso hacia 90% con Datos REALES</span>
              </h3>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300">Tasa de Éxito Actual</span>
                  <span className="text-emerald-400 font-bold">{stats.win_rate?.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-4">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-blue-400 h-4 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min((stats.win_rate || 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2 text-sm text-slate-400">
                  <span>0%</span>
                  <span className="text-yellow-400 font-bold">Meta: 90%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className={`grid grid-cols-2 ${isMobile ? '' : 'md:grid-cols-4'} gap-4`}>
                <div className="text-center p-4 bg-blue-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">{simulations.filter(s => !s.closed).length}</div>
                  <div className="text-sm text-slate-400">🔄 En Curso</div>
                </div>
                <div className="text-center p-4 bg-emerald-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-400">{realSimulations.length}</div>
                  <div className="text-sm text-slate-400">🔒 REALES</div>
                </div>
                <div className="text-center p-4 bg-purple-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-purple-400">{stats.win_rate?.toFixed(0)}%</div>
                  <div className="text-sm text-slate-400">🎯 Precisión</div>
                </div>
                <div className="text-center p-4 bg-yellow-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-400">24/7</div>
                  <div className="text-sm text-slate-400">⏰ WebSocket REAL</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile indicator */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white p-2 rounded-full shadow-lg">
          <Smartphone className="w-4 h-4" />
        </div>
      )}

      {/* REAL Data Connection Status Indicator */}
      <div className={`fixed top-4 right-4 flex items-center space-x-2 px-3 py-2 rounded-full ${
        wsConnected ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-red-500/20 border border-red-500/50'
      }`}>
        {wsConnected ? (
          <Shield className="w-4 h-4 text-emerald-400" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-400" />
        )}
        <span className={`text-xs font-semibold ${wsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
          {wsConnected ? 'REAL' : 'OFF'}
        </span>
      </div>
    </div>
  );
};

export default RealTimeApp;