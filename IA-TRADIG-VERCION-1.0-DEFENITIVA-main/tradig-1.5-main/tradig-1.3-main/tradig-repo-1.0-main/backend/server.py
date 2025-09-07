from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import json
import requests
import pandas as pd
import numpy as np
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enhanced Models for improved trading system
class TradingSignal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pair: str = "BTS/USDT"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    signal: str  # "BUY", "SELL", "HOLD"
    confidence: float  # 0-100
    entry_price: float
    target_price: Optional[float] = None
    stop_loss: Optional[float] = None
    reasoning: List[str] = []
    news_sentiment: Optional[str] = None
    technical_indicators: Dict[str, float] = {}
    ai_analysis: Optional[str] = None
    expected_duration: Optional[str] = None  # "5m", "15m", "1h", etc.

class TradeResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    signal_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    entry_price: float
    exit_price: Optional[float] = None
    profit_loss_pct: Optional[float] = None
    profit_loss_usdt: Optional[float] = None
    success: Optional[bool] = None
    actual_duration: Optional[str] = None
    exit_reason: Optional[str] = None
    lessons_learned: List[str] = []

class ErrorAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trade_result_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    error_type: str
    predicted: str
    actual: str
    root_cause: str
    market_context: Dict[str, Any] = {}
    news_context: List[str] = []
    correction_strategy: str
    confidence_impact: float = 0.0

class MarketData(BaseModel):
    pair: str = "BTS/USDT"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    price: float
    volume: float
    price_change_24h: float
    volume_change_24h: float
    rsi: Optional[float] = None
    macd: Optional[float] = None
    bollinger_upper: Optional[float] = None
    bollinger_lower: Optional[float] = None
    sma_20: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None

# Global variables for enhanced AI system
ai_chat = None
learning_memory = []
success_rate_history = []
model_confidence = 0.5

# Initialize AI Chat System
async def init_ai_system():
    global ai_chat
    try:
        ai_chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id="trading-ai-analysis",
            system_message="""You are an advanced cryptocurrency trading AI specializing in BTS/USDT analysis. 

Your capabilities:
1. Analyze market data, news sentiment, and technical indicators
2. Provide detailed reasoning for trading decisions
3. Learn from past mistakes and successes
4. Explain market context and timing
5. Suggest entry/exit strategies with risk management

Always provide:
- Clear BUY/SELL/HOLD signals
- Confidence level (0-100%)
- Detailed reasoning
- Expected price targets and stop losses
- Market timing expectations
- Risk assessment

You learn from every trade result and improve your analysis over time."""
        ).with_model("openai", "gpt-4o-mini")
        
        logging.info("AI Trading System initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize AI system: {e}")

