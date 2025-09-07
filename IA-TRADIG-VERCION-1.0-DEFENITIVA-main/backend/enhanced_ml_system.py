"""
Sistema de Machine Learning Avanzado para TradingAI Pro
Sistema inteligente que aprende de errores y optimiza predicciones para alcanzar 90% éxito
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import joblib
import os
from collections import deque
import random

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnhancedMLSystem:
    """Sistema de Machine Learning Avanzado con aprendizaje automático de errores"""
    
    def __init__(self, db_client):
        self.db = db_client.tradingai
        self.models = {}
        self.scalers = {}
        self.is_trained = False
        self.feature_names = []
        self.prediction_history = deque(maxlen=1000)
        self.learning_queue = deque(maxlen=500)
        self.model_accuracy = {}
        
        # Configuración de modelos
        self.model_configs = {
            'random_forest': RandomForestClassifier(
                n_estimators=200,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            ),
            'gradient_boost': GradientBoostingClassifier(
                n_estimators=150,
                learning_rate=0.1,
                max_depth=8,
                random_state=42
            )
        }
        
        # Umbral de confianza para predicciones
        self.confidence_threshold = 0.6
        self.target_accuracy = 0.9  # 90% objetivo
        
        # Métricas de aprendizaje
        self.prediction_stats = {
            'total_predictions': 0,
            'correct_predictions': 0,
            'labeled_predictions': 0,
            'recent_accuracy': 0.0,
            'model_updates': 0
        }
    
    def extract_features(self, technical_analysis: Dict) -> np.ndarray:
        """Extraer características para ML desde análisis técnico"""
        try:
            features = []
            
            # Indicadores técnicos principales
            features.append(technical_analysis.get('rsi', 50) / 100)  # Normalizar RSI
            
            # MACD features
            macd = technical_analysis.get('macd', {})
            features.extend([
                macd.get('macd', 0) / 1000,  # Normalizar MACD
                macd.get('signal', 0) / 1000,
                macd.get('histogram', 0) / 1000
            ])
            
            # Bollinger Bands
            bollinger = technical_analysis.get('bollinger', {})
            features.append(bollinger.get('position', 0.5))
            
            # EMAs
            emas = technical_analysis.get('emas', {})
            features.extend([
                1 if emas.get('crossover', False) else 0,
                1 if emas.get('golden_cross', False) else 0,
                1 if emas.get('death_cross', False) else 0
            ])
            
            # Stochastic
            stoch = technical_analysis.get('stochastic', {})
            features.extend([
                stoch.get('k', 50) / 100,
                stoch.get('d', 50) / 100
            ])
            
            # Volume análisis
            volume = technical_analysis.get('volume', {})
            features.extend([
                np.tanh(volume.get('volume_strength', 0) / 100),  # Normalizar con tanh
                np.tanh(volume.get('volume_trend', 0) / 100)
            ])
            
            # Patterns (binary features)
            patterns = technical_analysis.get('patterns', {})
            features.extend([
                1 if patterns.get('hammer', False) else 0,
                1 if patterns.get('doji', False) else 0,
                1 if patterns.get('engulfing', False) else 0
            ])
            
            # Support/Resistance
            sr = technical_analysis.get('support_resistance', {})
            features.extend([
                np.tanh(sr.get('resistance_distance', 2) / 10),
                np.tanh(sr.get('support_distance', 2) / 10)
            ])
            
            # Señales agregadas
            signals = technical_analysis.get('signals', {})
            features.extend([
                np.tanh(signals.get('strength', 0) / 100),
                len(signals.get('bullish_signals', [])),
                len(signals.get('bearish_signals', []))
            ])
            
            # Features temporales
            now = datetime.utcnow()
            features.extend([
                now.hour / 24,  # Hora del día normalizada
                now.weekday() / 7  # Día de la semana normalizado
            ])
            
            # Asegurar que tenemos exactamente 20 features
            while len(features) < 20:
                features.append(0.0)
            
            features = features[:20]  # Truncar si hay más
            
            return np.array(features).reshape(1, -1)
            
        except Exception as e:
            logger.error(f"❌ Error extrayendo features: {e}")
            # Retornar features por defecto
            return np.zeros((1, 20))
    
    async def collect_training_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Recolectar datos de entrenamiento desde simulaciones cerradas"""
        try:
            # Obtener simulaciones cerradas con datos técnicos
            simulations = await self.db.enhanced_simulations.find({
                "closed": True,
                "technical_analysis": {"$exists": True, "$ne": None}
            }).limit(500).to_list(length=None)
            
            if len(simulations) < 10:
                logger.warning("❌ Datos insuficientes para entrenamiento ML")
                return None, None
            
            X_data = []
            y_data = []
            
            for sim in simulations:
                try:
                    # Extraer features
                    features = self.extract_features(sim['technical_analysis'])
                    
                    # Label: 1 si fue exitosa, 0 si no
                    label = 1 if sim.get('success', False) else 0
                    
                    X_data.append(features.flatten())
                    y_data.append(label)
                    
                except Exception as e:
                    continue
            
            if len(X_data) < 10:
                logger.warning("❌ No se pudieron procesar suficientes datos")
                return None, None
            
            X = np.array(X_data)
            y = np.array(y_data)
            
            logger.info(f"✅ Datos de entrenamiento recolectados: {len(X)} muestras")
            logger.info(f"📊 Distribución: {np.sum(y)} éxitos, {len(y) - np.sum(y)} fallos")
            
            return X, y
            
        except Exception as e:
            logger.error(f"❌ Error recolectando datos de entrenamiento: {e}")
            return None, None
    
    async def train_models(self, X: np.ndarray, y: np.ndarray) -> bool:
        """Entrenar modelos de ML con validación cruzada"""
        try:
            # Dividir datos
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Escalar features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            self.scalers['primary'] = scaler
            
            # Entrenar modelos individuales
            trained_models = {}
            
            for name, model in self.model_configs.items():
                logger.info(f"🤖 Entrenando modelo {name}...")
                
                # Entrenar modelo
                model.fit(X_train_scaled, y_train)
                
                # Evaluar con validación cruzada
                cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='accuracy')
                
                # Evaluar en conjunto de prueba
                y_pred = model.predict(X_test_scaled)
                test_accuracy = accuracy_score(y_test, y_pred)
                
                # Guardar métricas
                self.model_accuracy[name] = {
                    'accuracy': test_accuracy,
                    'cv_mean': cv_scores.mean(),
                    'cv_std': cv_scores.std()
                }
                
                trained_models[name] = model
                
                logger.info(f"✅ {name}: Precisión test: {test_accuracy:.3f}, CV: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
            
            # Crear ensemble model
            ensemble = VotingClassifier([
                ('rf', trained_models['random_forest']),
                ('gb', trained_models['gradient_boost'])
            ], voting='soft')
            
            ensemble.fit(X_train_scaled, y_train)
            
            # Evaluar ensemble
            ensemble_pred = ensemble.predict(X_test_scaled)
            ensemble_accuracy = accuracy_score(y_test, ensemble_pred)
            
            logger.info(f"🎯 Ensemble accuracy: {ensemble_accuracy:.3f}")
            
            # Guardar modelos
            self.models = trained_models
            self.models['ensemble'] = ensemble
            self.model_accuracy['ensemble'] = {'accuracy': ensemble_accuracy}
            
            # Guardar feature names
            self.feature_names = [
                'RSI', 'MACD', 'MACD Signal', 'MACD Histogram', 'BB Position',
                'EMA Crossover', 'EMA Golden Cross', 'EMA Death Cross',
                'Stoch K', 'Stoch D', 'Volume Strength', 'Volume Trend',
                'Hammer Pattern', 'Doji Pattern', 'Engulfing Pattern',
                'Resistance Distance', 'Support Distance', 'Signal Strength',
                'Bullish Signals', 'Bearish Signals'
            ]
            
            self.is_trained = True
            self.prediction_stats['model_updates'] += 1
            
            logger.info("🚀 Modelos ML entrenados exitosamente!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error entrenando modelos: {e}")
            return False
    
    async def advanced_prediction(self, technical_analysis: Dict) -> Optional[Dict]:
        """Realizar predicción avanzada con ensemble de modelos"""
        try:
            if not self.is_trained or not self.models:
                logger.warning("❌ Modelos no entrenados, usando predicción básica")
                return await self.basic_prediction(technical_analysis)
            
            # Extraer features
            features = self.extract_features(technical_analysis)
            
            # Escalar features
            if 'primary' in self.scalers:
                features_scaled = self.scalers['primary'].transform(features)
            else:
                features_scaled = features
            
            # Predicciones de ensemble
            ensemble_pred = self.models['ensemble'].predict(features_scaled)[0]
            ensemble_proba = self.models['ensemble'].predict_proba(features_scaled)[0]
            
            # Predicciones individuales para análisis
            individual_predictions = {}
            for name, model in self.models.items():
                if name != 'ensemble':
                    pred = model.predict(features_scaled)[0]
                    proba = model.predict_proba(features_scaled)[0]
                    individual_predictions[name] = {
                        'prediction': pred,
                        'probability': proba.max()
                    }
            
            # Calcular confianza basada en consenso
            consensus = np.mean([pred['prediction'] for pred in individual_predictions.values()])
            confidence = ensemble_proba.max()
            
            # Ajustar confianza basada en consenso
            if abs(consensus - 0.5) > 0.2:  # Si hay consenso fuerte
                confidence = min(confidence * 1.1, 0.95)
            
            # Determinar predicción final
            prediction = 'UP' if ensemble_pred == 1 else 'DOWN'
            
            # Probabilidades
            prob_up = ensemble_proba[1] if len(ensemble_proba) > 1 else (1 - ensemble_proba[0])
            prob_down = 1 - prob_up
            
            # Generar razonamiento
            reasoning = self.generate_ml_reasoning(technical_analysis, individual_predictions)
            
            result = {
                'prediction': prediction,
                'confidence': float(confidence),
                'probability': {
                    'up': float(prob_up),
                    'down': float(prob_down)
                },
                'reasoning': reasoning,
                'model_details': {
                    'ensemble_method': 'Voting Classifier',
                    'individual_models': individual_predictions,
                    'consensus_score': float(consensus),
                    'feature_count': len(self.feature_names)
                },
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Actualizar estadísticas
            self.prediction_stats['total_predictions'] += 1
            
            # Guardar en historial
            self.prediction_history.append({
                'prediction': result,
                'technical_analysis': technical_analysis,
                'timestamp': datetime.utcnow()
            })
            
            logger.info(f"🤖 Predicción ML avanzada: {prediction} ({confidence:.2f} confianza)")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error en predicción avanzada: {e}")
            return await self.basic_prediction(technical_analysis)
    
    async def basic_prediction(self, technical_analysis: Dict) -> Dict:
        """Predicción básica basada en señales técnicas"""
        try:
            signals = technical_analysis.get('signals', {})
            strength = signals.get('strength', 0)
            
            # Determinar predicción basada en fuerza de señal
            prediction = 'UP' if strength > 0 else 'DOWN'
            
            # Calcular confianza basada en señales
            confidence = min(abs(strength) / 100, 0.8)
            confidence = max(confidence, 0.5)
            
            # Probabilidades
            if prediction == 'UP':
                prob_up = 0.5 + (confidence * 0.5)
                prob_down = 1 - prob_up
            else:
                prob_down = 0.5 + (confidence * 0.5)
                prob_up = 1 - prob_down
            
            return {
                'prediction': prediction,
                'confidence': confidence,
                'probability': {
                    'up': prob_up,
                    'down': prob_down
                },
                'reasoning': ['Análisis técnico básico', f'Fuerza de señal: {strength}'],
                'model_details': {
                    'method': 'Technical Analysis Fallback'
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error en predicción básica: {e}")
            return {
                'prediction': random.choice(['UP', 'DOWN']),
                'confidence': 0.5,
                'probability': {'up': 0.5, 'down': 0.5},
                'reasoning': ['Predicción aleatoria por error'],
                'model_details': {'method': 'Random Fallback'}
            }
    
    def generate_ml_reasoning(self, technical_analysis: Dict, individual_predictions: Dict) -> List[str]:
        """Generar razonamiento explicativo para la predicción ML"""
        reasoning = []
        
        # Análisis de consenso de modelos
        rf_pred = individual_predictions.get('random_forest', {}).get('prediction', 0)
        gb_pred = individual_predictions.get('gradient_boost', {}).get('prediction', 0)
        
        if rf_pred == gb_pred:
            reasoning.append(f"Consenso fuerte entre modelos: {rf_pred}")
        else:
            reasoning.append("Modelos divididos - usando ensemble")
        
        # Análisis de indicadores técnicos clave
        rsi = technical_analysis.get('rsi', 50)
        if rsi < 30:
            reasoning.append("RSI indica sobreventa - posible rebote")
        elif rsi > 70:
            reasoning.append("RSI indica sobrecompra - posible corrección")
        
        macd = technical_analysis.get('macd', {})
        if macd.get('histogram', 0) > 0:
            reasoning.append("MACD histogram positivo - momentum alcista")
        else:
            reasoning.append("MACD histogram negativo - momentum bajista")
        
        # Análisis de EMAs
        emas = technical_analysis.get('emas', {})
        if emas.get('golden_cross', False):
            reasoning.append("Golden cross detectado - señal alcista fuerte")
        elif emas.get('death_cross', False):
            reasoning.append("Death cross detectado - señal bajista fuerte")
        
        # Análisis de volumen
        volume = technical_analysis.get('volume', {})
        if volume.get('volume_strength', 0) > 20:
            reasoning.append("Alto volumen - confirma dirección del movimiento")
        
        return reasoning[:5]  # Limitar a 5 razones principales
    
    async def learn_from_result(self, simulation_id: str, actual_result: bool) -> None:
        """Aprender de resultado real de simulación"""
        try:
            # Buscar predicción correspondiente en historial
            matching_prediction = None
            for entry in reversed(self.prediction_history):
                # Simple matching - en producción usaríamos un ID más específico
                matching_prediction = entry
                break
            
            if matching_prediction:
                # Actualizar estadísticas
                self.prediction_stats['labeled_predictions'] += 1
                
                # Verificar si la predicción fue correcta
                predicted_direction = matching_prediction['prediction']['prediction']
                was_correct = (predicted_direction == 'UP' and actual_result) or (predicted_direction == 'DOWN' and not actual_result)
                
                if was_correct:
                    self.prediction_stats['correct_predictions'] += 1
                
                # Calcular precisión reciente
                if self.prediction_stats['labeled_predictions'] > 0:
                    self.prediction_stats['recent_accuracy'] = (
                        self.prediction_stats['correct_predictions'] / 
                        self.prediction_stats['labeled_predictions']
                    )
                
                # Añadir a cola de aprendizaje para reentrenamiento
                self.learning_queue.append({
                    'features': self.extract_features(matching_prediction['technical_analysis']),
                    'label': 1 if actual_result else 0,
                    'timestamp': datetime.utcnow()
                })
                
                logger.info(f"📚 Aprendizaje: Predicción {'correcta' if was_correct else 'incorrecta'}")
                logger.info(f"📊 Precisión actual: {self.prediction_stats['recent_accuracy']:.3f}")
                
                # Reentrenar si tenemos suficientes datos nuevos
                if len(self.learning_queue) >= 50:
                    await self.incremental_retrain()
            
        except Exception as e:
            logger.error(f"❌ Error en aprendizaje: {e}")
    
    async def incremental_retrain(self) -> None:
        """Reentrenamiento incremental con nuevos datos"""
        try:
            logger.info("🔄 Iniciando reentrenamiento incremental...")
            
            # Recolectar todos los datos disponibles
            X, y = await self.collect_training_data()
            
            if X is not None and len(X) > 50:
                success = await self.train_models(X, y)
                if success:
                    logger.info("✅ Reentrenamiento incremental completado")
                    # Limpiar cola de aprendizaje
                    self.learning_queue.clear()
            
        except Exception as e:
            logger.error(f"❌ Error en reentrenamiento incremental: {e}")
    
    async def auto_retrain(self) -> Dict:
        """Reentrenamiento automático completo"""
        try:
            logger.info("🚀 Iniciando reentrenamiento automático completo...")
            
            X, y = await self.collect_training_data()
            
            if X is not None and len(X) > 20:
                success = await self.train_models(X, y)
                
                return {
                    'success': success,
                    'samples_used': len(X),
                    'model_accuracy': self.model_accuracy,
                    'timestamp': datetime.utcnow().isoformat()
                }
            else:
                return {
                    'success': False,
                    'error': 'Datos insuficientes para reentrenamiento',
                    'samples_available': len(X) if X is not None else 0
                }
                
        except Exception as e:
            logger.error(f"❌ Error en reentrenamiento automático: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_comprehensive_stats(self) -> Dict:
        """Obtener estadísticas completas del sistema ML"""
        try:
            # Calcular progreso hacia 90%
            current_accuracy = self.prediction_stats.get('recent_accuracy', 0)
            progress_to_90 = min((current_accuracy / 0.9) * 100, 100) if current_accuracy > 0 else 0
            
            return {
                'system_status': {
                    'is_trained': self.is_trained,
                    'models_available': list(self.models.keys()),
                    'progress_to_90_percent': progress_to_90,
                    'target_accuracy': self.target_accuracy * 100
                },
                'prediction_stats': self.prediction_stats.copy(),
                'model_accuracy': self.model_accuracy.copy(),
                'feature_importance': {
                    'primary': self.get_feature_importance() if self.is_trained else None
                },
                'training_data': {
                    'prediction_history_size': len(self.prediction_history),
                    'learning_queue_size': len(self.learning_queue)
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo estadísticas: {e}")
            return {'error': str(e)}
    
    def get_feature_importance(self) -> Optional[List[float]]:
        """Obtener importancia de características del modelo Random Forest"""
        try:
            if 'random_forest' in self.models:
                return self.models['random_forest'].feature_importances_.tolist()
            return None
        except:
            return None

# Función de inicialización
async def initialize_enhanced_ml_system(db_client) -> EnhancedMLSystem:
    """Inicializar sistema ML avanzado"""
    try:
        logger.info("🚀 Inicializando sistema ML avanzado...")
        
        system = EnhancedMLSystem(db_client)
        
        # Intentar cargar datos y entrenar modelos iniciales
        X, y = await system.collect_training_data()
        
        if X is not None and len(X) >= 10:
            await system.train_models(X, y)
            logger.info("✅ Sistema ML inicializado con entrenamiento")
        else:
            logger.info("⚠️ Sistema ML inicializado sin entrenamiento inicial")
        
        return system
        
    except Exception as e:
        logger.error(f"❌ Error inicializando sistema ML: {e}")
        # Retornar sistema básico sin entrenamiento
        return EnhancedMLSystem(db_client)

# Variable global para el sistema
enhanced_ml_system = None