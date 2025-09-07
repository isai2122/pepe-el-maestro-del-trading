#!/usr/bin/env python3
"""
Script para crear datos de muestra para la aplicación TradingAI Pro
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import random

# Configuración de MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.tradingai

async def create_sample_simulations():
    """Crear simulaciones de muestra"""
    
    # Limpiar datos existentes
    await db.simulations.delete_many({})
    
    simulations = []
    base_time = datetime.utcnow() - timedelta(days=30)
    
    for i in range(50):
        # Generar timestamp aleatorio en los últimos 30 días
        timestamp = base_time + timedelta(
            days=random.randint(0, 30),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )
        
        # Generar precios base
        entry_price = 60000 + random.randint(-10000, 15000)
        
        # Decidir si la simulación está cerrada (80% cerradas)
        is_closed = random.random() < 0.8
        
        trend = random.choice(['UP', 'DOWN'])
        up_prob = random.randint(45, 85) if trend == 'UP' else random.randint(15, 55)
        down_prob = 100 - up_prob
        
        simulation = {
            "id": str(uuid.uuid4()),
            "timestamp": timestamp,
            "entry_price": round(entry_price, 2),
            "trend": trend,
            "probability": {"up": up_prob, "down": down_prob},
            "confidence": round(random.uniform(0.6, 0.95), 2),
            "entry_method": random.choice(["AUTO", "MANUAL", "SIGNAL"]),
            "closed": is_closed
        }
        
        if is_closed:
            # Generar resultado para simulaciones cerradas
            if trend == 'UP':
                # 70% de éxito para tendencias alcistas
                success = random.random() < 0.7
                if success:
                    result_pct = random.uniform(0.5, 8.0)
                    exit_price = entry_price * (1 + result_pct / 100)
                else:
                    result_pct = random.uniform(-4.0, -0.2)
                    exit_price = entry_price * (1 + result_pct / 100)
            else:
                # 60% de éxito para tendencias bajistas
                success = random.random() < 0.6
                if success:
                    result_pct = random.uniform(0.3, 6.0)
                    exit_price = entry_price * (1 - result_pct / 100)
                else:
                    result_pct = random.uniform(-3.0, -0.1)
                    exit_price = entry_price * (1 + abs(result_pct) / 100)
            
            simulation.update({
                "exit_price": round(exit_price, 2),
                "result_pct": round(result_pct, 2),
                "success": success
            })
        else:
            # Simulaciones abiertas
            simulation.update({
                "exit_price": None,
                "result_pct": None,
                "success": None
            })
        
        simulations.append(simulation)
    
    # Insertar todas las simulaciones
    await db.simulations.insert_many(simulations)
    print(f"✅ Creadas {len(simulations)} simulaciones de muestra")

async def create_sample_signals():
    """Crear señales de muestra"""
    
    # Limpiar señales existentes
    await db.signals.delete_many({})
    
    signals = []
    base_time = datetime.utcnow() - timedelta(days=7)
    
    for i in range(20):
        timestamp = base_time + timedelta(
            days=random.randint(0, 7),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )
        
        trend = random.choice(['UP', 'DOWN', 'NEUTRAL'])
        entry_price = 60000 + random.randint(-8000, 12000)
        
        up_prob = random.randint(30, 80)
        down_prob = 100 - up_prob
        
        reasoning = [
            "RSI indica sobrecompra temporal",
            "MACD muestra divergencia alcista", 
            "Volumen por encima del promedio",
            "Soporte técnico fuerte",
            "Resistencia próxima a romperse",
            "Patrón de velas japonesas favorables",
            "Media móvil de 50 períodos alcista",
            "Bandas de Bollinger expandiéndose"
        ]
        
        selected_reasoning = random.sample(reasoning, 3)
        
        signal = {
            "id": str(uuid.uuid4()),
            "timestamp": timestamp,
            "symbol": "BTCUSDT",
            "trend": trend,
            "probability": {"up": up_prob, "down": down_prob},
            "confidence": round(random.uniform(0.65, 0.92), 2),
            "entry_price": round(entry_price, 2),
            "indicators": {
                "rsi": round(random.uniform(30, 70), 1),
                "macd": round(random.uniform(-500, 500), 2),
                "volume_ratio": round(random.uniform(0.8, 2.5), 2)
            },
            "reasoning": selected_reasoning
        }
        
        signals.append(signal)
    
    await db.signals.insert_many(signals)
    print(f"✅ Creadas {len(signals)} señales de muestra")

async def main():
    """Ejecutar creación de datos de muestra"""
    print("🚀 Iniciando creación de datos de muestra...")
    
    try:
        await create_sample_simulations()
        await create_sample_signals()
        print("✅ Datos de muestra creados exitosamente!")
        
    except Exception as e:
        print(f"❌ Error creando datos de muestra: {e}")
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())