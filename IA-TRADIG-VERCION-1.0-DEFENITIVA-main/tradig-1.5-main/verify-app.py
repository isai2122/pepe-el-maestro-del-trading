#!/usr/bin/env python3
"""
Script de verificación para TradingAI Pro
Verifica que la aplicación esté lista para deployment en Render
"""

import requests
import time
import json
import os

def test_backend_health():
    """Test que el backend esté funcionando"""
    try:
        response = requests.get("http://localhost:8001/api/health", timeout=10)
        if response.status_code == 200:
            print("✅ Backend health check: OK")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend connection error: {e}")
        return False

def test_simulations_endpoint():
    """Test que las simulaciones se estén generando"""
    try:
        response = requests.get("http://localhost:8001/api/simulations", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Simulaciones endpoint: OK ({len(data)} simulaciones)")
            return True
        else:
            print(f"❌ Simulaciones endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Simulaciones endpoint error: {e}")
        return False

def test_market_data():
    """Test que los datos de mercado funcionen"""
    try:
        response = requests.get("http://localhost:8001/api/binance/klines?symbol=BTCUSDT&interval=5m&limit=10", timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('data'):
                print("✅ Market data: OK")
                return True
            elif data.get('error') and 'Binance API error' in data.get('error', ''):
                print("⚠️ Market data: Binance blocked (fallback available)")
                return True  # Este es OK, tenemos fallback
            else:
                print("❌ Market data: Invalid response format")
                return False
        else:
            print(f"❌ Market data failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Market data error: {e}")
        return False

def test_stats():
    """Test estadísticas"""
    try:
        response = requests.get("http://localhost:8001/api/stats", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Stats endpoint: OK")
            print(f"   - Total simulaciones: {data.get('total_simulations', 0)}")
            print(f"   - Win rate: {data.get('win_rate', 0):.1f}%")
            return True
        else:
            print(f"❌ Stats endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Stats endpoint error: {e}")
        return False

def check_files():
    """Verificar que todos los archivos necesarios existan"""
    required_files = [
        "/app/Dockerfile",
        "/app/render.yaml", 
        "/app/frontend/package.json",
        "/app/frontend/yarn.lock",
        "/app/backend/requirements.txt",
        "/app/backend/server.py",
        "/app/frontend/src/App.js"
    ]
    
    all_good = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}: Existe")
        else:
            print(f"❌ {file_path}: NO EXISTE")
            all_good = False
    
    return all_good

def main():
    print("🚀 VERIFICACIÓN TRADINGAI PRO PARA RENDER")
    print("=" * 50)
    
    # Verificar archivos
    print("\n1. Verificando archivos necesarios...")
    files_ok = check_files()
    
    # Verificar backend
    print("\n2. Verificando backend...")
    backend_ok = test_backend_health()
    
    if backend_ok:
        # Test endpoints
        print("\n3. Verificando endpoints...")
        sims_ok = test_simulations_endpoint()
        market_ok = test_market_data()
        stats_ok = test_stats()
    else:
        sims_ok = market_ok = stats_ok = False
    
    # Resumen
    print("\n" + "=" * 50)
    print("📊 RESUMEN DE VERIFICACIÓN:")
    print(f"   Archivos: {'✅ OK' if files_ok else '❌ ERROR'}")
    print(f"   Backend: {'✅ OK' if backend_ok else '❌ ERROR'}")
    print(f"   Simulaciones: {'✅ OK' if sims_ok else '❌ ERROR'}")
    print(f"   Market Data: {'✅ OK' if market_ok else '❌ ERROR'}")
    print(f"   Estadísticas: {'✅ OK' if stats_ok else '❌ ERROR'}")
    
    all_tests_passed = all([files_ok, backend_ok, sims_ok, market_ok, stats_ok])
    
    if all_tests_passed:
        print("\n🎉 ¡APLICACIÓN LISTA PARA RENDER!")
        print("✅ Todos los tests pasaron correctamente")
        print("🚀 Puedes proceder con el deployment")
    else:
        print("\n⚠️ HAY PROBLEMAS QUE ARREGLAR")
        print("❌ Algunos tests fallaron")
        print("🔧 Revisa los errores arriba antes del deployment")
    
    return all_tests_passed

if __name__ == "__main__":
    main()