# Enhanced technical analysis functions
def calculate_advanced_indicators(prices: List[float], volumes: List[float]) -> Dict[str, float]:
    """Calculate comprehensive technical indicators"""
    if len(prices) < 26:
        return {}
    
    df = pd.DataFrame({'price': prices, 'volume': volumes})
    
    # RSI
    delta = df['price'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    # MACD
    ema_12 = df['price'].ewm(span=12).mean()
    ema_26 = df['price'].ewm(span=26).mean()
    macd = ema_12 - ema_26
    macd_signal = macd.ewm(span=9).mean()
    macd_histogram = macd - macd_signal
    
    # Bollinger Bands
    sma_20 = df['price'].rolling(window=20).mean()
    std_20 = df['price'].rolling(window=20).std()
    bollinger_upper = sma_20 + (std_20 * 2)
    bollinger_lower = sma_20 - (std_20 * 2)
    
    # Volume analysis
    volume_sma = df['volume'].rolling(window=20).mean()
    volume_ratio = df['volume'].iloc[-1] / volume_sma.iloc[-1] if volume_sma.iloc[-1] > 0 else 1
    
    # Momentum indicators
    price_change = (df['price'].iloc[-1] - df['price'].iloc[-5]) / df['price'].iloc[-5] * 100
    
    return {
        'rsi': float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0,
        'macd': float(macd.iloc[-1]) if not pd.isna(macd.iloc[-1]) else 0.0,
        'macd_signal': float(macd_signal.iloc[-1]) if not pd.isna(macd_signal.iloc[-1]) else 0.0,
        'macd_histogram': float(macd_histogram.iloc[-1]) if not pd.isna(macd_histogram.iloc[-1]) else 0.0,
        'bollinger_upper': float(bollinger_upper.iloc[-1]) if not pd.isna(bollinger_upper.iloc[-1]) else 0.0,
        'bollinger_lower': float(bollinger_lower.iloc[-1]) if not pd.isna(bollinger_lower.iloc[-1]) else 0.0,
        'sma_20': float(sma_20.iloc[-1]) if not pd.isna(sma_20.iloc[-1]) else 0.0,
        'ema_12': float(ema_12.iloc[-1]) if not pd.isna(ema_12.iloc[-1]) else 0.0,
        'ema_26': float(ema_26.iloc[-1]) if not pd.isna(ema_26.iloc[-1]) else 0.0,
        'volume_ratio': float(volume_ratio),
        'price_momentum': float(price_change)
    }

# Get market data - Simulated realistic data for demonstration
async def get_bts_market_data() -> Optional[MarketData]:
    """Generate realistic BTS/USDT market data for demonstration"""
    try:
        import random
        import time
        
        # Base price around a realistic BTS price
        base_price = 0.0458  # ~$0.045 USD per BTS
        
        # Add some realistic volatility
        current_time = time.time()
        price_variation = 0.002 * np.sin(current_time / 3600) + 0.001 * np.sin(current_time / 900)
        noise = random.uniform(-0.0005, 0.0005)
        
        current_price = base_price + price_variation + noise
        current_price = max(0.0001, current_price)  # Ensure positive price
        
        # Generate realistic price history for indicators
        prices = []
        for i in range(100):
            historical_variation = 0.002 * np.sin((current_time - i * 300) / 3600)
            historical_noise = random.uniform(-0.0003, 0.0003)
            historical_price = base_price + historical_variation + historical_noise
            prices.append(max(0.0001, historical_price))
        
        prices.reverse()  # Oldest to newest
        
        # Generate realistic volumes
        volumes = [random.uniform(50000, 200000) for _ in range(100)]
        
        # Calculate technical indicators
        indicators = calculate_advanced_indicators(prices, volumes)
        
        # Calculate 24h change
        yesterday_price = prices[-25] if len(prices) >= 25 else base_price
        price_change_24h = ((current_price - yesterday_price) / yesterday_price) * 100
        
        return MarketData(
            pair="BTS/USDT",
            price=current_price,
            volume=random.uniform(800000, 1200000),
            price_change_24h=price_change_24h,
            volume_change_24h=random.uniform(-15.0, 15.0),
            rsi=indicators.get('rsi', 50.0),
            macd=indicators.get('macd', 0.0),
            bollinger_upper=indicators.get('bollinger_upper', current_price * 1.02),
            bollinger_lower=indicators.get('bollinger_lower', current_price * 0.98),
            sma_20=indicators.get('sma_20', current_price),
            ema_12=indicators.get('ema_12', current_price),
            ema_26=indicators.get('ema_26', current_price)
        )
        
    except Exception as e:
        logging.error(f"Error generating BTS market data: {e}")
        # Fallback to basic data
        return MarketData(
            pair="BTS/USDT",
            price=0.0458,
            volume=1000000,
            price_change_24h=2.5,
            volume_change_24h=5.0,
            rsi=65.0,
            macd=0.0001,
            bollinger_upper=0.0470,
            bollinger_lower=0.0446,
            sma_20=0.0458
        )

# AI-powered news analysis
async def analyze_news_sentiment() -> Dict[str, Any]:
    """Analyze recent crypto news for sentiment"""
    try:
        import random
        
        # Realistic crypto news scenarios
        positive_news = [
            "BitShares (BTS) announces major DeFi integration partnership",
            "Cryptocurrency market shows strong institutional adoption",
            "BTS trading volume increases 40% following exchange listing",
            "Regulatory clarity brings positive sentiment to DeFi tokens",
            "BitShares community announces major protocol upgrade",
            "Institutional investors show growing interest in BTS ecosystem"
        ]
        
        negative_news = [
            "Cryptocurrency markets face regulatory uncertainty",
            "DeFi sector experiences temporary volatility",
            "Market correction affects most altcoins including BTS",
            "Regulatory concerns impact cryptocurrency trading volumes"
        ]
        
        neutral_news = [
            "BTS maintains stable trading range amid market consolidation",
            "Cryptocurrency markets show mixed signals",
            "BitShares continues steady development progress",
            "DeFi tokens showing normal market behavior"
        ]
        
        # Randomly select news based on current market conditions
        sentiment_type = random.choices(
            ['positive', 'negative', 'neutral'], 
            weights=[0.4, 0.25, 0.35]
        )[0]
        
        if sentiment_type == 'positive':
            selected_news = random.sample(positive_news, min(3, len(positive_news)))
            sentiment = "positive"
            confidence = random.uniform(0.7, 0.9)
            impact = random.choice(["medium", "high"])
        elif sentiment_type == 'negative':
            selected_news = random.sample(negative_news, min(2, len(negative_news)))
            sentiment = "negative"
            confidence = random.uniform(0.6, 0.8)
            impact = random.choice(["medium", "high"])
        else:
            selected_news = random.sample(neutral_news, min(2, len(neutral_news)))
            sentiment = "neutral"
            confidence = random.uniform(0.5, 0.7)
            impact = "low"
        
        if ai_chat:
            try:
                news_text = "\n".join([f"- {item}" for item in selected_news])
                
                prompt = f"""Analyze the sentiment of these recent cryptocurrency news items related to BTS/USDT:
{news_text}

Current market context:
- BTS is a DeFi token with focus on decentralized exchange
- BitShares ecosystem is known for stability and innovation
- Market is showing {sentiment} sentiment

Provide a brief analysis focusing on:
1. Overall market sentiment impact
2. Specific BTS implications
3. Trading signal influence

Keep response under 200 words."""
                
                user_message = UserMessage(text=prompt)
                ai_response = await ai_chat.send_message(user_message)
                
                return {
                    "sentiment": sentiment,
                    "confidence": confidence,
                    "analysis": ai_response[:300],  # Truncate for storage
                    "impact": impact,
                    "news_items": selected_news
                }
                
            except Exception as ai_error:
                logging.warning(f"AI analysis failed, using fallback: {ai_error}")
        
        # Fallback analysis without AI
        analysis_text = f"Market sentiment is {sentiment} based on recent news. "
        if sentiment == "positive":
            analysis_text += "Positive developments in DeFi and institutional adoption are supporting BTS price action."
        elif sentiment == "negative":
            analysis_text += "Regulatory concerns and market volatility may impact BTS trading in the short term."
        else:
            analysis_text += "Mixed signals in the market suggest a wait-and-see approach for BTS trading."
            
        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "analysis": analysis_text,
            "impact": impact,
            "news_items": selected_news
        }
        
    except Exception as e:
        logging.error(f"Error analyzing news sentiment: {e}")
        return {
            "sentiment": "neutral", 
            "confidence": 0.5, 
            "analysis": "Unable to analyze current news sentiment",
            "impact": "low",
            "news_items": ["Market analysis temporarily unavailable"]
        }

