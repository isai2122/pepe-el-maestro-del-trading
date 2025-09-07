"""
Simulador de Datos de Mercado Realistas
Genera datos similares a Binance cuando no hay conexión real disponible
"""
import random
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import math
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealisticMarketSimulator:
    """Simulador que genera datos de mercado realistas para BTC/USDT"""
    
    def __init__(self):
        # Precio base de BTC (actualizar según el mercado real)
        self.base_price = 65000.0
        self.current_price = self.base_price
        self.last_update = datetime.utcnow()
        
        # Parámetros de simulación
        self.volatility = 0.02  # 2% volatility base
        self.trend_factor = 0.0  # -1 a 1, tendencia actual
        self.volume_base = 50000
        
        # Datos históricos simulados
        self.historical_data = []
        self.current_candle = None
        
        # Callbacks para tiempo real
        self.realtime_callbacks = []
        
        # Estado del simulador
        self.is_running = False
        self.simulation_task = None
        
        # Generar datos históricos iniciales
        self.generate_historical_data(100)
    
    def add_realtime_callback(self, callback):
        """Agregar callback para datos en tiempo real"""
        self.realtime_callbacks.append(callback)
    
    def generate_historical_data(self, count: int = 100):
        """Generar datos históricos realistas"""
        logger.info(f"🎲 Generando {count} velas históricas simuladas...")
        
        end_time = datetime.utcnow()
        current_price = self.base_price
        
        for i in range(count, 0, -1):
            # Timestamp de 5 minutos hacia atrás
            timestamp = end_time - timedelta(minutes=i * 5)
            
            # Simular movimiento de precio realista
            # Usar movimiento browniano con tendencia
            price_change = random.gauss(0, self.volatility * current_price)
            trend_influence = self.trend_factor * current_price * 0.001
            
            # Aplicar cambio de precio
            new_price = current_price + price_change + trend_influence
            new_price = max(new_price, self.base_price * 0.5)  # No menor al 50% del precio base
            new_price = min(new_price, self.base_price * 2.0)  # No mayor al 200% del precio base
            
            # Generar OHLC realista
            open_price = current_price
            close_price = new_price
            
            # High y Low basados en volatilidad intraperiodo
            intra_volatility = random.uniform(0.002, 0.01)  # 0.2% a 1%
            high_price = max(open_price, close_price) * (1 + intra_volatility)
            low_price = min(open_price, close_price) * (1 - intra_volatility)
            
            # Volumen aleatorio pero realista
            volume = self.volume_base * random.uniform(0.5, 2.0)
            
            candle = {
                'time': int(timestamp.timestamp()),
                'open': round(open_price, 2),
                'high': round(high_price, 2),
                'low': round(low_price, 2),
                'close': round(close_price, 2),
                'volume': round(volume, 2),
                'timestamp': timestamp.isoformat()
            }
            
            self.historical_data.append(candle)
            current_price = close_price
        
        # Ordenar por tiempo
        self.historical_data.sort(key=lambda x: x['time'])
        
        # Establecer precio actual
        if self.historical_data:
            self.current_price = self.historical_data[-1]['close']
        
        logger.info(f"✅ Datos históricos generados: {len(self.historical_data)} velas")
        logger.info(f"💰 Precio inicial: ${self.historical_data[0]['close']:.2f}")
        logger.info(f"💰 Precio actual: ${self.current_price:.2f}")
    
    def generate_next_candle(self) -> Dict:
        """Generar siguiente vela en tiempo real"""
        now = datetime.utcnow()
        
        # Simular movimiento de precio realista
        price_change_pct = random.gauss(0, self.volatility / 10)  # Movimiento más pequeño para tiempo real
        price_change = self.current_price * price_change_pct
        
        # Aplicar tendencia suave
        trend_influence = self.trend_factor * self.current_price * 0.0001
        
        new_price = self.current_price + price_change + trend_influence
        new_price = max(new_price, self.base_price * 0.5)
        new_price = min(new_price, self.base_price * 2.0)
        
        # Simular datos de vela en progreso
        if not self.current_candle or (now - self.last_update).seconds >= 60:
            # Iniciar nueva vela cada minuto
            self.current_candle = {
                'time': int(now.timestamp() * 1000),  # En milisegundos para WebSocket
                'close_time': int((now + timedelta(minutes=1)).timestamp() * 1000),
                'open': self.current_price,
                'high': max(self.current_price, new_price),
                'low': min(self.current_price, new_price),
                'close': new_price,
                'volume': random.uniform(100, 1000),
                'is_closed': False,
                'symbol': 'BTCUSDT',
                'interval': '1m',
                'timestamp': now.isoformat(),
                'source': 'simulator'
            }
            self.last_update = now
        else:
            # Actualizar vela en progreso
            self.current_candle['high'] = max(self.current_candle['high'], new_price)
            self.current_candle['low'] = min(self.current_candle['low'], new_price)
            self.current_candle['close'] = new_price
            self.current_candle['volume'] += random.uniform(10, 100)
            self.current_candle['timestamp'] = now.isoformat()
        
        self.current_price = new_price
        
        # Actualizar tendencia ocasionalmente
        if random.random() < 0.01:  # 1% de probabilidad de cambiar tendencia
            self.trend_factor = random.uniform(-0.5, 0.5)
        
        return self.current_candle.copy()
    
    async def start_realtime_simulation(self):
        """Iniciar simulación en tiempo real"""
        if self.is_running:
            return
        
        logger.info("📡 Iniciando simulación de mercado en tiempo real...")
        self.is_running = True
        
        while self.is_running:
            try:
                # Generar nueva vela
                candle = self.generate_next_candle()
                
                # Enviar a callbacks
                for callback in self.realtime_callbacks:
                    try:
                        await callback(candle)
                    except Exception as e:
                        logger.error(f"Error en callback: {e}")
                
                # Esperar 1-3 segundos para simular tiempo real
                await asyncio.sleep(random.uniform(1, 3))
                
            except Exception as e:
                logger.error(f"Error en simulación tiempo real: {e}")
                await asyncio.sleep(5)
        
        logger.info("🛑 Simulación de mercado detenida")
    
    def stop_realtime_simulation(self):
        """Detener simulación en tiempo real"""
        self.is_running = False
    
    def get_historical_klines(self, limit: int = 100) -> List[Dict]:
        """Obtener datos históricos en formato de Binance"""
        data = self.historical_data[-limit:] if limit else self.historical_data
        
        # Convertir al formato esperado por el frontend
        formatted_data = []
        for candle in data:
            formatted_data.append({
                'time': candle['time'] * 1000,  # Convertir a milisegundos
                'open': candle['open'],
                'high': candle['high'],
                'low': candle['low'],
                'close': candle['close'],
                'volume': candle['volume'],
                'timestamp': str(candle['time'] * 1000)
            })
        
        return formatted_data
    
    def get_current_price(self) -> float:
        """Obtener precio actual"""
        return self.current_price
    
    def get_latest_candle(self) -> Optional[Dict]:
        """Obtener última vela"""
        return self.current_candle
    
    def get_price_change_24h(self) -> Dict:
        """Simular cambio de precio en 24h"""
        if len(self.historical_data) >= 288:  # 288 velas de 5min = 24h
            price_24h_ago = self.historical_data[-288]['close']
        else:
            price_24h_ago = self.historical_data[0]['close'] if self.historical_data else self.current_price
        
        change = self.current_price - price_24h_ago
        change_pct = (change / price_24h_ago) * 100 if price_24h_ago > 0 else 0
        
        return {
            'price': self.current_price,
            'change': change,
            'change_percent': change_pct,
            'high_24h': max([c['high'] for c in self.historical_data[-288:]] if len(self.historical_data) >= 288 else [c['high'] for c in self.historical_data]),
            'low_24h': min([c['low'] for c in self.historical_data[-288:]] if len(self.historical_data) >= 288 else [c['low'] for c in self.historical_data])
        }

# Singleton del simulador
market_simulator = RealisticMarketSimulator()