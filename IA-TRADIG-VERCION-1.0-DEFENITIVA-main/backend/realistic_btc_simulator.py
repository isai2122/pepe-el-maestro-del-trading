"""
Simulador de Datos REALISTAS de Bitcoin
Genera datos que siguen patrones reales de BTC con precios actuales del mercado
"""
import asyncio
import logging
import random
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealisticBTCSimulator:
    """Simulador que genera datos REALISTAS de Bitcoin basados en patrones de mercado reales"""
    
    def __init__(self):
        # Datos base realistas (aproximados al mercado actual)
        self.base_price = 65000.0  # Precio base realista de BTC
        self.current_price = self.base_price
        self.price_volatility = 0.02  # 2% volatilidad típica
        
        # Datos de mercado realistas
        self.volume_24h = 15000000000.0  # ~15B USD volumen típico
        self.market_cap = 1300000000000.0  # ~1.3T market cap
        self.price_change_24h = 0.0
        
        # Patrones de mercado realistas
        self.trend_strength = 0.0
        self.support_level = self.base_price * 0.95
        self.resistance_level = self.base_price * 1.05
        
        # Estado de conexión y callbacks
        self.is_connected = False
        self.callbacks = []
        self.price_history = deque(maxlen=1000)
        self.current_kline = None
        
        # Control de simulación
        self.simulation_task = None
        self.update_interval = 5  # 5 segundos para datos fluidos
        
        # Datos históricos simulados pero realistas
        self.historical_data = []
        self.generate_historical_data()
        
    def generate_historical_data(self):
        """Generar datos históricos realistas para las últimas 24 horas"""
        logger.info("📊 Generando datos históricos realistas de BTC...")
        
        now = datetime.utcnow()
        self.historical_data = []
        
        # Generar 24 horas de datos (cada hora)
        for i in range(24):
            timestamp = now - timedelta(hours=23-i)
            timestamp_ms = int(timestamp.timestamp() * 1000)
            
            # Movimiento realista basado en patrones históricos de BTC
            hourly_change = random.gauss(0, 0.015)  # Distribución normal con 1.5% std
            price = self.base_price * (1 + hourly_change * (i/24))  # Tendencia gradual
            
            # Crear OHLCV realista
            high = price * (1 + random.uniform(0.001, 0.02))
            low = price * (1 - random.uniform(0.001, 0.02))
            open_price = price * (1 + random.uniform(-0.01, 0.01))
            close_price = price
            volume = random.uniform(500000000, 2000000000)  # Volumen por hora realista
            
            self.historical_data.append({
                'time': timestamp_ms // 1000,
                'open': round(open_price, 2),
                'high': round(high, 2),
                'low': round(low, 2),
                'close': round(close_price, 2),
                'volume': round(volume, 2),
                'close_time': timestamp_ms // 1000,
                'trades': random.randint(50000, 200000)
            })
        
        # Actualizar precio actual con el último valor
        self.current_price = self.historical_data[-1]['close']
        logger.info(f"✅ Generados {len(self.historical_data)} puntos históricos. Precio actual: ${self.current_price:.2f}")
    
    def add_callback(self, callback: Callable):
        """Agregar callback para datos en tiempo real"""
        self.callbacks.append(callback)
    
    async def connect(self):
        """Iniciar simulación de datos realistas"""
        try:
            logger.info("🔌 Iniciando simulador REALISTA de Bitcoin...")
            self.is_connected = True
            await self.start_realistic_simulation()
        except Exception as e:
            logger.error(f"❌ Error en simulador REALISTA: {e}")
            self.is_connected = False
    
    async def start_realistic_simulation(self):
        """Iniciar simulación con datos realistas"""
        logger.info("📈 Iniciando simulación REALISTA cada 5 segundos...")
        
        cycle_count = 0
        
        while self.is_connected:
            try:
                cycle_count += 1
                
                # Generar movimiento de precio realista
                await self.generate_realistic_price_movement()
                
                # Crear y procesar kline data
                await self.create_realistic_kline_data()
                
                # Log cada 12 ciclos (1 minuto)
                if cycle_count % 12 == 0:
                    logger.info(f"📊 BTC REALISTA: ${self.current_price:.2f} ({self.price_change_24h:+.2f}%) Vol: ${self.volume_24h/1e9:.1f}B")
                
                await asyncio.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"❌ Error en simulación REALISTA: {e}")
                await asyncio.sleep(self.update_interval * 2)
    
    async def generate_realistic_price_movement(self):
        """Generar movimiento de precio basado en patrones reales de BTC"""
        try:
            # Factores de mercado realistas
            time_factor = math.sin(datetime.utcnow().hour * math.pi / 12) * 0.3  # Patrón horario
            volatility_factor = random.gauss(0, self.price_volatility)  # Volatilidad normal
            
            # Momentum y reversión a la media (patrones reales de BTC)
            mean_reversion = (self.base_price - self.current_price) / self.base_price * 0.1
            momentum = self.trend_strength * 0.05
            
            # Calcular cambio de precio
            price_change = (time_factor + volatility_factor + mean_reversion + momentum) * self.current_price
            new_price = max(self.current_price + price_change, self.current_price * 0.98)  # Límite de caída
            new_price = min(new_price, self.current_price * 1.02)  # Límite de subida
            
            # Actualizar datos de mercado
            old_price = self.current_price
            self.current_price = round(new_price, 2)
            
            # Calcular cambio 24h simulado
            self.price_change_24h = ((self.current_price - self.base_price) / self.base_price) * 100
            
            # Actualizar volumen de forma realista
            volume_change = random.uniform(0.95, 1.05)
            self.volume_24h = max(self.volume_24h * volume_change, 10000000000)  # Mín 10B
            
            # Actualizar market cap
            self.market_cap = self.current_price * 19700000  # ~19.7M BTC en circulación
            
            # Actualizar niveles de soporte y resistencia
            if self.current_price > self.resistance_level:
                self.resistance_level = self.current_price * 1.02
                self.trend_strength = min(self.trend_strength + 0.1, 1.0)
            elif self.current_price < self.support_level:
                self.support_level = self.current_price * 0.98
                self.trend_strength = max(self.trend_strength - 0.1, -1.0)
            
        except Exception as e:
            logger.error(f"❌ Error generando movimiento REALISTA: {e}")
    
    async def create_realistic_kline_data(self):
        """Crear datos de kline realistas"""
        try:
            current_time = int(datetime.utcnow().timestamp() * 1000)
            
            # Crear OHLCV realista basado en precio actual
            open_price = self.current_price
            close_price = self.current_price
            high_price = self.current_price * random.uniform(1.0001, 1.005)  # Máximo realista
            low_price = self.current_price * random.uniform(0.995, 0.9999)   # Mínimo realista
            volume = random.uniform(100000000, 500000000)  # Volumen por período
            
            kline_data = {
                'symbol': 'BTCUSD',
                'time': current_time,
                'close_time': current_time,
                'open': round(open_price, 2),
                'high': round(high_price, 2),
                'low': round(low_price, 2),
                'close': round(close_price, 2),
                'volume': round(volume, 2),
                'is_closed': True,
                'trades': random.randint(5000, 20000),
                'interval': '5s',
                'timestamp': datetime.utcnow().isoformat(),
                'source': 'realistic_simulator',
                'market_cap': round(self.market_cap, 2),
                'price_change_24h_percent': round(self.price_change_24h, 2),
                'support_level': round(self.support_level, 2),
                'resistance_level': round(self.resistance_level, 2),
                'trend_strength': round(self.trend_strength, 3)
            }
            
            self.current_kline = kline_data
            self.price_history.append({
                'time': current_time,
                'price': self.current_price
            })
            
            # Ejecutar callbacks
            for callback in self.callbacks:
                try:
                    await callback(kline_data)
                except Exception as e:
                    logger.error(f"❌ Error en callback REALISTA: {e}")
                    
        except Exception as e:
            logger.error(f"❌ Error creando kline REALISTA: {e}")
    
    async def get_historical_klines_real(self, interval="1m", limit=500):
        """Obtener datos históricos realistas"""
        try:
            # Retornar datos históricos generados
            recent_data = self.historical_data[-limit:] if len(self.historical_data) >= limit else self.historical_data
            logger.info(f"✅ Históricos REALISTAS: {len(recent_data)} puntos")
            return recent_data
        except Exception as e:
            logger.error(f"❌ Error obteniendo históricos REALISTAS: {e}")
            return []
    
    def get_current_price(self) -> float:
        """Obtener precio actual realista"""
        return self.current_price
    
    def get_latest_kline(self) -> Optional[Dict]:
        """Obtener última vela realista"""
        return self.current_kline
    
    def get_price_change_24h(self) -> float:
        """Obtener cambio de precio 24h realista"""
        return self.price_change_24h
    
    def get_volume_24h(self) -> float:
        """Obtener volumen 24h realista"""
        return self.volume_24h
    
    def get_market_cap(self) -> float:
        """Obtener market cap realista"""
        return self.market_cap
    
    def get_recent_prices(self, count: int = 100) -> List[Dict]:
        """Obtener precios recientes realistas"""
        return list(self.price_history)[-count:] if len(self.price_history) >= count else list(self.price_history)
    
    async def start(self):
        """Iniciar simulador realista"""
        logger.info("🚀 Iniciando simulador REALISTA de Bitcoin...")
        self.simulation_task = asyncio.create_task(self.connect())
        return self.simulation_task
    
    async def stop(self):
        """Detener simulador"""
        logger.info("🛑 Deteniendo simulador REALISTA...")
        
        self.is_connected = False
        
        if self.simulation_task:
            self.simulation_task.cancel()
            try:
                await self.simulation_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ Simulador REALISTA detenido")

# Instancia global para datos REALISTAS
realistic_btc_simulator = RealisticBTCSimulator()