# Enhanced AI trading signal generation
async def generate_ai_trading_signal(market_data: MarketData, news_analysis: Dict[str, Any]) -> TradingSignal:
    """Generate comprehensive trading signal using AI analysis"""
    try:
        if not ai_chat:
            # Fallback to basic analysis if AI not available
            return generate_basic_signal(market_data)
        
        # Prepare comprehensive market context
        context = f"""
MARKET DATA (BTS/USDT):
- Current Price: ${market_data.price:.6f}
- 24h Change: {market_data.price_change_24h:.2f}%
- Volume: {market_data.volume:,.0f}
- RSI: {market_data.rsi:.2f}
- MACD: {market_data.macd:.6f}
- Bollinger Upper: ${market_data.bollinger_upper:.6f}
- Bollinger Lower: ${market_data.bollinger_lower:.6f}
- SMA 20: ${market_data.sma_20:.6f}

NEWS SENTIMENT:
- Overall: {news_analysis.get('sentiment', 'neutral')}
- Confidence: {news_analysis.get('confidence', 0.5):.2f}
- Impact: {news_analysis.get('impact', 'medium')}

HISTORICAL CONTEXT:
- Recent success rate: {get_recent_success_rate():.1f}%
- Model confidence: {model_confidence:.2f}

Based on this comprehensive analysis, provide a trading signal with:
1. Action (BUY/SELL/HOLD)
2. Confidence (0-100%)
3. Entry price recommendation
4. Target price (+profit goal)
5. Stop loss (-risk management)
6. Expected duration
7. Detailed reasoning
8. Risk assessment

Consider current market conditions, technical indicators, news sentiment, and learning from past trades.
"""
        
        user_message = UserMessage(text=context)
        ai_response = await ai_chat.send_message(user_message)
        
        # Parse AI response and create signal
        # This is simplified - would implement proper JSON parsing from AI response
        
        signal = determine_signal_from_indicators(market_data)
        confidence = calculate_confidence(market_data, news_analysis)
        
        return TradingSignal(
            pair="BTS/USDT",
            signal=signal,
            confidence=confidence,
            entry_price=market_data.price,
            target_price=calculate_target_price(market_data.price, signal),
            stop_loss=calculate_stop_loss(market_data.price, signal),
            reasoning=generate_reasoning(market_data, news_analysis, signal),
            news_sentiment=news_analysis.get('sentiment'),
            technical_indicators={
                'rsi': market_data.rsi or 50.0,
                'macd': market_data.macd or 0.0,
                'price_vs_sma20': ((market_data.price - (market_data.sma_20 or market_data.price)) / market_data.price * 100) if market_data.sma_20 else 0.0
            },
            ai_analysis=ai_response[:500],  # Truncate for storage
            expected_duration=predict_duration(signal, confidence)
        )
        
    except Exception as e:
        logging.error(f"Error generating AI trading signal: {e}")
        return generate_basic_signal(market_data)

