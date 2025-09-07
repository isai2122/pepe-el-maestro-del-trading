import requests
import sys
import json
from datetime import datetime
import uuid

class TradingAITester:
    def __init__(self, base_url="https://tradingbot-ai-22.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_root_endpoint(self):
        """Test root endpoint"""
        return self.run_test("Root Endpoint", "GET", "", 200)

    def test_get_signals(self):
        """Test getting signals"""
        return self.run_test("Get Signals", "GET", "api/signals", 200)

    def test_create_signal(self):
        """Test creating a signal"""
        signal_data = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": "BTCUSDT",
            "trend": "UP",
            "probability": {"up": 75, "down": 25},
            "confidence": 0.85,
            "entry_price": 45000.0,
            "indicators": {
                "rsi": 65.5,
                "macd": 0.15,
                "sma_fast": 45100.0,
                "sma_slow": 44800.0
            },
            "reasoning": ["RSI showing bullish momentum", "MACD positive crossover"]
        }
        return self.run_test("Create Signal", "POST", "api/signals", 200, signal_data)

    def test_get_simulations(self):
        """Test getting simulations"""
        return self.run_test("Get Simulations", "GET", "api/simulations", 200)

    def test_create_simulation(self):
        """Test creating a simulation"""
        simulation_data = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "entry_price": 45000.0,
            "exit_price": None,
            "trend": "UP",
            "probability": {"up": 75, "down": 25},
            "confidence": 0.85,
            "result_pct": None,
            "success": None,
            "closed": False,
            "entry_method": "AUTO"
        }
        success, response = self.run_test("Create Simulation", "POST", "api/simulations", 200, simulation_data)
        return success, response

    def test_update_simulation(self, simulation_id):
        """Test updating a simulation"""
        update_data = {
            "exit_price": 46000.0,
            "result_pct": 2.22,
            "success": True,
            "closed": True
        }
        return self.run_test("Update Simulation", "PUT", f"api/simulations/{simulation_id}", 200, update_data)

    def test_get_stats(self):
        """Test getting trading statistics"""
        return self.run_test("Get Trading Stats", "GET", "api/stats", 200)

    def test_market_data(self):
        """Test market data endpoint"""
        return self.run_test("Market Data", "GET", "api/market-data", 200)

    def test_clear_simulations(self):
        """Test clearing simulations"""
        return self.run_test("Clear Simulations", "DELETE", "api/simulations", 200)

def main():
    print("🚀 Starting TradingAI Pro Backend Tests")
    print("=" * 50)
    
    tester = TradingAITester()
    
    # Test basic endpoints
    tester.test_root_endpoint()
    tester.test_health_check()
    
    # Test signals endpoints
    tester.test_get_signals()
    tester.test_create_signal()
    
    # Test simulations endpoints
    tester.test_get_simulations()
    success, response = tester.test_create_simulation()
    
    # If simulation was created successfully, test update
    if success and isinstance(response, dict) and 'id' in response:
        simulation_id = response['id']
        tester.test_update_simulation(simulation_id)
    
    # Test stats and other endpoints
    tester.test_get_stats()
    tester.test_market_data()
    
    # Clean up
    tester.test_clear_simulations()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())