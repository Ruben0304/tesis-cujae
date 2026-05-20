## Validación del subsistema de detección del estado de los paneles

El segundo componente analítico del gemelo digital es un clasificador convolucional que diagnostica el estado físico de los módulos fotovoltaicos a partir de imágenes, complementando la información eléctrica disponible mediante una inspección visual automatizada. Su validación se aborda mediante métricas estándar de clasificación binaria, análisis cualitativo de la matriz de confusión y la curva ROC, y caracterización del comportamiento del modelo durante el entrenamiento.

### Conjunto de datos y configuración del modelo

El modelo se construye sobre la arquitectura **MobileNetV2** introducida por Sandler et al. [@sandler2018mobilenetv2], adoptada en modalidad de **aprendizaje por transferencia** [@pan2010transfer]. La elección de MobileNetV2 obedece a su equilibrio favorable entre exactitud y coste computacional: su diseño basado en bloques de residuos invertidos y cuellos de botella lineales logra desempeño comparable al de redes más grandes con un orden de magnitud menos de parámetros [@sandler2018mobilenetv2]. Esta característica es relevante en el contexto del gemelo digital, donde se busca capacidad de inferencia razonable sobre hardware estándar.

El conjunto de datos empleado contiene 2 562 imágenes etiquetadas en dos clases —paneles limpios y paneles con presencia de polvo—, con 1 493 ejemplos limpios y 1 069 ejemplos sucios. La partición destina 2 051 imágenes a entrenamiento y 511 a validación, manteniendo la proporción original entre clases [@lodhi2023faultpv]. Las imágenes se redimensionan a 224 × 224 píxeles, dimensión de entrada nativa de MobileNetV2 [@sandler2018mobilenetv2].

La arquitectura adoptada combina el extractor de características preentrenado de MobileNetV2, con sus pesos congelados durante el entrenamiento, con una cabeza de clasificación específica para esta tarea: una capa de promediado global, una capa densa de 128 unidades con normalización por lotes y *dropout*, y una capa final con una única salida sigmoidal correspondiente al problema binario. El modelo resultante posee 2 761 541 parámetros totales, de los cuales 166 913 son entrenables, lo que reduce drásticamente el tiempo de entrenamiento al apoyarse en el conocimiento previo extraído de ImageNet [@pan2010transfer; @sandler2018mobilenetv2]. El entrenamiento se desarrolla durante 6 épocas.

### Métricas de clasificación

La Figura \ref{fig:cnn-metrics} sintetiza las cinco métricas estándar empleadas para evaluar tareas de clasificación binaria sobre el conjunto de validación: exactitud, precisión, sensibilidad, F1-Score y área bajo la curva ROC [@lodhi2023faultpv; @pedregosa2011sklearn].