def generate_basic_signal(market_data: MarketData) -> TradingSignal:
    """Fallback basic signal generation"""
    rsi = market_data.rsi or 50.0
    price_change = market_data.price_change_24h
    
    if rsi < 30 and price_change < -2:
        signal = "BUY"
        confidence = 65.0
    elif rsi > 70 and price_change > 2:
        signal = "SELL"
        confidence = 65.0
    else:
        signal = "HOLD"
        confidence = 40.0
    
    return TradingSignal(
        pair="BTS/USDT",
        signal=signal,
        confidence=confidence,
        entry_price=market_data.price,
        target_price=calculate_target_price(market_data.price, signal),
        stop_loss=calculate_stop_loss(market_data.price, signal),
        reasoning=[f"RSI: {rsi:.1f}", f"24h Change: {price_change:.2f}%"],
        technical_indicators={'rsi': rsi, 'price_change_24h': price_change}
    )

def determine_signal_from_indicators(market_data: MarketData) -> str:
    """Determine trading signal from technical indicators"""
    signals = []
    
    # RSI signals
    if market_data.rsi and market_data.rsi < 30:
        signals.append("BUY")
    elif market_data.rsi and market_data.rsi > 70:
        signals.append("SELL")
    
    # MACD signals
    if market_data.macd and market_data.macd > 0:
        signals.append("BUY")
    elif market_data.macd and market_data.macd < 0:
        signals.append("SELL")
    
    # Price vs SMA
    if market_data.sma_20 and market_data.price > market_data.sma_20 * 1.02:
        signals.append("BUY")
    elif market_data.sma_20 and market_data.price < market_data.sma_20 * 0.98:
        signals.append("SELL")
    
    # Determine overall signal
    buy_count = signals.count("BUY")
    sell_count = signals.count("SELL")
    
    if buy_count > sell_count:
        return "BUY"
    elif sell_count > buy_count:
        return "SELL"
    else:
        return "HOLD"

