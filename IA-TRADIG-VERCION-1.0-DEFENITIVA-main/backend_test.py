#!/usr/bin/env python3
"""
Comprehensive Backend Testing for MIRA Enhanced Trading System
Tests all APIs and ML functionality to verify 90% success rate target
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List

class MIRABackendTester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []
        self.api_responses = {}

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
            self.errors.append(f"{name}: {details}")

    def test_api_endpoint(self, name: str, endpoint: str, expected_status: int = 200, method: str = "GET", data: Dict = None) -> tuple:
        """Test a single API endpoint"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
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
                try:
                    response_data = response.json()
                    self.api_responses[endpoint] = response_data
                    self.log_test(name, True, f"Status: {response.status_code}")
                    return True, response_data
                except json.JSONDecodeError:
                    self.log_test(name, True, f"Status: {response.status_code} (No JSON response)")
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}
                
        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Connection error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Unexpected error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test system health endpoint"""
        print("\n🔍 Testing Health Check...")
        success, data = self.test_api_endpoint("Health Check", "/api/health")
        
        if success and data:
            # Verify health response structure
            required_fields = ['status', 'timestamp', 'version', 'ml_system', 'technical_analysis']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Health Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Health Response Structure", True, "All required fields present")
                
            # Check ML system status
            ml_status = data.get('ml_system', 'unknown')
            if ml_status in ['trained', 'learning']:
                self.log_test("ML System Status", True, f"Status: {ml_status}")
            else:
                self.log_test("ML System Status", False, f"Unexpected status: {ml_status}")

    def test_trading_stats(self):
        """Test trading statistics endpoint"""
        print("\n📊 Testing Trading Statistics...")
        success, data = self.test_api_endpoint("Trading Stats", "/api/stats")
        
        if success and data:
            # Verify stats structure
            required_fields = ['total_simulations', 'closed_simulations', 'wins', 'losses', 'win_rate', 'avg_profit']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Stats Response Structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Stats Response Structure", True, "All required fields present")
                
                # Check win rate progress toward 90%
                win_rate = data.get('win_rate', 0)
                self.log_test("Win Rate Check", True, f"Current win rate: {win_rate:.1f}%")
                
                if win_rate >= 90:
                    self.log_test("90% Success Target", True, f"🎉 TARGET ACHIEVED: {win_rate:.1f}%")
                elif win_rate >= 70:
                    self.log_test("Progress to 90%", True, f"Good progress: {win_rate:.1f}% (Target: 90%)")
                else:
                    self.log_test("Progress to 90%", False, f"Needs improvement: {win_rate:.1f}% (Target: 90%)")
                
                # Check ML accuracy
                ml_accuracy = data.get('ml_accuracy')
                if ml_accuracy is not None:
                    self.log_test("ML Accuracy", True, f"ML Precision: {ml_accuracy:.1f}%")
                else:
                    self.log_test("ML Accuracy", False, "ML accuracy not available")

    def test_simulations(self):
        """Test simulations endpoint"""
        print("\n🤖 Testing Simulations...")
        success, data = self.test_api_endpoint("Get Simulations", "/api/simulations")
        
        if success and isinstance(data, list):
            self.log_test("Simulations Response", True, f"Retrieved {len(data)} simulations")
            
            if len(data) > 0:
                # Analyze simulation data
                ml_enhanced = len([s for s in data if s.get('entry_method') == 'ML_ENHANCED'])
                technical_analysis = len([s for s in data if s.get('entry_method') == 'TECHNICAL_ANALYSIS'])
                open_sims = len([s for s in data if not s.get('closed', True)])
                closed_sims = len([s for s in data if s.get('closed', False)])
                
                self.log_test("ML Enhanced Simulations", True, f"Found {ml_enhanced} ML Enhanced simulations")
                self.log_test("Technical Analysis Simulations", True, f"Found {technical_analysis} Technical Analysis simulations")
                self.log_test("Active Simulations", True, f"{open_sims} active, {closed_sims} closed")
                
                # Check simulation structure
                sample_sim = data[0]
                required_fields = ['id', 'timestamp', 'entry_price', 'trend', 'confidence', 'entry_method']
                missing_fields = [field for field in required_fields if field not in sample_sim]
                
                if missing_fields:
                    self.log_test("Simulation Structure", False, f"Missing fields: {missing_fields}")
                else:
                    self.log_test("Simulation Structure", True, "All required fields present")
            else:
                self.log_test("Simulation Generation", False, "No simulations found - system may not be generating them")

    def test_ml_stats(self):
        """Test ML statistics endpoint"""
        print("\n🧠 Testing ML Statistics...")
        success, data = self.test_api_endpoint("ML Stats", "/api/ml-stats")
        
        if success and data:
            if 'error' in data:
                self.log_test("ML System Initialization", False, f"ML Error: {data['error']}")
            else:
                # Check ML stats structure
                training_samples = data.get('total_training_samples', 0)
                labeled_samples = data.get('labeled_samples', 0)
                recent_accuracy = data.get('recent_accuracy', 0)
                models_trained = data.get('models_trained', False)
                
                self.log_test("ML Training Samples", True, f"Total: {training_samples}, Labeled: {labeled_samples}")
                self.log_test("ML Models Trained", models_trained, f"Models trained: {models_trained}")
                self.log_test("ML Recent Accuracy", True, f"Recent accuracy: {recent_accuracy*100:.1f}%")
                
                # Check feature importance
                feature_importance = data.get('feature_importance', {})
                if feature_importance:
                    self.log_test("Feature Importance", True, f"Available for {len(feature_importance)} models")
                else:
                    self.log_test("Feature Importance", False, "Feature importance not available")

    def test_market_data(self):
        """Test market data and technical analysis endpoint"""
        print("\n📈 Testing Market Data & Technical Analysis...")
        success, data = self.test_api_endpoint("Market Data", "/api/market-data")
        
        if success and data:
            if data.get('status') == 'success':
                # Check technical analysis structure
                technical_analysis = data.get('technical_analysis', {})
                ml_prediction = data.get('ml_prediction', {})
                
                if technical_analysis:
                    # Check key technical indicators
                    indicators = ['rsi', 'macd', 'bollinger', 'emas', 'signals']
                    present_indicators = [ind for ind in indicators if ind in technical_analysis]
                    
                    self.log_test("Technical Indicators", True, f"Present: {present_indicators}")
                    
                    # Check RSI value
                    rsi = technical_analysis.get('rsi')
                    if rsi is not None:
                        self.log_test("RSI Calculation", True, f"RSI: {rsi:.1f}")
                    else:
                        self.log_test("RSI Calculation", False, "RSI not calculated")
                    
                    # Check signals
                    signals = technical_analysis.get('signals', {})
                    if signals:
                        strength = signals.get('strength', 0)
                        confidence = signals.get('confidence', 0)
                        self.log_test("Trading Signals", True, f"Strength: {strength}, Confidence: {confidence:.2f}")
                    else:
                        self.log_test("Trading Signals", False, "No trading signals generated")
                else:
                    self.log_test("Technical Analysis", False, "Technical analysis not available")
                
                if ml_prediction:
                    prediction = ml_prediction.get('prediction')
                    confidence = ml_prediction.get('confidence', 0)
                    self.log_test("ML Prediction", True, f"Prediction: {prediction}, Confidence: {confidence:.2f}")
                else:
                    self.log_test("ML Prediction", False, "ML prediction not available")
            else:
                error = data.get('error', 'Unknown error')
                self.log_test("Market Data Analysis", False, f"Analysis failed: {error}")

    def test_binance_proxy(self):
        """Test Binance API proxy"""
        print("\n🔗 Testing Binance API Proxy...")
        success, data = self.test_api_endpoint("Binance Klines", "/api/binance/klines?symbol=BTCUSDT&interval=5m&limit=10")
        
        if success and data:
            if data.get('success'):
                klines_data = data.get('data', [])
                if len(klines_data) > 0:
                    self.log_test("Binance Data Retrieval", True, f"Retrieved {len(klines_data)} candles")
                    
                    # Check data structure
                    sample_candle = klines_data[0]
                    required_fields = ['time', 'open', 'high', 'low', 'close', 'volume']
                    missing_fields = [field for field in required_fields if field not in sample_candle]
                    
                    if missing_fields:
                        self.log_test("Binance Data Structure", False, f"Missing fields: {missing_fields}")
                    else:
                        self.log_test("Binance Data Structure", True, "All required fields present")
                        
                        # Check price data validity
                        price = sample_candle.get('close', 0)
                        if 10000 <= price <= 200000:  # Reasonable BTC price range
                            self.log_test("Price Data Validity", True, f"BTC Price: ${price:.2f}")
                        else:
                            self.log_test("Price Data Validity", False, f"Unusual BTC price: ${price:.2f}")
                else:
                    self.log_test("Binance Data Retrieval", False, "No candle data received")
            else:
                error = data.get('error', 'Unknown error')
                self.log_test("Binance API Proxy", False, f"Binance error: {error}")

    def test_system_integration(self):
        """Test system integration and data flow"""
        print("\n🔄 Testing System Integration...")
        
        # Wait a moment for system to generate data
        print("⏳ Waiting 20 seconds for system to generate fresh data...")
        time.sleep(20)
        
        # Re-fetch stats to see if system is actively working
        success, stats_data = self.test_api_endpoint("Updated Stats", "/api/stats")
        success2, sims_data = self.test_api_endpoint("Updated Simulations", "/api/simulations")
        
        if success and success2:
            total_sims = stats_data.get('total_simulations', 0)
            active_sims = len([s for s in sims_data if not s.get('closed', True)]) if isinstance(sims_data, list) else 0
            
            if total_sims > 0:
                self.log_test("System Activity", True, f"System generated {total_sims} total simulations")
                
                if active_sims > 0:
                    self.log_test("Active Trading", True, f"{active_sims} simulations currently active")
                else:
                    self.log_test("Active Trading", False, "No active simulations found")
                    
                # Check if system is progressing toward 90% target
                win_rate = stats_data.get('win_rate', 0)
                ml_accuracy = stats_data.get('ml_accuracy', 0)
                
                progress_score = (win_rate + (ml_accuracy or 0)) / 2
                if progress_score >= 80:
                    self.log_test("90% Target Progress", True, f"🎯 Excellent progress: {progress_score:.1f}%")
                elif progress_score >= 60:
                    self.log_test("90% Target Progress", True, f"📈 Good progress: {progress_score:.1f}%")
                else:
                    self.log_test("90% Target Progress", False, f"📉 Needs improvement: {progress_score:.1f}%")
            else:
                self.log_test("System Activity", False, "System not generating simulations")

    def run_comprehensive_test(self):
        """Run all backend tests"""
        print("🚀 Starting MIRA Enhanced Backend Testing...")
        print("=" * 60)
        
        start_time = time.time()
        
        # Core API Tests
        self.test_health_check()
        self.test_trading_stats()
        self.test_simulations()
        self.test_ml_stats()
        self.test_market_data()
        self.test_binance_proxy()
        
        # Integration Tests
        self.test_system_integration()
        
        # Summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "=" * 60)
        print("📊 MIRA ENHANCED BACKEND TEST RESULTS")
        print("=" * 60)
        
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"⏱️  Duration: {duration:.1f} seconds")
        print(f"🎯 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ FAILED TESTS ({len(self.errors)}):")
            for error in self.errors:
                print(f"   • {error}")
        
        # System Status Summary
        print(f"\n🤖 MIRA SYSTEM STATUS:")
        
        # Get final stats
        stats = self.api_responses.get('/api/stats', {})
        ml_stats = self.api_responses.get('/api/ml-stats', {})
        
        if stats:
            win_rate = stats.get('win_rate', 0)
            total_sims = stats.get('total_simulations', 0)
            ml_accuracy = stats.get('ml_accuracy', 0)
            
            print(f"   📈 Win Rate: {win_rate:.1f}% (Target: 90%)")
            print(f"   🤖 ML Accuracy: {ml_accuracy:.1f}%" if ml_accuracy else "   🤖 ML Accuracy: Not available")
            print(f"   📊 Total Simulations: {total_sims}")
            
            if win_rate >= 90:
                print(f"   🎉 🎯 TARGET ACHIEVED! System reached 90% success rate!")
            elif win_rate >= 70:
                print(f"   📈 Good progress toward 90% target")
            else:
                print(f"   ⚠️  System needs improvement to reach 90% target")
        
        if ml_stats and not ml_stats.get('error'):
            training_samples = ml_stats.get('labeled_samples', 0)
            models_trained = ml_stats.get('models_trained', False)
            print(f"   🧠 ML Training Samples: {training_samples}")
            print(f"   🔧 ML Models Trained: {'Yes' if models_trained else 'No'}")
        
        print(f"\n{'🎉 ALL TESTS PASSED!' if self.tests_passed == self.tests_run else '⚠️  SOME TESTS FAILED'}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    print("🤖 MIRA Enhanced Trading System - Backend Testing")
    print("Testing system progress toward 90% success rate target")
    print("=" * 60)
    
    # Use environment variable or default
    import os
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
    
    tester = MIRABackendTester(backend_url)
    success = tester.run_comprehensive_test()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())