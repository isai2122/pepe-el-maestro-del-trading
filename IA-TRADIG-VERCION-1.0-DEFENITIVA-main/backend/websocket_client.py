"""
Sistema WebSocket en Tiempo Real para Binance
Conexión continua para datos BTC/USDT con reconexión automática
"""
import asyncio
import websockets
import json
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime
import aiohttp
from collections import deque

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BinanceWebSocketClient:
    """Cliente WebSocket para conexión en tiempo real con Binance"""
    
    def __init__(self):
        self.ws_url = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"
        self.ws_connection = None
        self.is_connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.current_data = None
        self.data_queue = deque(maxlen=1000)
        self.callbacks = []
        self.connection_task = None
        
        # Fallback HTTP endpoint
        self.http_fallback_url = "https://api.binance.com/api/v3/klines"
        self.last_http_update = None
        self.http_update_interval = 15  # seconds
        
    def add_callback(self, callback: Callable):
        """Agregar callback para datos en tiempo real"""
        self.callbacks.append(callback)
    
    async def connect(self):
        """Conectar al WebSocket de Binance"""
        try:
            logger.info("🔌 Conectando a Binance WebSocket...")
            
            self.ws_connection = await websockets.connect(
                self.ws_url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=10
            )
            
            self.is_connected = True
            self.reconnect_attempts = 0
            logger.info("✅ Conectado exitosamente a Binance WebSocket")
            
            # Iniciar loop de recepción de datos
            await self.listen_to_stream()
            
        except Exception as e:
            logger.error(f"❌ Error conectando WebSocket: {e}")
            self.is_connected = False
            await self.handle_reconnection()
    
    async def listen_to_stream(self):
        """Escuchar stream de datos en tiempo real"""
        try:
            async for message in self.ws_connection:
                try:
                    data = json.loads(message)
                    
                    if 'k' in data:  # Kline data
                        kline = data['k']
                        
                        # Procesar datos de vela
                        processed_data = {
                            'time': int(kline['t']),  # Open time
                            'close_time': int(kline['T']),  # Close time
                            'open': float(kline['o']),
                            'high': float(kline['h']),
                            'low': float(kline['l']),
                            'close': float(kline['c']),
                            'volume': float(kline['v']),
                            'is_closed': kline['x'],  # Whether this kline is closed
                            'symbol': kline['s'],
                            'interval': kline['i'],
                            'timestamp': datetime.utcnow().isoformat()
                        }
                        
                        # Actualizar datos actuales
                        self.current_data = processed_data
                        self.data_queue.append(processed_data)
                        
                        # Ejecutar callbacks
                        for callback in self.callbacks:
                            try:
                                await callback(processed_data)
                            except Exception as cb_error:
                                logger.error(f"❌ Error en callback: {cb_error}")
                        
                        # Log cada 10 actualizaciones
                        if len(self.data_queue) % 10 == 0:
                            logger.info(f"📊 Datos en tiempo real: BTC ${processed_data['close']:.2f}")
                
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Error decodificando JSON: {e}")
                except Exception as e:
                    logger.error(f"❌ Error procesando mensaje WebSocket: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Conexión WebSocket cerrada")
            self.is_connected = False
            await self.handle_reconnection()
        except Exception as e:
            logger.error(f"❌ Error en stream WebSocket: {e}")
            self.is_connected = False
            await self.handle_reconnection()
    
    async def handle_reconnection(self):
        """Manejar reconexión automática"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("❌ Máximo número de reconexiones alcanzado, usando fallback HTTP")
            await self.start_http_fallback()
            return
        
        self.reconnect_attempts += 1
        wait_time = min(2 ** self.reconnect_attempts, 60)  # Exponential backoff, max 60s
        
        logger.info(f"🔄 Reconectando en {wait_time}s (intento {self.reconnect_attempts})")
        await asyncio.sleep(wait_time)
        
        await self.connect()
    
    async def start_http_fallback(self):
        """Iniciar fallback HTTP cuando WebSocket falla"""
        logger.info("🔄 Iniciando fallback HTTP para datos de mercado")
        
        while not self.is_connected:
            try:
                # Obtener datos HTTP
                async with aiohttp.ClientSession() as session:
                    params = {
                        "symbol": "BTCUSDT",
                        "interval": "1m",
                        "limit": 1
                    }
                    
                    async with session.get(self.http_fallback_url, params=params, timeout=10) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            if data:
                                kline = data[0]
                                processed_data = {
                                    'time': int(kline[0]),
                                    'close_time': int(kline[6]),
                                    'open': float(kline[1]),
                                    'high': float(kline[2]),
                                    'low': float(kline[3]),
                                    'close': float(kline[4]),
                                    'volume': float(kline[5]),
                                    'is_closed': True,
                                    'symbol': 'BTCUSDT',
                                    'interval': '1m',
                                    'timestamp': datetime.utcnow().isoformat(),
                                    'source': 'http_fallback'
                                }
                                
                                # Actualizar datos actuales
                                self.current_data = processed_data
                                self.data_queue.append(processed_data)
                                
                                # Ejecutar callbacks
                                for callback in self.callbacks:
                                    try:
                                        await callback(processed_data)
                                    except Exception as cb_error:
                                        logger.error(f"❌ Error en callback HTTP: {cb_error}")
                                
                                logger.info(f"📊 HTTP Fallback: BTC ${processed_data['close']:.2f}")
                        
                        else:
                            logger.error(f"❌ Error HTTP fallback: {response.status}")
                
                # Esperar antes de la siguiente actualización
                await asyncio.sleep(self.http_update_interval)
                
                # Intentar reconectar WebSocket cada 5 minutos
                if self.reconnect_attempts < self.max_reconnect_attempts:
                    current_time = datetime.utcnow()
                    if (not self.last_http_update or 
                        (current_time - self.last_http_update).seconds > 300):
                        self.last_http_update = current_time
                        logger.info("🔄 Intentando reconectar WebSocket...")
                        try:
                            await self.connect()
                            break  # Si se conecta exitosamente, salir del loop fallback
                        except:
                            pass
                            
            except Exception as e:
                logger.error(f"❌ Error en HTTP fallback: {e}")
                await asyncio.sleep(30)  # Esperar más tiempo en caso de error
    
    async def get_historical_data(self, limit: int = 100) -> List[Dict]:
        """Obtener datos históricos para inicialización"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "symbol": "BTCUSDT",
                    "interval": "5m",
                    "limit": limit
                }
                
                async with session.get(self.http_fallback_url, params=params, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        formatted_data = []
                        for kline in data:
                            formatted_data.append({
                                'time': int(kline[0]) // 1000,  # Convert to seconds for lightweight-charts
                                'open': float(kline[1]),
                                'high': float(kline[2]),
                                'low': float(kline[3]),
                                'close': float(kline[4]),
                                'volume': float(kline[5])
                            })
                        
                        logger.info(f"✅ Datos históricos obtenidos: {len(formatted_data)} velas")
                        return formatted_data
                    
                    else:
                        logger.error(f"❌ Error obteniendo datos históricos: {response.status}")
                        return []
                        
        except Exception as e:
            logger.error(f"❌ Error en datos históricos: {e}")
            return []
    
    def get_current_price(self) -> Optional[float]:
        """Obtener precio actual"""
        if self.current_data:
            return self.current_data['close']
        return None
    
    def get_latest_data(self) -> Optional[Dict]:
        """Obtener últimos datos"""
        return self.current_data
    
    def get_recent_data(self, count: int = 10) -> List[Dict]:
        """Obtener datos recientes"""
        return list(self.data_queue)[-count:] if len(self.data_queue) >= count else list(self.data_queue)
    
    async def start(self):
        """Iniciar cliente WebSocket"""
        logger.info("🚀 Iniciando cliente WebSocket Binance...")
        self.connection_task = asyncio.create_task(self.connect())
        return self.connection_task
    
    async def stop(self):
        """Detener cliente WebSocket"""
        logger.info("🛑 Deteniendo cliente WebSocket...")
        
        self.is_connected = False
        
        if self.ws_connection:
            await self.ws_connection.close()
        
        if self.connection_task:
            self.connection_task.cancel()
            try:
                await self.connection_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ Cliente WebSocket detenido")

# Instancia global
binance_ws_client = BinanceWebSocketClient()