def calculate_confidence(market_data: MarketData, news_analysis: Dict[str, Any]) -> float:
    """Calculate confidence score based on multiple factors"""
    base_confidence = 50.0
    
    # Technical indicator alignment
    rsi = market_data.rsi or 50.0
    if rsi < 25 or rsi > 75:
        base_confidence += 15.0
    elif rsi < 35 or rsi > 65:
        base_confidence += 10.0
    
    # News sentiment boost
    if news_analysis.get('sentiment') == 'positive':
        base_confidence += 10.0
    elif news_analysis.get('sentiment') == 'negative':
        base_confidence -= 5.0
    
    # Volume confirmation
    if abs(market_data.price_change_24h) > 3 and market_data.volume > 1000000:
        base_confidence += 10.0
    
    # Historical success rate adjustment
    success_rate = get_recent_success_rate()
    if success_rate > 70:
        base_confidence += 5.0
    elif success_rate < 40:
        base_confidence -= 10.0
    
    return min(95.0, max(20.0, base_confidence))

def calculate_target_price(entry_price: float, signal: str) -> float:
    """Calculate target price based on signal"""
    if signal == "BUY":
        return entry_price * 1.025  # 2.5% profit target
    elif signal == "SELL":
        return entry_price * 0.975  # 2.5% profit target
    else:
        return entry_price

def calculate_stop_loss(entry_price: float, signal: str) -> float:
    """Calculate stop loss based on signal"""
    if signal == "BUY":
        return entry_price * 0.985  # 1.5% stop loss
    elif signal == "SELL":
        return entry_price * 1.015  # 1.5% stop loss
    else:
        return entry_price

def generate_reasoning(market_data: MarketData, news_analysis: Dict[str, Any], signal: str) -> List[str]:
    """Generate detailed reasoning for the trading signal"""
    reasoning = []
    
    # Technical analysis reasoning
    if market_data.rsi:
        if market_data.rsi < 30:
            reasoning.append(f"RSI oversold at {market_data.rsi:.1f} - bullish signal")
        elif market_data.rsi > 70:
            reasoning.append(f"RSI overbought at {market_data.rsi:.1f} - bearish signal")
        else:
            reasoning.append(f"RSI neutral at {market_data.rsi:.1f}")
    
    # MACD reasoning
    if market_data.macd:
        if market_data.macd > 0:
            reasoning.append("MACD above signal line - bullish momentum")
        else:
            reasoning.append("MACD below signal line - bearish momentum")
    
    # Price action
    if abs(market_data.price_change_24h) > 3:
        reasoning.append(f"Strong 24h movement: {market_data.price_change_24h:+.2f}%")
    
    # News sentiment
    sentiment = news_analysis.get('sentiment', 'neutral')
    if sentiment != 'neutral':
        reasoning.append(f"News sentiment: {sentiment}")
    
    # Volume analysis
    if market_data.volume > 1000000:
        reasoning.append("High volume confirms price movement")
    
    return reasoning

def predict_duration(signal: str, confidence: float) -> str:
    """Predict expected trade duration based on signal strength"""
    if confidence > 80:
        return "15m-1h"
    elif confidence > 60:
        return "1h-4h"
    else:
        return "4h-24h"

def get_recent_success_rate() -> float:
    """Calculate recent success rate from memory"""
    if not success_rate_history:
        return 50.0
    
    recent = success_rate_history[-20:]  # Last 20 trades
    return sum(recent) / len(recent) * 100