![Métricas de clasificación obtenidas por el clasificador CNN basado en MobileNetV2 sobre el conjunto de validación de 511 imágenes. La precisión (84,21 %) supera a la sensibilidad (60,09 %), indicando que el modelo prioriza la fiabilidad de las predicciones positivas sobre la cobertura exhaustiva de los paneles efectivamente sucios.](cnn_metrics.png){#fig:cnn-metrics width=80%}

La **exactitud** alcanza el 78,67 por ciento, valor que indica la proporción global de imágenes clasificadas correctamente. La **precisión** se sitúa en 84,21 por ciento, lo que significa que, de las imágenes clasificadas como sucias por el modelo, aproximadamente el 84 por ciento corresponden efectivamente a paneles con polvo. La **sensibilidad** (*recall*) es de 60,09 por ciento, valor que cuantifica la fracción de paneles realmente sucios que el modelo logra identificar. El **F1-Score** de 70,14 por ciento sintetiza ambas dimensiones en una única métrica. Finalmente, el **área bajo la curva ROC** (AUC) alcanza el valor de 0,8373, indicando una capacidad discriminativa notablemente superior al azar (AUC = 0,5) [@lodhi2023faultpv].

La asimetría observada entre precisión y sensibilidad es consecuencia directa de la calibración del umbral de decisión adoptada. Esta configuración prioriza la fiabilidad de las alertas generadas: cuando el sistema notifica al operador la posible presencia de polvo en un panel, esa notificación es correcta en aproximadamente cuatro de cada cinco casos. El precio operativo de esta calibración es que algunos paneles sucios pasan desapercibidos, lo que constituye un compromiso aceptable en el contexto del mantenimiento basado en condición, donde una alerta espuria genera trabajo innecesario pero una alerta omitida solo retrasa una intervención que el modelo detectará en pasadas posteriores [@dhimish2025reliability; @chehri2021condition].

### Matriz de confusión y curva ROC

El análisis cualitativo del comportamiento del clasificador se completa con la matriz de confusión y la curva ROC, presentadas en las Figuras \ref{fig:cnn-cm} y \ref{fig:cnn-roc}.

![Matriz de confusión del clasificador CNN sobre el conjunto de validación. La diagonal principal concentra los 402 aciertos (274 verdaderos negativos + 128 verdaderos positivos), frente a 109 errores totales (24 falsos positivos + 85 falsos negativos).](confusion_matrix.png){#fig:cnn-cm width=70%}

La matriz de confusión expone con claridad la distribución de aciertos y errores. Sobre las 511 imágenes de validación, el modelo clasifica correctamente 274 paneles limpios y 128 paneles sucios, totalizando 402 aciertos. Los errores se distribuyen entre 24 **falsos positivos** —paneles limpios que el modelo clasifica como sucios— y 85 **falsos negativos** —paneles sucios que el modelo clasifica como limpios. La proporción entre ambos tipos de error refleja la calibración asimétrica discutida anteriormente.

![Curva ROC del clasificador. El área bajo la curva alcanza el valor de 0,8373, sustancialmente superior al valor de referencia 0,5 correspondiente a un clasificador aleatorio.](roc_curve.png){#fig:cnn-roc width=70%}

La curva ROC, que representa la sensibilidad frente al complementario de la especificidad para todos los umbrales de decisión posibles, se sitúa consistentemente por encima de la diagonal de referencia. El área bajo la curva, igual a 0,8373, posiciona al modelo dentro del rango considerado bueno por la práctica habitual de evaluación de clasificadores [@lodhi2023faultpv]. La forma de la curva sugiere además que, mediante un ajuste del umbral de decisión, sería posible desplazar el compromiso precisión-sensibilidad según las necesidades operativas concretas del despliegue.

### Análisis de errores y curva de aprendizaje

Los 85 falsos negativos identificados corresponden a imágenes en las que el polvo presente es leve o se distribuye de manera no uniforme, condiciones en las cuales la firma visual de la suciedad es menos pronunciada y se solapa con la variabilidad propia de paneles limpios bajo distintas condiciones de iluminación. Los 24 falsos positivos, por su parte, suelen corresponder a paneles limpios fotografiados bajo condiciones de sombreado parcial o reflejos atmosféricos, que el modelo interpreta como presencia de partículas opacas en la superficie. Esta caracterización cualitativa de los errores es coherente con la literatura del campo, que documenta dificultades análogas en clasificadores visuales aplicados al diagnóstico de instalaciones fotovoltaicas [@lodhi2023faultpv; @dhimish2025reliability].

![Evolución de la pérdida y la exactitud durante las seis épocas de entrenamiento del clasificador CNN. La convergencia rápida y la estabilidad del comportamiento en el conjunto de validación confirman que el aprendizaje por transferencia es efectivo para esta tarea.](training_history_cnn.png){#fig:cnn-training width=85%}

La Figura \ref{fig:cnn-training} muestra la evolución de la pérdida y la exactitud durante las seis épocas de entrenamiento, tanto sobre el conjunto de entrenamiento como sobre el de validación. La convergencia se produce con rapidez en las primeras dos épocas, lo que es coherente con la naturaleza del aprendizaje por transferencia: el modelo aprovecha el conocimiento previo extraído de ImageNet y solo requiere ajustar la cabeza de clasificación específica de la tarea [@pan2010transfer; @sandler2018mobilenetv2]. La estabilidad observada en el conjunto de validación durante las épocas finales confirma la ausencia de sobreajuste apreciable y valida la calidad del entrenamiento.

Concluida la validación de los dos componentes analíticos del gemelo digital, el siguiente epígrafe aborda el segundo nivel de validación: la corrección del software que materializa el sistema.
