"""
Cliente WebSocket REAL para Binance - Datos 100% Reales BTC/USDT
Conexión fluida en tiempo real sin simulaciones falsas
"""
import asyncio
import websockets
import json
import logging
import aiohttp
from datetime import datetime
from typing import Dict, List, Optional, Callable
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RealBinanceClient:
    """Cliente WebSocket para datos 100% reales de Binance"""
    
    def __init__(self):
        # URLs REALES de Binance
        self.ws_url = "wss://stream.binance.com:9443/ws/btcusdt@kline_1s"  # 1 segundo para máxima fluidez
        self.ticker_ws_url = "wss://stream.binance.com:9443/ws/btcusdt@ticker"
        self.http_base = "https://api.binance.com/api/v3"
        
        # Estado de conexión
        self.ws_connection = None
        self.ticker_connection = None
        self.is_connected = False
        self.callbacks = []
        
        # Datos en tiempo real
        self.current_price = 0
        self.current_kline = None
        self.price_history = deque(maxlen=1000)
        self.volume_24h = 0
        self.price_change_24h = 0
        self.price_change_percent = 0
        
        # Reconexión
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5
        
    def add_callback(self, callback: Callable):
        """Agregar callback para datos en tiempo real"""
        self.callbacks.append(callback)
    
    async def connect(self):
        """Conectar a streams reales de Binance o usar polling HTTP"""
        try:
            logger.info("🔌 Conectando a Binance REAL WebSocket...")
            
            # Intentar WebSocket primero
            try:
                # Conectar a stream de klines (velas) cada segundo
                self.ws_connection = await websockets.connect(
                    self.ws_url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=10
                )
                
                # Conectar a stream de ticker para precio instantáneo
                self.ticker_connection = await websockets.connect(
                    self.ticker_ws_url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=10
                )
                
                self.is_connected = True
                self.reconnect_attempts = 0
                logger.info("✅ Conectado a Binance REAL WebSocket - Datos cada SEGUNDO")
                
                # Iniciar tareas de escucha
                await asyncio.gather(
                    self.listen_klines(),
                    self.listen_ticker()
                )
                
            except Exception as ws_error:
                if "451" in str(ws_error) or "403" in str(ws_error):
                    logger.warning("⚠️ WebSocket bloqueado, usando polling HTTP REAL...")
                    await self.start_http_polling()
                else:
                    raise ws_error
            
        except Exception as e:
            logger.error(f"❌ Error conectando a Binance REAL: {e}")
            self.is_connected = False
            await self.handle_reconnection()
    
    async def start_http_polling(self):
        """Iniciar polling HTTP para datos REALES cuando WebSocket no está disponible"""
        logger.info("🔄 Iniciando polling HTTP REAL cada 5 segundos...")
        self.is_connected = True
        self.reconnect_attempts = 0
        
        while self.is_connected:
            try:
                # Obtener precio y datos actuales
                await self.fetch_real_price_data()
                await asyncio.sleep(5)  # Cada 5 segundos para no sobrecargar la API
            except Exception as e:
                logger.error(f"❌ Error en polling HTTP: {e}")
                await asyncio.sleep(10)
    
    async def fetch_real_price_data(self):
        """Obtener datos de precio REALES via HTTP"""
        try:
            async with aiohttp.ClientSession() as session:
                # Obtener ticker 24h
                async with session.get(f"{self.http_base}/ticker/24hr?symbol=BTCUSDT", timeout=10) as response:
                    if response.status == 200:
                        ticker_data = await response.json()
                        
                        self.current_price = float(ticker_data['lastPrice'])
                        self.volume_24h = float(ticker_data['volume'])
                        self.price_change_24h = float(ticker_data['priceChangePercent'])
                        
                        # Crear datos simulados de kline para callbacks
                        kline_data = {
                            'symbol': 'BTCUSDT',
                            'time': int(ticker_data['closeTime']),
                            'close_time': int(ticker_data['closeTime']),
                            'open': float(ticker_data['openPrice']),
                            'high': float(ticker_data['highPrice']),
                            'low': float(ticker_data['lowPrice']),
                            'close': self.current_price,
                            'volume': self.volume_24h,
                            'is_closed': True,
                            'trades': int(ticker_data['count']),
                            'interval': '24h',
                            'timestamp': datetime.utcnow().isoformat(),
                            'source': 'binance_http_real'
                        }
                        
                        self.current_kline = kline_data
                        self.price_history.append({
                            'time': int(ticker_data['closeTime']),
                            'price': self.current_price
                        })
                        
                        # Ejecutar callbacks con datos REALES
                        for callback in self.callbacks:
                            try:
                                await callback(kline_data)
                            except Exception as e:
                                logger.error(f"❌ Error en callback HTTP: {e}")
                        
                        logger.info(f"📊 REAL HTTP BTC: ${self.current_price:.2f} ({self.price_change_24h:+.2f}%)")
                        
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos REALES HTTP: {e}")
    
    async def listen_klines(self):
        """Escuchar velas japonesas cada segundo - DATOS REALES"""
        try:
            async for message in self.ws_connection:
                data = json.loads(message)
                
                if 'k' in data:
                    kline = data['k']
                    
                    # Procesar datos reales de vela
                    self.current_kline = {
                        'symbol': kline['s'],
                        'time': int(kline['t']),
                        'close_time': int(kline['T']),
                        'open': float(kline['o']),
                        'high': float(kline['h']),
                        'low': float(kline['l']),
                        'close': float(kline['c']),
                        'volume': float(kline['v']),
                        'is_closed': kline['x'],
                        'trades': int(kline['n']),
                        'interval': kline['i'],
                        'timestamp': datetime.utcnow().isoformat(),
                        'source': 'binance_real'
                    }
                    
                    # Actualizar precio actual
                    self.current_price = float(kline['c'])
                    self.price_history.append({
                        'time': int(kline['t']),
                        'price': self.current_price
                    })
                    
                    # Ejecutar callbacks con datos reales
                    for callback in self.callbacks:
                        try:
                            await callback(self.current_kline)
                        except Exception as e:
                            logger.error(f"❌ Error en callback kline: {e}")
                    
                    # Log cada 30 actualizaciones para no saturar
                    if len(self.price_history) % 30 == 0:
                        logger.info(f"📊 REAL BTC: ${self.current_price:.2f} (Vela: {'cerrada' if kline['x'] else 'abierta'})")
                        
        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Conexión klines cerrada")
            self.is_connected = False
            await self.handle_reconnection()
        except Exception as e:
            logger.error(f"❌ Error en stream klines: {e}")
            self.is_connected = False
            await self.handle_reconnection()
    
    async def listen_ticker(self):
        """Escuchar ticker para datos instantáneos de precio"""
        try:
            async for message in self.ticker_connection:
                data = json.loads(message)
                
                # Actualizar datos del ticker en tiempo real
                self.current_price = float(data['c'])  # Precio actual
                self.volume_24h = float(data['v'])     # Volumen 24h
                self.price_change_24h = float(data['P'])  # Cambio porcentual 24h
                self.price_change_percent = float(data['P'])
                
                # Log ocasional del ticker
                if len(self.price_history) % 100 == 0:
                    logger.info(f"💰 TICKER REAL: ${self.current_price:.2f} ({self.price_change_24h:+.2f}%)")
                    
        except Exception as e:
            logger.error(f"❌ Error en ticker stream: {e}")
    
    async def handle_reconnection(self):
        """Manejar reconexión automática"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("❌ Máximas reconexiones alcanzadas - BINANCE NO DISPONIBLE")
            return
        
        self.reconnect_attempts += 1
        wait_time = min(2 ** self.reconnect_attempts, 30)
        
        logger.info(f"🔄 Reconectando a Binance REAL en {wait_time}s (intento {self.reconnect_attempts})")
        await asyncio.sleep(wait_time)
        await self.connect()
    
    async def get_historical_klines_real(self, interval="1m", limit=500):
        """Obtener datos históricos REALES de Binance"""
        try:
            url = f"{self.http_base}/klines"
            params = {
                "symbol": "BTCUSDT",
                "interval": interval,
                "limit": limit
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        formatted_data = []
                        for kline in data:
                            formatted_data.append({
                                'time': int(kline[0]) // 1000,  # Timestamp en segundos
                                'open': float(kline[1]),
                                'high': float(kline[2]),
                                'low': float(kline[3]),
                                'close': float(kline[4]),
                                'volume': float(kline[5]),
                                'close_time': int(kline[6]) // 1000,
                                'trades': int(kline[8])
                            })
                        
                        logger.info(f"✅ Históricos REALES de Binance: {len(formatted_data)} velas")
                        return formatted_data
                    else:
                        logger.error(f"❌ Error HTTP Binance: {response.status}")
                        return []
                        
        except Exception as e:
            logger.error(f"❌ Error obteniendo históricos REALES: {e}")
            return []
    
    def get_current_price(self) -> float:
        """Obtener precio actual REAL"""
        return self.current_price
    
    def get_latest_kline(self) -> Optional[Dict]:
        """Obtener última vela REAL"""
        return self.current_kline
    
    def get_price_change_24h(self) -> float:
        """Obtener cambio de precio 24h REAL"""
        return self.price_change_24h
    
    def get_volume_24h(self) -> float:
        """Obtener volumen 24h REAL"""
        return self.volume_24h
    
    def get_recent_prices(self, count: int = 100) -> List[Dict]:
        """Obtener precios recientes REALES"""
        return list(self.price_history)[-count:] if len(self.price_history) >= count else list(self.price_history)
    
    async def start(self):
        """Iniciar cliente WebSocket REAL"""
        logger.info("🚀 Iniciando cliente Binance REAL...")
        self.connection_task = asyncio.create_task(self.connect())
        return self.connection_task
    
    async def stop(self):
        """Detener cliente WebSocket"""
        logger.info("🛑 Deteniendo cliente Binance REAL...")
        
        self.is_connected = False
        
        if self.ws_connection:
            await self.ws_connection.close()
        
        if self.ticker_connection:
            await self.ticker_connection.close()
        
        if hasattr(self, 'connection_task'):
            self.connection_task.cancel()
            try:
                await self.connection_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ Cliente Binance REAL detenido")

# Instancia global para datos REALES
real_binance_client = RealBinanceClient()