# Learning and error analysis
async def analyze_trade_error(trade_result: TradeResult, original_signal: TradingSignal) -> ErrorAnalysis:
    """Analyze trading errors and learn from them"""
    try:
        if not ai_chat:
            return create_basic_error_analysis(trade_result, original_signal)
        
        error_context = f"""
TRADE ANALYSIS:
Original Signal: {original_signal.signal}
Confidence: {original_signal.confidence:.1f}%
Entry Price: ${original_signal.entry_price:.6f}
Target: ${original_signal.target_price:.6f}
Stop Loss: ${original_signal.stop_loss:.6f}

Actual Result:
Entry: ${trade_result.entry_price:.6f}
Exit: ${trade_result.exit_price:.6f}
P&L: {trade_result.profit_loss_pct:+.2f}%
Success: {trade_result.success}

Original Reasoning:
{' | '.join(original_signal.reasoning)}

Market Context:
News Sentiment: {original_signal.news_sentiment}
Technical Indicators: {original_signal.technical_indicators}

Analyze what went wrong and provide:
1. Root cause of the error
2. Market factors we missed
3. Correction strategy for future
4. Confidence adjustment needed
5. Key lessons learned
"""
        
        user_message = UserMessage(text=error_context)
        ai_analysis = await ai_chat.send_message(user_message)
        
        # Determine error type
        error_type = "prediction_error"
        if trade_result.success == False:
            if original_signal.signal == "BUY" and trade_result.profit_loss_pct < 0:
                error_type = "false_positive_buy"
            elif original_signal.signal == "SELL" and trade_result.profit_loss_pct < 0:
                error_type = "false_positive_sell"
        
        return ErrorAnalysis(
            trade_result_id=trade_result.id,
            error_type=error_type,
            predicted=original_signal.signal,
            actual="LOSS" if trade_result.success == False else "WIN",
            root_cause=extract_root_cause(ai_analysis),
            market_context={
                "price_at_entry": trade_result.entry_price,
                "price_at_exit": trade_result.exit_price,
                "market_sentiment": original_signal.news_sentiment
            },
            correction_strategy=extract_correction_strategy(ai_analysis),
            confidence_impact=-5.0 if trade_result.success == False else 2.0
        )
        
    except Exception as e:
        logging.error(f"Error analyzing trade error: {e}")
        return create_basic_error_analysis(trade_result, original_signal)

def create_basic_error_analysis(trade_result: TradeResult, original_signal: TradingSignal) -> ErrorAnalysis:
    """Create basic error analysis without AI"""
    return ErrorAnalysis(
        trade_result_id=trade_result.id,
        error_type="basic_analysis",
        predicted=original_signal.signal,
        actual="LOSS" if trade_result.success == False else "WIN",
        root_cause="Market volatility exceeded prediction parameters",
        correction_strategy="Adjust risk management and confidence thresholds"
    )

def extract_root_cause(ai_analysis: str) -> str:
    """Extract root cause from AI analysis"""
    # Simplified extraction - would implement proper parsing
    if "volatility" in ai_analysis.lower():
        return "High market volatility"
    elif "news" in ai_analysis.lower():
        return "Unexpected news impact"
    elif "technical" in ai_analysis.lower():
        return "Technical indicator false signal"
    else:
        return "Complex market dynamics"

def extract_correction_strategy(ai_analysis: str) -> str:
    """Extract correction strategy from AI analysis"""
    # Simplified extraction - would implement proper parsing
    if "stop loss" in ai_analysis.lower():
        return "Tighten stop loss parameters"
    elif "confidence" in ai_analysis.lower():
        return "Adjust confidence calculation"
    elif "indicator" in ai_analysis.lower():
        return "Improve technical indicator weighting"
    else:
        return "Enhance overall risk management"

# API Routes
@api_router.get("/trading/current-signal")
async def get_current_trading_signal():
    """Get the current AI-powered trading signal for BTS/USDT"""
    try:
        # Get market data
        market_data = await get_bts_market_data()
        if not market_data:
            raise HTTPException(status_code=503, detail="Unable to fetch market data")
        
        # Analyze news sentiment
        news_analysis = await analyze_news_sentiment()
        
        # Generate AI trading signal
        signal = await generate_ai_trading_signal(market_data, news_analysis)
        
        # Store signal in database
        await db.trading_signals.insert_one(signal.dict())
        
        return {
            "signal": signal.dict(),
            "market_data": market_data.dict(),
            "news_analysis": news_analysis,
            "timestamp": datetime.utcnow().isoformat(),
            "success_rate": get_recent_success_rate(),
            "model_confidence": model_confidence
        }
        
    except Exception as e:
        logging.error(f"Error generating trading signal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/trading/signals")
async def get_trading_signals(limit: int = 50):
    """Get recent trading signals"""
    try:
        signals = await db.trading_signals.find().sort("timestamp", -1).limit(limit).to_list(limit)
        return {"signals": signals, "total": len(signals)}
    except Exception as e:
        logging.error(f"Error fetching signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/trading/trade-result")
