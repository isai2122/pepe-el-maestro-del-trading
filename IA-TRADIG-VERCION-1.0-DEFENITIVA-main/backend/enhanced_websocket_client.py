"""
Cliente WebSocket Mejorado con Fallback Inteligente
Conexión a Binance con simulador realista cuando no hay conexión
"""
import asyncio
import websockets
import json
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime
import aiohttp
from collections import deque
from market_data_simulator import market_simulator

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnhancedBinanceWebSocketClient:
    """Cliente WebSocket mejorado con fallback inteligente"""
    
    def __init__(self):
        self.ws_url = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"
        self.ws_connection = None
        self.is_connected = False
        self.use_simulator = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 5  # Reducido para cambiar a simulador más rápido
        self.current_data = None
        self.data_queue = deque(maxlen=1000)
        self.callbacks = []
        self.connection_task = None
        
        # Fallback HTTP endpoint
        self.http_fallback_url = "https://api.binance.com/api/v3/klines"
        self.last_http_update = None
        self.http_update_interval = 15
        
        # Estados de conexión
        self.connection_status = "disconnected"  # disconnected, connecting, connected, simulator
        
    def add_callback(self, callback: Callable):
        """Agregar callback para datos en tiempo real"""
        self.callbacks.append(callback)
    
    async def connect(self):
        """Conectar al WebSocket de Binance o usar simulador"""
        try:
            logger.info("🔌 Intentando conectar a Binance WebSocket...")
            self.connection_status = "connecting"
            
            # Intentar conexión HTTP primero para verificar disponibilidad
            can_connect = await self.test_binance_connection()
            
            if not can_connect:
                logger.warning("⚠️ Binance no disponible, usando simulador de mercado")
                await self.start_simulator_mode()
                return
            
            # Intentar WebSocket
            self.ws_connection = await websockets.connect(
                self.ws_url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=10
            )
            
            self.is_connected = True
            self.use_simulator = False
            self.reconnect_attempts = 0
            self.connection_status = "connected"
            logger.info("✅ Conectado exitosamente a Binance WebSocket")
            
            # Iniciar loop de recepción de datos
            await self.listen_to_stream()
            
        except Exception as e:
            logger.error(f"❌ Error conectando WebSocket: {e}")
            self.is_connected = False
            self.connection_status = "disconnected"
            await self.handle_reconnection()
    
    async def test_binance_connection(self) -> bool:
        """Probar conexión a Binance API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.binance.com/api/v3/ping", 
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except:
            return False
    
    async def start_simulator_mode(self):
        """Iniciar modo simulador"""
        logger.info("🎲 Iniciando modo simulador de mercado")
        self.use_simulator = True
        self.is_connected = True  # Consideramos conectado al simulador
        self.connection_status = "simulator"
        
        # Añadir callback del simulador
        market_simulator.add_realtime_callback(self.handle_simulator_data)
        
        # Iniciar simulación en tiempo real
        asyncio.create_task(market_simulator.start_realtime_simulation())
        
        # Obtener datos históricos del simulador
        historical_data = market_simulator.get_historical_klines(100)
        logger.info(f"📊 Datos históricos del simulador: {len(historical_data)} velas")
        
        # Simular que estamos escuchando continuamente
        while self.use_simulator and self.is_connected:
            await asyncio.sleep(60)  # Mantener la conexión activa
    
    async def handle_simulator_data(self, data):
        """Manejar datos del simulador"""
        try:
            # Convertir datos del simulador al formato WebSocket
            processed_data = {
                'time': data['time'],
                'close_time': data['close_time'],
                'open': data['open'],
                'high': data['high'],
                'low': data['low'],
                'close': data['close'],
                'volume': data['volume'],
                'is_closed': data.get('is_closed', False),
                'symbol': data['symbol'],
                'interval': data['interval'],
                'timestamp': data['timestamp'],
                'source': 'simulator'
            }
            
            # Actualizar datos actuales
            self.current_data = processed_data
            self.data_queue.append(processed_data)
            
            # Ejecutar callbacks
            for callback in self.callbacks:
                try:
                    await callback(processed_data)
                except Exception as cb_error:
                    logger.error(f"❌ Error en callback simulador: {cb_error}")
            
            # Log ocasional
            if len(self.data_queue) % 20 == 0:
                logger.info(f"📊 Datos simulador: BTC ${processed_data['close']:.2f}")
        
        except Exception as e:
            logger.error(f"❌ Error procesando datos simulador: {e}")
    
    async def listen_to_stream(self):
        """Escuchar stream de datos en tiempo real de Binance"""
        try:
            async for message in self.ws_connection:
                try:
                    data = json.loads(message)
                    
                    if 'k' in data:  # Kline data
                        kline = data['k']
                        
                        # Procesar datos de vela
                        processed_data = {
                            'time': int(kline['t']),
                            'close_time': int(kline['T']),
                            'open': float(kline['o']),
                            'high': float(kline['h']),
                            'low': float(kline['l']),
                            'close': float(kline['c']),
                            'volume': float(kline['v']),
                            'is_closed': kline['x'],
                            'symbol': kline['s'],
                            'interval': kline['i'],
                            'timestamp': datetime.utcnow().isoformat(),
                            'source': 'binance'
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
                            logger.info(f"📊 Datos Binance: BTC ${processed_data['close']:.2f}")
                
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Error decodificando JSON: {e}")
                except Exception as e:
                    logger.error(f"❌ Error procesando mensaje WebSocket: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Conexión WebSocket cerrada")
            self.is_connected = False
            self.connection_status = "disconnected"
            await self.handle_reconnection()
        except Exception as e:
            logger.error(f"❌ Error en stream WebSocket: {e}")
            self.is_connected = False
            self.connection_status = "disconnected"
            await self.handle_reconnection()
    
    async def handle_reconnection(self):
        """Manejar reconexión automática o cambio a simulador"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.warning("❌ Máximas reconexiones alcanzadas, cambiando a modo simulador")
            await self.start_simulator_mode()
            return
        
        self.reconnect_attempts += 1
        wait_time = min(2 ** self.reconnect_attempts, 30)  # Exponential backoff, max 30s
        
        logger.info(f"🔄 Reconectando en {wait_time}s (intento {self.reconnect_attempts})")
        await asyncio.sleep(wait_time)
        
        await self.connect()
    
    async def get_historical_data(self, limit: int = 100) -> List[Dict]:
        """Obtener datos históricos"""
        try:
            if self.use_simulator:
                # Usar datos del simulador
                data = market_simulator.get_historical_klines(limit)
                formatted_data = []
                for item in data:
                    formatted_data.append({
                        'time': int(item['time']) // 1000,  # Convertir a segundos
                        'open': item['open'],
                        'high': item['high'],
                        'low': item['low'],
                        'close': item['close'],
                        'volume': item['volume']
                    })
                
                logger.info(f"✅ Datos históricos simulador: {len(formatted_data)} velas")
                return formatted_data
            
            # Intentar obtener de Binance
            async with aiohttp.ClientSession() as session:
                params = {
                    "symbol": "BTCUSDT",
                    "interval": "5m",
                    "limit": limit
                }
                
                async with session.get(
                    self.http_fallback_url, 
                    params=params, 
                    timeout=aiohttp.ClientTimeout(total=15)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        formatted_data = []
                        for kline in data:
                            formatted_data.append({
                                'time': int(kline[0]) // 1000,
                                'open': float(kline[1]),
                                'high': float(kline[2]),
                                'low': float(kline[3]),
                                'close': float(kline[4]),
                                'volume': float(kline[5])
                            })
                        
                        logger.info(f"✅ Datos históricos Binance: {len(formatted_data)} velas")
                        return formatted_data
                    
                    else:
                        logger.warning(f"⚠️ Error Binance {response.status}, usando simulador")
                        # Cambiar a simulador para datos históricos
                        return await self.get_historical_data_from_simulator(limit)
                        
        except Exception as e:
            logger.error(f"❌ Error obteniendo datos históricos: {e}")
            return await self.get_historical_data_from_simulator(limit)
    
    async def get_historical_data_from_simulator(self, limit: int = 100) -> List[Dict]:
        """Obtener datos históricos del simulador como fallback"""
        data = market_simulator.get_historical_klines(limit)
        formatted_data = []
        for item in data:
            formatted_data.append({
                'time': int(item['time']) // 1000,
                'open': item['open'],
                'high': item['high'],
                'low': item['low'],
                'close': item['close'],
                'volume': item['volume']
            })
        
        logger.info(f"✅ Datos históricos simulador (fallback): {len(formatted_data)} velas")
        return formatted_data
    
    def get_current_price(self) -> Optional[float]:
        """Obtener precio actual"""
        if self.use_simulator:
            return market_simulator.get_current_price()
        elif self.current_data:
            return self.current_data['close']
        return None
    
    def get_latest_data(self) -> Optional[Dict]:
        """Obtener últimos datos"""
        if self.use_simulator:
            return market_simulator.get_latest_candle()
        return self.current_data
    
    def get_recent_data(self, count: int = 10) -> List[Dict]:
        """Obtener datos recientes"""
        return list(self.data_queue)[-count:] if len(self.data_queue) >= count else list(self.data_queue)
    
    def get_connection_status(self) -> str:
        """Obtener estado de conexión"""
        return self.connection_status
    
    def is_using_simulator(self) -> bool:
        """Verificar si está usando simulador"""
        return self.use_simulator
    
    async def start(self):
        """Iniciar cliente WebSocket"""
        logger.info("🚀 Iniciando cliente WebSocket mejorado...")
        self.connection_task = asyncio.create_task(self.connect())
        return self.connection_task
    
    async def stop(self):
        """Detener cliente WebSocket"""
        logger.info("🛑 Deteniendo cliente WebSocket...")
        
        self.is_connected = False
        self.connection_status = "disconnected"
        
        if self.use_simulator:
            market_simulator.stop_realtime_simulation()
            self.use_simulator = False
        
        if self.ws_connection:
            await self.ws_connection.close()
        
        if self.connection_task:
            self.connection_task.cancel()
            try:
                await self.connection_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ Cliente WebSocket detenido")

# Instancia global mejorada
enhanced_binance_ws_client = EnhancedBinanceWebSocketClient()