"""
Sistema de Aprendizaje IA Independiente para Mira
Machine Learning autónomo sin APIs externas
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
from typing import Dict, List, Tuple, Optional
import pickle
import asyncio
from datetime import datetime, timedelta
import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MLTradingSystem:
    """Sistema de Machine Learning independiente para trading"""
    
    def __init__(self, db_client):
        self.db = db_client.tradingai
        self.models = {
            'primary': RandomForestClassifier(n_estimators=100, random_state=42),
            'secondary': GradientBoostingClassifier(n_estimators=100, random_state=42)
        }
        self.scaler = StandardScaler()
        self.feature_importance = {}
        self.model_accuracy = {}
        self.learning_data = []
        self.is_trained = False
        self.confidence_threshold = 0.7
        
    async def collect_training_data(self, technical_analysis: Dict, actual_result: Optional[bool] = None) -> Dict:
        """Recolecta datos para entrenamiento del modelo"""
        try:
            # Extraer características del análisis técnico
            features = self.extract_features(technical_analysis)
            
            training_record = {
                'id': str(uuid.uuid4()),
                'timestamp': datetime.utcnow(),
                'features': features,
                'prediction': None,  # Se llenará cuando se haga la predicción
                'actual_result': actual_result,
                'market_conditions': self.analyze_market_conditions(technical_analysis)
            }
            
            # Guardar en base de datos
            await self.db.training_data.insert_one(training_record)
            logger.info(f"✅ Datos de entrenamiento recolectados: {len(features)} características")
            
            return training_record
            
        except Exception as e:
            logger.error(f"❌ Error recolectando datos de entrenamiento: {e}")
            return {}
    
    def extract_features(self, technical_analysis: Dict) -> List[float]:
        """Extrae características numéricas del análisis técnico"""
        features = []
        
        try:
            # Características de precio
            features.append(technical_analysis.get('rsi', 50))
            
            # MACD
            macd_data = technical_analysis.get('macd', {})
            features.append(macd_data.get('macd', 0))
            features.append(macd_data.get('signal', 0))
            features.append(macd_data.get('histogram', 0))
            
            # Bollinger Bands
            bb_data = technical_analysis.get('bollinger', {})
            features.append(bb_data.get('position', 0.5))
            
            # EMAs
            emas = technical_analysis.get('emas', {})
            features.append(1 if emas.get('crossover', False) else 0)
            
            # Estocástico
            stoch = technical_analysis.get('stochastic', {})
            features.append(stoch.get('k', 50))
            features.append(stoch.get('d', 50))
            
            # Volumen
            volume = technical_analysis.get('volume', {})
            features.append(volume.get('volume_strength', 0))
            features.append(volume.get('volume_trend', 0))
            
            # Patrones de velas (binarios)
            patterns = technical_analysis.get('patterns', {})
            features.append(1 if patterns.get('hammer', False) else 0)
            features.append(1 if patterns.get('doji', False) else 0)
            features.append(1 if patterns.get('engulfing_bullish', False) else 0)
            
            # Soporte y resistencia
            sr = technical_analysis.get('support_resistance', {})
            features.append(sr.get('resistance_distance', 0.1))
            features.append(sr.get('support_distance', 0.1))
            
            # Señales agregadas
            signals = technical_analysis.get('signals', {})
            features.append(signals.get('strength', 0))
            features.append(len(signals.get('bullish_signals', [])))
            features.append(len(signals.get('bearish_signals', [])))
            
            # Características de tiempo (hora del día, día de la semana)
            now = datetime.utcnow()
            features.append(now.hour)
            features.append(now.weekday())
            
            logger.info(f"✅ Extraídas {len(features)} características")
            return features
            
        except Exception as e:
            logger.error(f"❌ Error extrayendo características: {e}")
            return [0] * 20  # Características por defecto
    
    def analyze_market_conditions(self, technical_analysis: Dict) -> Dict:
        """Analiza las condiciones generales del mercado"""
        conditions = {
            'volatility': 'normal',
            'trend': 'neutral',
            'momentum': 'neutral',
            'volume_profile': 'normal'
        }
        
        try:
            # Análisis de volatilidad (Bollinger Bands)
            bb = technical_analysis.get('bollinger', {})
            bb_position = bb.get('position', 0.5)
            if bb_position > 0.8 or bb_position < 0.2:
                conditions['volatility'] = 'high'
            
            # Análisis de tendencia (EMAs)
            emas = technical_analysis.get('emas', {})
            if emas.get('crossover', False):
                conditions['trend'] = 'bullish'
            else:
                conditions['trend'] = 'bearish'
            
            # Análisis de momentum (RSI)
            rsi = technical_analysis.get('rsi', 50)
            if rsi > 60:
                conditions['momentum'] = 'bullish'
            elif rsi < 40:
                conditions['momentum'] = 'bearish'
            
            # Análisis de volumen
            volume = technical_analysis.get('volume', {})
            volume_strength = volume.get('volume_strength', 0)
            if abs(volume_strength) > 1:
                conditions['volume_profile'] = 'high'
            elif abs(volume_strength) < 0.5:
                conditions['volume_profile'] = 'low'
            
        except Exception as e:
            logger.error(f"❌ Error analizando condiciones de mercado: {e}")
        
        return conditions
    
    async def train_models(self) -> Dict:
        """Entrena los modelos ML con datos históricos"""
        try:
            # Obtener datos de entrenamiento
            training_data = await self.db.training_data.find({
                'actual_result': {'$in': [True, False]}
            }).to_list(length=None)
            
            if len(training_data) < 50:
                logger.warning(f"⚠️ Pocos datos para entrenamiento: {len(training_data)}")
                return {'error': 'Insufficient training data'}
            
            # Preparar datos
            X = []
            y = []
            
            for record in training_data:
                if record.get('features') and record.get('actual_result') is not None:
                    X.append(record['features'])
                    y.append(1 if record['actual_result'] else 0)
            
            X = np.array(X)
            y = np.array(y)
            
            # Normalizar características
            X_scaled = self.scaler.fit_transform(X)
            
            # Dividir datos
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42, stratify=y
            )
            
            results = {}
            
            # Entrenar modelos
            for model_name, model in self.models.items():
                # Entrenamiento
                model.fit(X_train, y_train)
                
                # Evaluación
                y_pred = model.predict(X_test)
                accuracy = accuracy_score(y_test, y_pred)
                
                # Validación cruzada
                cv_scores = cross_val_score(model, X_scaled, y, cv=5)
                
                self.model_accuracy[model_name] = {
                    'accuracy': accuracy,
                    'cv_mean': cv_scores.mean(),
                    'cv_std': cv_scores.std()
                }
                
                # Importancia de características (solo para RandomForest)
                if hasattr(model, 'feature_importances_'):
                    self.feature_importance[model_name] = model.feature_importances_.tolist()
                
                results[model_name] = {
                    'accuracy': accuracy,
                    'cv_score': cv_scores.mean(),
                    'training_samples': len(X_train)
                }
                
                logger.info(f"✅ Modelo {model_name} entrenado - Precisión: {accuracy:.3f}")
            
            self.is_trained = True
            
            # Guardar modelos
            await self.save_models()
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Error entrenando modelos: {e}")
            return {'error': str(e)}
    
    async def predict(self, technical_analysis: Dict) -> Dict:
        """Hace predicción usando los modelos entrenados"""
        if not self.is_trained:
            # Intentar cargar modelos guardados
            await self.load_models()
            
            if not self.is_trained:
                logger.warning("⚠️ Modelos no entrenados, usando análisis técnico básico")
                return self.fallback_prediction(technical_analysis)
        
        try:
            # Extraer características
            features = self.extract_features(technical_analysis)
            features_scaled = self.scaler.transform([features])
            
            predictions = {}
            probabilities = {}
            
            # Hacer predicciones con ambos modelos
            for model_name, model in self.models.items():
                pred = model.predict(features_scaled)[0]
                prob = model.predict_proba(features_scaled)[0]
                
                predictions[model_name] = pred
                probabilities[model_name] = {
                    'down': prob[0],
                    'up': prob[1]
                }
            
            # Combinar predicciones (ensemble)
            ensemble_prediction = self.combine_predictions(predictions, probabilities)
            
            # Calcular confianza ajustada
            adjusted_confidence = self.calculate_adjusted_confidence(
                ensemble_prediction, technical_analysis
            )
            
            result = {
                'prediction': 'UP' if ensemble_prediction['final_prediction'] == 1 else 'DOWN',
                'probability': {
                    'up': ensemble_prediction['up_probability'],
                    'down': ensemble_prediction['down_probability']
                },
                'confidence': adjusted_confidence,
                'model_details': {
                    'predictions': predictions,
                    'probabilities': probabilities,
                    'ensemble_method': 'weighted_average'
                },
                'reasoning': self.generate_reasoning(technical_analysis, ensemble_prediction)
            }
            
            # Guardar predicción para aprendizaje futuro
            await self.collect_training_data(technical_analysis)
            
            logger.info(f"✅ Predicción ML: {result['prediction']} - Confianza: {result['confidence']:.2f}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error en predicción ML: {e}")
            return self.fallback_prediction(technical_analysis)
    
    def combine_predictions(self, predictions: Dict, probabilities: Dict) -> Dict:
        """Combina predicciones de múltiples modelos"""
        # Pesos basados en precisión de modelos
        weights = {}
        total_weight = 0
        
        for model_name in predictions.keys():
            accuracy = self.model_accuracy.get(model_name, {}).get('accuracy', 0.5)
            weight = accuracy ** 2  # Cuadrado para dar más peso a modelos precisos
            weights[model_name] = weight
            total_weight += weight
        
        # Normalizar pesos
        if total_weight > 0:
            for model_name in weights:
                weights[model_name] /= total_weight
        else:
            # Pesos iguales si no hay información de precisión
            weight = 1.0 / len(predictions)
            for model_name in weights:
                weights[model_name] = weight
        
        # Combinar probabilidades
        up_prob = 0
        down_prob = 0
        
        for model_name, weight in weights.items():
            prob_data = probabilities[model_name]
            up_prob += prob_data['up'] * weight
            down_prob += prob_data['down'] * weight
        
        # Predicción final
        final_prediction = 1 if up_prob > down_prob else 0
        
        return {
            'final_prediction': final_prediction,
            'up_probability': up_prob,
            'down_probability': down_prob,
            'weights': weights
        }
    
    def calculate_adjusted_confidence(self, ensemble_prediction: Dict, technical_analysis: Dict) -> float:
        """Calcula confianza ajustada basada en múltiples factores"""
        base_confidence = max(ensemble_prediction['up_probability'], ensemble_prediction['down_probability'])
        
        # Ajustes por confluencia de señales técnicas
        signals = technical_analysis.get('signals', {})
        technical_confidence = signals.get('confidence', 0.5)
        
        # Ajuste por condiciones de mercado
        market_conditions = self.analyze_market_conditions(technical_analysis)
        market_adjustment = 0
        
        # Penalizar en alta volatilidad
        if market_conditions['volatility'] == 'high':
            market_adjustment -= 0.1
        
        # Bonificar cuando tendencia y momentum coinciden
        if market_conditions['trend'] == market_conditions['momentum']:
            market_adjustment += 0.05
        
        # Combinar confianzas
        combined_confidence = (base_confidence * 0.6 + technical_confidence * 0.4) + market_adjustment
        
        # Limitar entre 0.5 y 0.95
        return max(0.5, min(0.95, combined_confidence))
    
    def generate_reasoning(self, technical_analysis: Dict, ensemble_prediction: Dict) -> List[str]:
        """Genera explicaciones del razonamiento de la predicción"""
        reasoning = []
        
        signals = technical_analysis.get('signals', {})
        prediction_type = 'UP' if ensemble_prediction['final_prediction'] == 1 else 'DOWN'
        
        # Señales técnicas principales
        if prediction_type == 'UP':
            reasoning.extend(signals.get('bullish_signals', []))
        else:
            reasoning.extend(signals.get('bearish_signals', []))
        
        # Información del modelo
        weights = ensemble_prediction.get('weights', {})
        primary_model_weight = weights.get('primary', 0)
        
        reasoning.append(f"ML model confidence: {primary_model_weight:.2f}")
        reasoning.append(f"Ensemble prediction strength: {abs(ensemble_prediction['up_probability'] - ensemble_prediction['down_probability']):.2f}")
        
        # Limitar a las 5 razones más importantes
        return reasoning[:5]
    
    def fallback_prediction(self, technical_analysis: Dict) -> Dict:
        """Predicción de respaldo usando solo análisis técnico"""
        signals = technical_analysis.get('signals', {})
        strength = signals.get('strength', 0)
        confidence = signals.get('confidence', 0.5)
        
        # Predicción basada en fuerza de señales técnicas
        prediction = 'UP' if strength > 0 else 'DOWN'
        up_prob = (strength + 100) / 200  # Normalizar -100 a +100 -> 0 a 1
        down_prob = 1 - up_prob
        
        return {
            'prediction': prediction,
            'probability': {
                'up': up_prob,
                'down': down_prob
            },
            'confidence': confidence,
            'model_details': {
                'method': 'technical_analysis_fallback'
            },
            'reasoning': signals.get('bullish_signals', []) + signals.get('bearish_signals', [])
        }
    
    async def update_with_result(self, prediction_id: str, actual_result: bool):
        """Actualiza el sistema con el resultado real para aprendizaje"""
        try:
            # Actualizar registro en base de datos
            await self.db.training_data.update_one(
                {'id': prediction_id},
                {'$set': {'actual_result': actual_result, 'updated_at': datetime.utcnow()}}
            )
            
            # Re-entrenar modelos periódicamente
            training_count = await self.db.training_data.count_documents({
                'actual_result': {'$in': [True, False]}
            })
            
            # Re-entrenar cada 100 nuevos resultados
            if training_count % 100 == 0:
                logger.info(f"🔄 Re-entrenando modelos con {training_count} ejemplos")
                await self.train_models()
            
            logger.info(f"✅ Sistema actualizado con resultado: {actual_result}")
            
        except Exception as e:
            logger.error(f"❌ Error actualizando con resultado: {e}")
    
    async def save_models(self):
        """Guarda los modelos entrenados"""
        try:
            models_data = {
                'models': {},
                'scaler': self.scaler,
                'feature_importance': self.feature_importance,
                'model_accuracy': self.model_accuracy,
                'timestamp': datetime.utcnow()
            }
            
            # Serializar modelos
            for name, model in self.models.items():
                models_data['models'][name] = pickle.dumps(model)
            
            # Guardar en base de datos
            await self.db.ml_models.replace_one(
                {'type': 'trading_models'},
                {'type': 'trading_models', 'data': models_data},
                upsert=True
            )
            
            logger.info("✅ Modelos guardados en base de datos")
            
        except Exception as e:
            logger.error(f"❌ Error guardando modelos: {e}")
    
    async def load_models(self):
        """Carga los modelos guardados"""
        try:
            model_record = await self.db.ml_models.find_one({'type': 'trading_models'})
            
            if model_record and 'data' in model_record:
                models_data = model_record['data']
                
                # Cargar modelos
                for name, model_bytes in models_data['models'].items():
                    self.models[name] = pickle.loads(model_bytes)
                
                self.scaler = models_data.get('scaler', StandardScaler())
                self.feature_importance = models_data.get('feature_importance', {})
                self.model_accuracy = models_data.get('model_accuracy', {})
                
                self.is_trained = True
                logger.info("✅ Modelos cargados desde base de datos")
                
            else:
                logger.info("ℹ️ No se encontraron modelos guardados")
                
        except Exception as e:
            logger.error(f"❌ Error cargando modelos: {e}")
    
    async def get_learning_stats(self) -> Dict:
        """Obtiene estadísticas del sistema de aprendizaje"""
        try:
            total_data = await self.db.training_data.count_documents({})
            labeled_data = await self.db.training_data.count_documents({
                'actual_result': {'$in': [True, False]}
            })
            
            recent_accuracy = 0
            if labeled_data > 0:
                # Calcular precisión de predicciones recientes
                recent_predictions = await self.db.training_data.find({
                    'actual_result': {'$in': [True, False]},
                    'prediction': {'$ne': None}
                }).sort('timestamp', -1).limit(100).to_list(length=None)
                
                if recent_predictions:
                    correct = sum(1 for p in recent_predictions 
                                if (p.get('prediction') == 'UP' and p.get('actual_result')) or 
                                   (p.get('prediction') == 'DOWN' and not p.get('actual_result')))
                    recent_accuracy = correct / len(recent_predictions)
            
            return {
                'total_training_samples': total_data,
                'labeled_samples': labeled_data,
                'recent_accuracy': recent_accuracy,
                'models_trained': self.is_trained,
                'model_accuracy': self.model_accuracy,
                'feature_importance': self.feature_importance
            }
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo estadísticas: {e}")
            return {}

# Variable global para el sistema ML
ml_system = None

async def initialize_ml_system(db_client):
    """Inicializa el sistema ML global"""
    global ml_system
    ml_system = MLTradingSystem(db_client)
    await ml_system.load_models()
    logger.info("🤖 Sistema de ML inicializado")
    return ml_system