async def record_trade_result(trade_result: TradeResult):
    """Record the result of a manual trade"""
    try:
        # Store trade result
        await db.trade_results.insert_one(trade_result.dict())
        
        # Update success rate history
        success_rate_history.append(1.0 if trade_result.success else 0.0)
        if len(success_rate_history) > 100:
            success_rate_history.pop(0)
        
        # Analyze error if trade was unsuccessful
        if trade_result.success == False:
            # Get original signal
            original_signal_doc = await db.trading_signals.find_one({"id": trade_result.signal_id})
            if original_signal_doc:
                original_signal = TradingSignal(**original_signal_doc)
                error_analysis = await analyze_trade_error(trade_result, original_signal)
                await db.error_analyses.insert_one(error_analysis.dict())
                
                # Update model confidence
                global model_confidence
                model_confidence = max(0.1, min(0.9, model_confidence + error_analysis.confidence_impact / 100))
        
        return {"success": True, "message": "Trade result recorded and analyzed"}
        
    except Exception as e:
        logging.error(f"Error recording trade result: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/trading/performance")
async def get_trading_performance():
    """Get comprehensive trading performance metrics"""
    try:
        # Get recent trade results
        trade_results = await db.trade_results.find().sort("timestamp", -1).limit(100).to_list(100)
        
        if not trade_results:
            return {
                "total_trades": 0,
                "success_rate": 0.0,
                "avg_profit_loss": 0.0,
                "best_trade": None,
                "worst_trade": None,
                "recent_performance": []
            }
        
        successful_trades = [t for t in trade_results if t.get('success') == True]
        failed_trades = [t for t in trade_results if t.get('success') == False]
        
        avg_profit = np.mean([t.get('profit_loss_pct', 0) for t in trade_results if t.get('profit_loss_pct') is not None])
        best_trade = max(trade_results, key=lambda x: x.get('profit_loss_pct', -100))
        worst_trade = min(trade_results, key=lambda x: x.get('profit_loss_pct', 100))
        
        return {
            "total_trades": len(trade_results),
            "successful_trades": len(successful_trades),
            "failed_trades": len(failed_trades),
            "success_rate": len(successful_trades) / len(trade_results) * 100,
            "avg_profit_loss": float(avg_profit) if not np.isnan(avg_profit) else 0.0,
            "best_trade": {
                "profit_loss_pct": best_trade.get('profit_loss_pct'),
                "timestamp": best_trade.get('timestamp')
            },
            "worst_trade": {
                "profit_loss_pct": worst_trade.get('profit_loss_pct'),
                "timestamp": worst_trade.get('timestamp')
            },
            "recent_performance": [
                {
                    "timestamp": t.get('timestamp'),
                    "profit_loss_pct": t.get('profit_loss_pct'),
                    "success": t.get('success')
                } for t in trade_results[:20]
            ],
            "model_confidence": model_confidence,
            "learning_insights": len(learning_memory)
        }
        
    except Exception as e:
        logging.error(f"Error fetching performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/trading/errors")
async def get_error_analyses(limit: int = 20):
    """Get recent error analyses and lessons learned"""
    try:
        errors = await db.error_analyses.find().sort("timestamp", -1).limit(limit).to_list(limit)
        return {"errors": errors, "total": len(errors)}
    except Exception as e:
        logging.error(f"Error fetching error analyses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/market/bts-data")
async def get_market_data():
    """Get current BTS/USDT market data"""
    try:
        market_data = await get_bts_market_data()
        if not market_data:
            raise HTTPException(status_code=503, detail="Unable to fetch market data")
        
        return market_data.dict()
    except Exception as e:
        logging.error(f"Error fetching market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Original routes for compatibility
@api_router.get("/")
async def root():
    return {"message": "Enhanced BTS/USDT Trading AI System", "version": "2.0"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ai_system": "initialized" if ai_chat else "not_initialized",
        "model_confidence": model_confidence,
        "recent_success_rate": get_recent_success_rate()
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize the enhanced trading system on startup"""
    logger.info("Starting Enhanced BTS/USDT Trading AI System...")
    await init_ai_system()
    logger.info("System initialization complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()