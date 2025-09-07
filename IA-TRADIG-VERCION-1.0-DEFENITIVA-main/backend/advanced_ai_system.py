"""
Sistema Avanzado de Aprendizaje de Errores para TradingAI Pro
Sistema que aprende de errores específicos y optimiza automáticamente para alcanzar 90% éxito
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
import numpy as np
import json

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ErrorLearningSystem:
    """Sistema inteligente que aprende de errores específicos y patrones de fallo"""
    
    def __init__(self, db_client):
        self.db = db_client.tradingai
        
        # Almacenamiento de errores y patrones
        self.error_patterns = defaultdict(list)
        self.correction_weights = defaultdict(float)
        self.recent_errors = deque(maxlen=200)
        
        # Métricas de aprendizaje
        self.error_stats = {
            'total_errors_analyzed': 0,
            'patterns_identified': 0,
            'corrections_applied': 0,
            'improvement_cycles': 0
        }
        
        # Pesos de corrección para diferentes tipos de error
        self.correction_factors = {
            'rsi_overbought': 0.15,      # Reducir confianza en RSI alto
            'rsi_oversold': 0.15,        # Reducir confianza en RSI bajo
            'macd_false_signal': 0.20,   # Ajustar señales MACD falsas
            'volume_anomaly': 0.10,      # Considerar anomalías de volumen
            'ema_crossover_fail': 0.25,  # Ajustar cruces de EMA fallidos
            'bollinger_breakout_fail': 0.18, # Ajustar roturas de Bollinger falsas
            'pattern_recognition_fail': 0.12, # Mejorar reconocimiento de patrones
            'support_resistance_break': 0.22  # Ajustar roturas de S/R
        }
        
        # Historial de mejoras
        self.improvement_history = []
        
    async def analyze_failed_prediction(self, simulation_data: Dict) -> Dict[str, Any]:
        """Analizar una predicción fallida para identificar patrones de error"""
        try:
            error_analysis = {
                'simulation_id': simulation_data.get('id'),
                'timestamp': datetime.utcnow(),
                'identified_errors': [],
                'correction_suggestions': []
            }
            
            technical_analysis = simulation_data.get('technical_analysis', {})
            predicted_direction = simulation_data.get('trend')
            actual_success = simulation_data.get('success', False)
            
            if actual_success:
                return error_analysis  # No error para analizar
            
            # Análizar diferentes tipos de errores
            
            # 1. Error de RSI
            rsi = technical_analysis.get('rsi', 50)
            if rsi > 70 and predicted_direction == 'UP':
                error_analysis['identified_errors'].append('rsi_overbought')
                error_analysis['correction_suggestions'].append({
                    'type': 'rsi_adjustment',
                    'description': 'Reducir confianza cuando RSI > 70 y predicción UP',
                    'weight_adjustment': -0.15
                })
                self.error_patterns['rsi_overbought'].append({
                    'rsi_value': rsi,
                    'timestamp': datetime.utcnow(),
                    'context': technical_analysis
                })
            
            elif rsi < 30 and predicted_direction == 'DOWN':
                error_analysis['identified_errors'].append('rsi_oversold')
                error_analysis['correction_suggestions'].append({
                    'type': 'rsi_adjustment',
                    'description': 'Reducir confianza cuando RSI < 30 y predicción DOWN',
                    'weight_adjustment': -0.15
                })
                self.error_patterns['rsi_oversold'].append({
                    'rsi_value': rsi,
                    'timestamp': datetime.utcnow(),
                    'context': technical_analysis
                })
            
            # 2. Error de MACD
            macd = technical_analysis.get('macd', {})
            macd_histogram = macd.get('histogram', 0)
            if abs(macd_histogram) < 0.01:  # Señal MACD débil
                error_analysis['identified_errors'].append('macd_false_signal')
                error_analysis['correction_suggestions'].append({
                    'type': 'macd_filter',
                    'description': 'Ignorar señales MACD cuando histogram < 0.01',
                    'weight_adjustment': -0.20
                })
                self.error_patterns['macd_false_signal'].append({
                    'histogram_value': macd_histogram,
                    'timestamp': datetime.utcnow(),
                    'context': macd
                })
            
            # 3. Error de EMA Crossover
            emas = technical_analysis.get('emas', {})
            if emas.get('golden_cross', False) and predicted_direction == 'UP' and not actual_success:
                error_analysis['identified_errors'].append('ema_crossover_fail')
                error_analysis['correction_suggestions'].append({
                    'type': 'ema_validation',
                    'description': 'Validar cruces de EMA con otros indicadores',
                    'weight_adjustment': -0.25
                })
                self.error_patterns['ema_crossover_fail'].append({
                    'ema_20': emas.get('ema_20'),
                    'ema_50': emas.get('ema_50'),
                    'timestamp': datetime.utcnow(),
                    'context': emas
                })
            
            # 4. Error de Bollinger Bands
            bollinger = technical_analysis.get('bollinger', {})
            bb_position = bollinger.get('position', 0.5)
            if (bb_position > 0.9 and predicted_direction == 'UP') or (bb_position < 0.1 and predicted_direction == 'DOWN'):
                error_analysis['identified_errors'].append('bollinger_breakout_fail')
                error_analysis['correction_suggestions'].append({
                    'type': 'bollinger_filter',
                    'description': 'Cuidado con roturas falsas en extremos de Bollinger',
                    'weight_adjustment': -0.18
                })
                self.error_patterns['bollinger_breakout_fail'].append({
                    'position': bb_position,
                    'timestamp': datetime.utcnow(),
                    'context': bollinger
                })
            
            # 5. Error de Volumen
            volume = technical_analysis.get('volume', {})
            volume_strength = volume.get('volume_strength', 0)
            if abs(volume_strength) > 100:  # Volumen anómalo
                error_analysis['identified_errors'].append('volume_anomaly')
                error_analysis['correction_suggestions'].append({
                    'type': 'volume_filter',
                    'description': 'Filtrar movimientos con volumen anómalo',
                    'weight_adjustment': -0.10
                })
                self.error_patterns['volume_anomaly'].append({
                    'volume_strength': volume_strength,
                    'timestamp': datetime.utcnow(),
                    'context': volume
                })
            
            # 6. Error de Support/Resistance
            sr = technical_analysis.get('support_resistance', {})
            if sr.get('resistance_distance', 10) < 1 and predicted_direction == 'UP':
                error_analysis['identified_errors'].append('support_resistance_break')
                error_analysis['correction_suggestions'].append({
                    'type': 'sr_validation',
                    'description': 'Validar roturas de resistencia con volumen',
                    'weight_adjustment': -0.22
                })
                self.error_patterns['support_resistance_break'].append({
                    'resistance_distance': sr.get('resistance_distance'),
                    'timestamp': datetime.utcnow(),
                    'context': sr
                })
            
            # Guardar análisis de error
            self.recent_errors.append(error_analysis)
            self.error_stats['total_errors_analyzed'] += 1
            
            # Aplicar correcciones automáticamente
            await self.apply_corrections(error_analysis)
            
            logger.info(f"🧠 Error analizado: {len(error_analysis['identified_errors'])} patrones identificados")
            
            return error_analysis
            
        except Exception as e:
            logger.error(f"❌ Error analizando predicción fallida: {e}")
            return {'error': str(e)}
    
    async def apply_corrections(self, error_analysis: Dict) -> None:
        """Aplicar correcciones basadas en análisis de errores"""
        try:
            corrections_applied = 0
            
            for error_type in error_analysis.get('identified_errors', []):
                if error_type in self.correction_factors:
                    # Incrementar peso de corrección
                    self.correction_weights[error_type] += self.correction_factors[error_type]
                    
                    # Limitar peso máximo
                    self.correction_weights[error_type] = min(
                        self.correction_weights[error_type], 
                        0.8
                    )
                    
                    corrections_applied += 1
            
            if corrections_applied > 0:
                self.error_stats['corrections_applied'] += corrections_applied
                logger.info(f"✅ {corrections_applied} correcciones aplicadas")
                
                # Registrar mejora
                self.improvement_history.append({
                    'timestamp': datetime.utcnow(),
                    'corrections_applied': corrections_applied,
                    'error_types': error_analysis.get('identified_errors', [])
                })
            
        except Exception as e:
            logger.error(f"❌ Error aplicando correcciones: {e}")
    
    def get_correction_factor(self, technical_analysis: Dict, prediction: str) -> float:
        """Obtener factor de corrección basado en patrones aprendidos"""
        try:
            total_correction = 0.0
            
            # Aplicar correcciones aprendidas
            rsi = technical_analysis.get('rsi', 50)
            
            # Corrección RSI
            if rsi > 70 and prediction == 'UP':
                total_correction -= self.correction_weights.get('rsi_overbought', 0)
            elif rsi < 30 and prediction == 'DOWN':
                total_correction -= self.correction_weights.get('rsi_oversold', 0)
            
            # Corrección MACD
            macd = technical_analysis.get('macd', {})
            if abs(macd.get('histogram', 0)) < 0.01:
                total_correction -= self.correction_weights.get('macd_false_signal', 0)
            
            # Corrección EMA
            emas = technical_analysis.get('emas', {})
            if emas.get('golden_cross', False) and prediction == 'UP':
                total_correction -= self.correction_weights.get('ema_crossover_fail', 0)
            
            # Corrección Bollinger
            bollinger = technical_analysis.get('bollinger', {})
            bb_position = bollinger.get('position', 0.5)
            if (bb_position > 0.9 and prediction == 'UP') or (bb_position < 0.1 and prediction == 'DOWN'):
                total_correction -= self.correction_weights.get('bollinger_breakout_fail', 0)
            
            # Corrección Volumen
            volume = technical_analysis.get('volume', {})
            if abs(volume.get('volume_strength', 0)) > 100:
                total_correction -= self.correction_weights.get('volume_anomaly', 0)
            
            # Corrección Support/Resistance
            sr = technical_analysis.get('support_resistance', {})
            if sr.get('resistance_distance', 10) < 1 and prediction == 'UP':
                total_correction -= self.correction_weights.get('support_resistance_break', 0)
            
            # Limitar corrección total
            total_correction = max(total_correction, -0.3)  # Máximo 30% de corrección
            
            return total_correction
            
        except Exception as e:
            logger.error(f"❌ Error calculando factor de corrección: {e}")
            return 0.0
    
    async def optimize_for_90_percent(self) -> Dict[str, Any]:
        """Optimización específica para alcanzar 90% de éxito"""
        try:
            logger.info("🎯 Ejecutando optimización para 90% de éxito...")
            
            # Analizar errores recientes
            recent_error_types = defaultdict(int)
            for error in list(self.recent_errors)[-50:]:  # Últimos 50 errores
                for error_type in error.get('identified_errors', []):
                    recent_error_types[error_type] += 1
            
            # Identificar los errores más comunes
            most_common_errors = sorted(recent_error_types.items(), key=lambda x: x[1], reverse=True)[:5]
            
            optimization_actions = []
            
            for error_type, count in most_common_errors:
                if count > 5:  # Si el error ocurre frecuentemente
                    # Incrementar corrección para este tipo de error
                    current_weight = self.correction_weights.get(error_type, 0)
                    new_weight = min(current_weight + 0.1, 0.5)  # Incremento gradual
                    self.correction_weights[error_type] = new_weight
                    
                    optimization_actions.append({
                        'error_type': error_type,
                        'frequency': count,
                        'old_weight': current_weight,
                        'new_weight': new_weight,
                        'action': 'increased_correction'
                    })
            
            self.error_stats['improvement_cycles'] += 1
            
            result = {
                'optimization_timestamp': datetime.utcnow().isoformat(),
                'most_common_errors': dict(most_common_errors),
                'optimization_actions': optimization_actions,
                'current_correction_weights': dict(self.correction_weights),
                'improvement_cycle': self.error_stats['improvement_cycles']
            }
            
            logger.info(f"✅ Optimización completada: {len(optimization_actions)} ajustes realizados")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error en optimización para 90%: {e}")
            return {'error': str(e)}
    
    async def get_error_insights(self) -> Dict[str, Any]:
        """Obtener insights sobre errores y mejoras"""
        try:
            # Contar errores por tipo
            error_type_counts = defaultdict(int)
            for error in self.recent_errors:
                for error_type in error.get('identified_errors', []):
                    error_type_counts[error_type] += 1
            
            # Calcular tendencias
            recent_errors_count = len([e for e in self.recent_errors 
                                     if (datetime.utcnow() - e['timestamp']).hours < 24])
            
            return {
                'error_stats': self.error_stats.copy(),
                'error_type_distribution': dict(error_type_counts),
                'recent_errors_24h': recent_errors_count,
                'total_recent_errors': len(self.recent_errors),
                'correction_weights': dict(self.correction_weights),
                'pattern_weights_count': len(self.correction_weights),
                'improvement_history_size': len(self.improvement_history),
                'last_optimization': self.improvement_history[-1] if self.improvement_history else None
            }
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo insights: {e}")
            return {'error': str(e)}
    
    async def continuous_learning_loop(self):
        """Ciclo continuo de aprendizaje y optimización"""
        try:
            while True:
                # Cada 2 minutos, optimizar para 90%
                await self.optimize_for_90_percent()
                
                # Esperar 2 minutos
                await asyncio.sleep(120)
                
        except Exception as e:
            logger.error(f"❌ Error en ciclo de aprendizaje continuo: {e}")

# Función de inicialización
async def initialize_error_learning_system(db_client) -> ErrorLearningSystem:
    """Inicializar sistema de aprendizaje de errores"""
    try:
        logger.info("🧠 Inicializando sistema de aprendizaje de errores...")
        
        system = ErrorLearningSystem(db_client)
        
        # Iniciar ciclo de aprendizaje continuo en background
        asyncio.create_task(system.continuous_learning_loop())
        
        logger.info("✅ Sistema de aprendizaje de errores inicializado")
        
        return system
        
    except Exception as e:
        logger.error(f"❌ Error inicializando sistema de aprendizaje: {e}")
        return ErrorLearningSystem(db_client)

# Variable global para el sistema
error_learning_system = None