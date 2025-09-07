"""
Sistema de Análisis Técnico Avanzado para TradingAI Pro
Análisis completo de indicadores técnicos para BTC/USDT en tiempo real
"""
import pandas as pd
import numpy as np
import aiohttp
import asyncio
from datetime import datetime, timedelta
import ta
from typing import Dict, List, Optional, Any
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TechnicalAnalyzer:
    """Analizador técnico avanzado con múltiples indicadores"""
    
    def __init__(self):
        self.symbol = "BTCUSDT"
        self.interval = "5m"
        self.limit = 200
        self.cache_duration = 60  # Cache por 60 segundos
        self.last_cache_time = None
        self.cached_data = None
        
    async def get_market_data(self) -> Optional[pd.DataFrame]:
        """Obtener datos de mercado de Binance con cache inteligente"""
        try:
            # Verificar cache
            now = datetime.utcnow()
            if (self.cached_data is not None and 
                self.last_cache_time and 
                (now - self.last_cache_time).seconds < self.cache_duration):
                return self.cached_data
            
            url = "https://api.binance.com/api/v3/klines"
            params = {
                "symbol": self.symbol,
                "interval": self.interval,
                "limit": self.limit
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # Convertir a DataFrame
                        df = pd.DataFrame(data, columns=[
                            'timestamp', 'open', 'high', 'low', 'close',
                            'volume', 'close_time', 'quote_volume', 'trades',
                            'taker_buy_base_volume', 'taker_buy_quote_volume', 'ignore'
                        ])
                        
                        # Convertir tipos de datos
                        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                        numeric_columns = ['open', 'high', 'low', 'close', 'volume']
                        for col in numeric_columns:
                            df[col] = pd.to_numeric(df[col], errors='coerce')
                        
                        # Ordenar por timestamp
                        df = df.sort_values('timestamp').reset_index(drop=True)
                        
                        # Actualizar cache
                        self.cached_data = df
                        self.last_cache_time = now
                        
                        logger.info(f"✅ Datos de mercado obtenidos exitosamente: {len(df)} registros")
                        return df
                    else:
                        logger.error(f"❌ Error Binance API: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos de mercado: {e}")
            return self.cached_data if self.cached_data is not None else None
    
    def calculate_rsi(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calcular RSI (Relative Strength Index)"""
        try:
            rsi = ta.momentum.RSIIndicator(df['close'], window=period)
            return float(rsi.rsi().iloc[-1])
        except:
            return 50.0
    
    def calculate_macd(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calcular MACD (Moving Average Convergence Divergence)"""
        try:
            macd = ta.trend.MACD(df['close'])
            return {
                'macd': float(macd.macd().iloc[-1]),
                'signal': float(macd.macd_signal().iloc[-1]),
                'histogram': float(macd.macd_diff().iloc[-1])
            }
        except:
            return {'macd': 0.0, 'signal': 0.0, 'histogram': 0.0}
    
    def calculate_bollinger_bands(self, df: pd.DataFrame, period: int = 20) -> Dict[str, float]:
        """Calcular Bandas de Bollinger"""
        try:
            bb = ta.volatility.BollingerBands(df['close'], window=period)
            current_price = df['close'].iloc[-1]
            upper = bb.bollinger_hband().iloc[-1]
            lower = bb.bollinger_lband().iloc[-1]
            middle = bb.bollinger_mavg().iloc[-1]
            
            # Calcular posición dentro de las bandas (0-1)
            position = (current_price - lower) / (upper - lower) if upper != lower else 0.5
            
            return {
                'upper': float(upper),
                'middle': float(middle),
                'lower': float(lower),
                'position': float(position)
            }
        except:
            return {'upper': 0.0, 'middle': 0.0, 'lower': 0.0, 'position': 0.5}
    
    def calculate_emas(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calcular EMAs (Exponential Moving Averages)"""
        try:
            ema_20 = ta.trend.EMAIndicator(df['close'], window=20).ema_indicator().iloc[-1]
            ema_50 = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator().iloc[-1]
            
            # Detectar cruce de EMAs
            ema_20_prev = ta.trend.EMAIndicator(df['close'], window=20).ema_indicator().iloc[-2]
            ema_50_prev = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator().iloc[-2]
            
            crossover = (ema_20 > ema_50) and (ema_20_prev <= ema_50_prev)  # Golden cross
            crossunder = (ema_20 < ema_50) and (ema_20_prev >= ema_50_prev)  # Death cross
            
            return {
                'ema_20': float(ema_20),
                'ema_50': float(ema_50),
                'crossover': bool(ema_20 > ema_50),
                'golden_cross': crossover,
                'death_cross': crossunder
            }
        except:
            return {'ema_20': 0.0, 'ema_50': 0.0, 'crossover': False, 'golden_cross': False, 'death_cross': False}
    
    def calculate_stochastic(self, df: pd.DataFrame, period: int = 14) -> Dict[str, float]:
        """Calcular Oscilador Estocástico"""
        try:
            stoch = ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=period)
            return {
                'k': float(stoch.stoch().iloc[-1]),
                'd': float(stoch.stoch_signal().iloc[-1])
            }
        except:
            return {'k': 50.0, 'd': 50.0}
    
    def analyze_volume(self, df: pd.DataFrame) -> Dict[str, float]:
        """Análisis avanzado de volumen"""
        try:
            # Volume Moving Average
            volume_ma = df['volume'].rolling(window=20).mean().iloc[-1]
            current_volume = df['volume'].iloc[-1]
            
            # Volume strength (current vs average)
            volume_strength = (current_volume / volume_ma - 1) * 100 if volume_ma > 0 else 0
            
            # Volume trend (últimos 5 períodos)
            recent_volumes = df['volume'].tail(5)
            volume_trend = (recent_volumes.iloc[-1] / recent_volumes.iloc[0] - 1) * 100 if recent_volumes.iloc[0] > 0 else 0
            
            return {
                'current_volume': float(current_volume),
                'volume_ma': float(volume_ma),
                'volume_strength': float(volume_strength),
                'volume_trend': float(volume_trend)
            }
        except:
            return {'current_volume': 0.0, 'volume_ma': 0.0, 'volume_strength': 0.0, 'volume_trend': 0.0}
    
    def detect_candlestick_patterns(self, df: pd.DataFrame) -> Dict[str, bool]:
        """Detectar patrones de velas japonesas"""
        try:
            # Obtener últimas 3 velas
            recent = df.tail(3)
            if len(recent) < 3:
                return {'hammer': False, 'doji': False, 'engulfing': False}
            
            last = recent.iloc[-1]
            prev = recent.iloc[-2]
            
            # Hammer pattern
            body = abs(last['close'] - last['open'])
            upper_shadow = last['high'] - max(last['open'], last['close'])
            lower_shadow = min(last['open'], last['close']) - last['low']
            hammer = (lower_shadow > 2 * body) and (upper_shadow < 0.5 * body)
            
            # Doji pattern
            doji = body < (last['high'] - last['low']) * 0.1
            
            # Engulfing pattern
            prev_body = abs(prev['close'] - prev['open'])
            engulfing = (body > prev_body * 1.5) and (
                (last['close'] > last['open'] and prev['close'] < prev['open']) or
                (last['close'] < last['open'] and prev['close'] > prev['open'])
            )
            
            return {
                'hammer': bool(hammer),
                'doji': bool(doji),
                'engulfing': bool(engulfing)
            }
        except:
            return {'hammer': False, 'doji': False, 'engulfing': False}
    
    def calculate_support_resistance(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calcular niveles de soporte y resistencia"""
        try:
            # Usar pivots de los últimos 50 períodos
            recent_data = df.tail(50)
            current_price = df['close'].iloc[-1]
            
            # Resistance (máximos locales)
            highs = recent_data['high']
            resistances = []
            for i in range(2, len(highs)-2):
                if (highs.iloc[i] > highs.iloc[i-1] and highs.iloc[i] > highs.iloc[i-2] and
                    highs.iloc[i] > highs.iloc[i+1] and highs.iloc[i] > highs.iloc[i+2]):
                    resistances.append(highs.iloc[i])
            
            # Support (mínimos locales)
            lows = recent_data['low']
            supports = []
            for i in range(2, len(lows)-2):
                if (lows.iloc[i] < lows.iloc[i-1] and lows.iloc[i] < lows.iloc[i-2] and
                    lows.iloc[i] < lows.iloc[i+1] and lows.iloc[i] < lows.iloc[i+2]):
                    supports.append(lows.iloc[i])
            
            # Encontrar el soporte y resistencia más cercanos
            resistance = min([r for r in resistances if r > current_price], default=current_price * 1.05)
            support = max([s for s in supports if s < current_price], default=current_price * 0.95)
            
            return {
                'resistance': float(resistance),
                'support': float(support),
                'resistance_distance': float((resistance / current_price - 1) * 100),
                'support_distance': float((current_price / support - 1) * 100)
            }
        except:
            current_price = df['close'].iloc[-1] if len(df) > 0 else 65000
            return {
                'resistance': float(current_price * 1.02),
                'support': float(current_price * 0.98),
                'resistance_distance': 2.0,
                'support_distance': 2.0
            }
    
    def generate_signals(self, analysis: Dict) -> Dict[str, Any]:
        """Generar señales de trading basadas en análisis técnico"""
        bullish_signals = []
        bearish_signals = []
        signal_strength = 0
        
        # RSI signals
        rsi = analysis.get('rsi', 50)
        if rsi < 30:
            bullish_signals.append("RSI oversold (<30)")
            signal_strength += 15
        elif rsi > 70:
            bearish_signals.append("RSI overbought (>70)")
            signal_strength -= 15
        
        # MACD signals
        macd = analysis.get('macd', {})
        if macd.get('histogram', 0) > 0 and macd.get('macd', 0) > macd.get('signal', 0):
            bullish_signals.append("MACD bullish crossover")
            signal_strength += 20
        elif macd.get('histogram', 0) < 0 and macd.get('macd', 0) < macd.get('signal', 0):
            bearish_signals.append("MACD bearish crossover")
            signal_strength -= 20
        
        # EMA signals
        emas = analysis.get('emas', {})
        if emas.get('golden_cross', False):
            bullish_signals.append("EMA golden cross")
            signal_strength += 25
        elif emas.get('death_cross', False):
            bearish_signals.append("EMA death cross")
            signal_strength -= 25
        elif emas.get('crossover', False):
            bullish_signals.append("EMA 20 above EMA 50")
            signal_strength += 10
        else:
            bearish_signals.append("EMA 20 below EMA 50")
            signal_strength -= 10
        
        # Bollinger Bands signals
        bollinger = analysis.get('bollinger', {})
        bb_position = bollinger.get('position', 0.5)
        if bb_position < 0.2:
            bullish_signals.append("Price near lower Bollinger Band")
            signal_strength += 15
        elif bb_position > 0.8:
            bearish_signals.append("Price near upper Bollinger Band")
            signal_strength -= 15
        
        # Volume signals
        volume = analysis.get('volume', {})
        if volume.get('volume_strength', 0) > 50:
            if signal_strength > 0:
                bullish_signals.append("High volume confirms bullish move")
                signal_strength += 10
            else:
                bearish_signals.append("High volume confirms bearish move")
                signal_strength -= 10
        
        # Candlestick patterns
        patterns = analysis.get('patterns', {})
        if patterns.get('hammer', False):
            bullish_signals.append("Hammer candlestick pattern")
            signal_strength += 12
        if patterns.get('engulfing', False):
            if signal_strength > 0:
                bullish_signals.append("Bullish engulfing pattern")
                signal_strength += 15
            else:
                bearish_signals.append("Bearish engulfing pattern")
                signal_strength -= 15
        
        # Calcular confianza basada en la fuerza de la señal
        confidence = min(abs(signal_strength) / 100, 0.95)
        confidence = max(confidence, 0.5)  # Mínimo 50% de confianza
        
        return {
            'strength': signal_strength,
            'confidence': confidence,
            'bullish_signals': bullish_signals,
            'bearish_signals': bearish_signals,
            'total_signals': len(bullish_signals) + len(bearish_signals),
            'net_bullish': len(bullish_signals) - len(bearish_signals)
        }
    
    def comprehensive_analysis(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Realizar análisis técnico completo"""
        try:
            if df is None or len(df) < 50:
                logger.warning("❌ Datos insuficientes para análisis técnico")
                return None
            
            # Calcular todos los indicadores
            rsi = self.calculate_rsi(df)
            macd = self.calculate_macd(df)
            bollinger = self.calculate_bollinger_bands(df)
            emas = self.calculate_emas(df)
            stochastic = self.calculate_stochastic(df)
            volume = self.analyze_volume(df)
            patterns = self.detect_candlestick_patterns(df)
            support_resistance = self.calculate_support_resistance(df)
            
            # Compilar análisis
            analysis = {
                'timestamp': datetime.utcnow().isoformat(),
                'symbol': self.symbol,
                'current_price': float(df['close'].iloc[-1]),
                'rsi': rsi,
                'macd': macd,
                'bollinger': bollinger,
                'emas': emas,
                'stochastic': stochastic,
                'volume': volume,
                'patterns': patterns,
                'support_resistance': support_resistance
            }
            
            # Generar señales
            signals = self.generate_signals(analysis)
            analysis['signals'] = signals
            
            logger.info(f"✅ Análisis técnico completo: {signals['total_signals']} señales, fuerza: {signals['strength']}")
            
            return analysis
            
        except Exception as e:
            logger.error(f"❌ Error en análisis técnico: {e}")
            return None

# Instancia global del analizador
analyzer = TechnicalAnalyzer()