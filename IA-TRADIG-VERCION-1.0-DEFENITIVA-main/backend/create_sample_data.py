"""
Script para crear datos de muestra y entrenar el sistema inicial
"""

import asyncio
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from technical_analysis import analyzer
from ai_learning_system import initialize_ml_system, ml_system
import os

async def create_sample_training_data():
    """Crea datos de muestra para entrenar el sistema inicialmente"""
    
    # Conectar a MongoDB
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.tradingai
    
    # Inicializar sistema ML
    global ml_system
    ml_system = await initialize_ml_system(client)
    
    # Verificar que ml_system está inicializado
    if ml_system is None:
        print("❌ Error: Sistema ML no inicializado correctamente")
        return
    
    print("🚀 Creando datos de muestra para entrenamiento inicial...")
    
    # Generar datos históricos sintéticos
    for i in range(200):
        try:
            # Simular análisis técnico
            rsi = random.uniform(20, 80)
            macd = random.uniform(-50, 50)
            bb_position = random.uniform(0, 1)
            volume_strength = random.uniform(-2, 2)
            
            # Análisis técnico sintético
            technical_analysis = {
                'rsi': rsi,
                'macd': {
                    'macd': macd,
                    'signal': macd + random.uniform(-10, 10),
                    'histogram': random.uniform(-20, 20)
                },
                'bollinger': {
                    'position': bb_position
                },
                'emas': {
                    'crossover': random.choice([True, False])
                },
                'stochastic': {
                    'k': random.uniform(0, 100),
                    'd': random.uniform(0, 100)
                },
                'volume': {
                    'volume_strength': volume_strength,
                    'volume_trend': 1 if volume_strength > 0 else -1
                },
                'patterns': {
                    'hammer': random.choice([True, False]),
                    'doji': random.choice([True, False]),
                    'engulfing_bullish': random.choice([True, False])
                },
                'support_resistance': {
                    'resistance_distance': random.uniform(0, 0.1),
                    'support_distance': random.uniform(0, 0.1)
                },
                'signals': {
                    'strength': random.uniform(-100, 100),
                    'bullish_signals': ['Synthetic signal ' + str(j) for j in range(random.randint(0, 3))],
                    'bearish_signals': ['Synthetic signal ' + str(j) for j in range(random.randint(0, 3))],
                    'confidence': random.uniform(0.5, 0.9)
                }
            }
            
            # Simular resultado basado en lógica básica
            # RSI bajo + MACD positivo + cerca del soporte = más probable que suba
            bullish_factors = 0
            if rsi < 40:
                bullish_factors += 1
            if macd > 0:
                bullish_factors += 1
            if bb_position < 0.3:
                bullish_factors += 1
            if volume_strength > 0:
                bullish_factors += 1
            
            # Resultado con algo de aleatoriedad pero basado en factores
            success_probability = 0.3 + (bullish_factors * 0.15)  # 30% base + 15% por factor
            actual_result = random.random() < success_probability
            
            # Recolectar datos de entrenamiento
            await ml_system.collect_training_data(technical_analysis, actual_result)
            
            if i % 50 == 0:
                print(f"✅ Generados {i+1}/200 ejemplos de entrenamiento")
                
        except Exception as e:
            print(f"❌ Error generando ejemplo {i}: {e}")
            continue
    
    print("🤖 Entrenando modelos iniciales...")
    
    # Entrenar modelos con datos sintéticos
    training_results = await ml_system.train_models()
    print(f"✅ Modelos entrenados: {training_results}")
    
    # Obtener estadísticas
    stats = await ml_system.get_learning_stats()
    print(f"📊 Estadísticas de entrenamiento: {stats}")
    
    print("🎉 Sistema de aprendizaje inicializado con datos de muestra")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_sample_training_data())