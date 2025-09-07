#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for BTS/USDT Trading AI System
Tests all endpoints using the public URL
"""

import requests
import sys
import json
from datetime import datetime
import time

class TradingAITester:
    def __init__(self, base_url="https://learning-bts.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.current_signal_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {data.get('status')}, AI: {data.get('ai_system')}"
                return self.log_test("Health Check", True, details)
            else:
                return self.log_test("Health Check", False, f"Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Health Check", False, f"Error: {str(e)}")

    def test_current_signal(self):
        """Test current trading signal endpoint"""
        try:
            print("\n🎯 Testing Current Signal Generation...")
            response = requests.get(f"{self.api_url}/trading/current-signal", timeout=15)
            
            if response.status_code != 200:
                return self.log_test("Current Signal", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            # Validate signal structure
            required_fields = ['signal', 'market_data', 'news_analysis', 'timestamp']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return self.log_test("Current Signal", False, f"Missing fields: {missing_fields}")
            
            # Validate signal data
            signal = data['signal']
            signal_fields = ['id', 'pair', 'signal', 'confidence', 'entry_price']
            missing_signal_fields = [field for field in signal_fields if field not in signal]
            
            if missing_signal_fields:
                return self.log_test("Current Signal", False, f"Missing signal fields: {missing_signal_fields}")
            
            # Store signal ID for later tests
            self.current_signal_id = signal['id']
            
            # Validate signal values
            if signal['pair'] != 'BTS/USDT':
                return self.log_test("Current Signal", False, f"Wrong pair: {signal['pair']}")
            
            if signal['signal'] not in ['BUY', 'SELL', 'HOLD']:
                return self.log_test("Current Signal", False, f"Invalid signal: {signal['signal']}")
            
            if not (0 <= signal['confidence'] <= 100):
                return self.log_test("Current Signal", False, f"Invalid confidence: {signal['confidence']}")
            
            if signal['entry_price'] <= 0:
                return self.log_test("Current Signal", False, f"Invalid price: {signal['entry_price']}")
            
            # Validate market data
            market_data = data['market_data']
            if market_data['pair'] != 'BTS/USDT':
                return self.log_test("Current Signal", False, f"Wrong market pair: {market_data['pair']}")
            
            details = f"Signal: {signal['signal']}, Confidence: {signal['confidence']:.1f}%, Price: ${signal['entry_price']:.6f}"
            return self.log_test("Current Signal", True, details)
            
        except Exception as e:
            return self.log_test("Current Signal", False, f"Error: {str(e)}")

    def test_market_data(self):
        """Test market data endpoint"""
        try:
            response = requests.get(f"{self.api_url}/market/bts-data", timeout=10)
            
            if response.status_code != 200:
                return self.log_test("Market Data", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            # Validate required fields
            required_fields = ['pair', 'price', 'volume', 'price_change_24h']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return self.log_test("Market Data", False, f"Missing fields: {missing_fields}")
            
            # Validate values
            if data['pair'] != 'BTS/USDT':
                return self.log_test("Market Data", False, f"Wrong pair: {data['pair']}")
            
            if data['price'] <= 0:
                return self.log_test("Market Data", False, f"Invalid price: {data['price']}")
            
            if data['volume'] <= 0:
                return self.log_test("Market Data", False, f"Invalid volume: {data['volume']}")
            
            details = f"Price: ${data['price']:.6f}, Volume: {data['volume']:,.0f}, 24h: {data['price_change_24h']:+.2f}%"
            return self.log_test("Market Data", True, details)
            
        except Exception as e:
            return self.log_test("Market Data", False, f"Error: {str(e)}")

    def test_trading_signals_history(self):
        """Test trading signals history endpoint"""
        try:
            response = requests.get(f"{self.api_url}/trading/signals?limit=10", timeout=10)
            
            if response.status_code != 200:
                return self.log_test("Trading History", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            if 'signals' not in data:
                return self.log_test("Trading History", False, "Missing 'signals' field")
            
            signals = data['signals']
            details = f"Retrieved {len(signals)} signals"
            
            # If we have signals, validate structure
            if signals:
                first_signal = signals[0]
                required_fields = ['id', 'pair', 'signal', 'confidence', 'entry_price']
                missing_fields = [field for field in required_fields if field not in first_signal]
                
                if missing_fields:
                    return self.log_test("Trading History", False, f"Missing signal fields: {missing_fields}")
                
                details += f", Latest: {first_signal['signal']} at ${first_signal['entry_price']:.6f}"
            
            return self.log_test("Trading History", True, details)
            
        except Exception as e:
            return self.log_test("Trading History", False, f"Error: {str(e)}")

    def test_performance_metrics(self):
        """Test performance metrics endpoint"""
        try:
            response = requests.get(f"{self.api_url}/trading/performance", timeout=10)
            
            if response.status_code != 200:
                return self.log_test("Performance Metrics", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            # Validate required fields
            required_fields = ['total_trades', 'success_rate', 'avg_profit_loss']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return self.log_test("Performance Metrics", False, f"Missing fields: {missing_fields}")
            
            # Validate values
            if not isinstance(data['total_trades'], int) or data['total_trades'] < 0:
                return self.log_test("Performance Metrics", False, f"Invalid total_trades: {data['total_trades']}")
            
            if not isinstance(data['success_rate'], (int, float)) or not (0 <= data['success_rate'] <= 100):
                return self.log_test("Performance Metrics", False, f"Invalid success_rate: {data['success_rate']}")
            
            details = f"Trades: {data['total_trades']}, Success: {data['success_rate']:.1f}%, Avg P&L: {data['avg_profit_loss']:.2f}%"
            return self.log_test("Performance Metrics", True, details)
            
        except Exception as e:
            return self.log_test("Performance Metrics", False, f"Error: {str(e)}")

    def test_error_analysis(self):
        """Test error analysis endpoint"""
        try:
            response = requests.get(f"{self.api_url}/trading/errors?limit=5", timeout=10)
            
            if response.status_code != 200:
                return self.log_test("Error Analysis", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            if 'errors' not in data:
                return self.log_test("Error Analysis", False, "Missing 'errors' field")
            
            errors = data['errors']
            details = f"Retrieved {len(errors)} error analyses"
            
            # If we have errors, validate structure
            if errors:
                first_error = errors[0]
                required_fields = ['id', 'error_type', 'predicted', 'actual']
                missing_fields = [field for field in required_fields if field not in first_error]
                
                if missing_fields:
                    return self.log_test("Error Analysis", False, f"Missing error fields: {missing_fields}")
                
                details += f", Latest: {first_error['error_type']}"
            
            return self.log_test("Error Analysis", True, details)
            
        except Exception as e:
            return self.log_test("Error Analysis", False, f"Error: {str(e)}")

    def test_trade_result_submission(self):
        """Test trade result submission endpoint"""
        try:
            if not self.current_signal_id:
                return self.log_test("Trade Result Submission", False, "No signal ID available")
            
            # Create a test trade result
            trade_result = {
                "signal_id": self.current_signal_id,
                "entry_price": 0.0458,
                "exit_price": 0.0470,
                "profit_loss_pct": 2.62,
                "success": True,
                "exit_reason": "test_trade"
            }
            
            response = requests.post(
                f"{self.api_url}/trading/trade-result", 
                json=trade_result,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code not in [200, 201]:
                return self.log_test("Trade Result Submission", False, f"Status: {response.status_code}")
            
            data = response.json()
            
            if not data.get('success'):
                return self.log_test("Trade Result Submission", False, f"Response: {data}")
            
            details = f"Submitted test trade: +2.62% profit"
            return self.log_test("Trade Result Submission", True, details)
            
        except Exception as e:
            return self.log_test("Trade Result Submission", False, f"Error: {str(e)}")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Message: {data.get('message', 'N/A')}"
                return self.log_test("Root Endpoint", True, details)
            else:
                return self.log_test("Root Endpoint", False, f"Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Root Endpoint", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting BTS/USDT Trading AI Backend Tests")
        print(f"🌐 Testing URL: {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity
        self.test_root_endpoint()
        self.test_health_check()
        
        # Test core trading functionality
        self.test_current_signal()
        self.test_market_data()
        self.test_trading_signals_history()
        self.test_performance_metrics()
        self.test_error_analysis()
        
        # Test data submission
        self.test_trade_result_submission()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY:")
        print(f"✅ Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Failed: {self.tests_run - self.tests_passed}/{self.tests_run}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED! Backend is working correctly.")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    """Main test execution"""
    tester = TradingAITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())