## Validación del subsistema de predicción de producción solar

El subsistema de predicción de la producción solar constituye el componente analítico central del gemelo digital, al condicionar la planificación del uso del almacenamiento y la generación de alertas operativas. Su validación se estructura en torno al modelo Random Forest desplegado en producción —denominado Havana v1 en la documentación interna del sistema—, entrenado con datos reales de La Habana y evaluado con metodología libre de fuga temporal (*data leakage*).

### Origen del modelo y corrección de limitaciones del prototipo anterior

Durante el desarrollo del sistema se dispuso inicialmente de un prototipo de modelo entrenado sobre un conjunto de datos de una planta fotovoltaica de 7,7 MW ubicada en clima frío europeo, con separación aleatoria de las muestras entre entrenamiento y prueba. La evaluación técnica de ese prototipo identificó tres limitaciones que comprometían la validez de sus métricas y su aplicabilidad al gemelo digital: fuga temporal por mezcla de muestras consecutivas antes de la partición, desajuste entre las variables de entrenamiento y las variables disponibles en producción desde la API Open-Meteo, e incompatibilidad climática y de escala con la instalación cubana [@trull2025folsom; @leholo2026slrsolar]. Estas limitaciones motivaron el entrenamiento del modelo definitivo sobre datos específicos de La Habana, corrigiendo los tres problemas de forma simultánea.

### Fuentes de datos y construcción del conjunto de entrenamiento

El modelo Havana v1 se entrena con datos históricos de La Habana, Cuba (latitud 23,1136°, longitud −82,3666°), obtenidos de dos fuentes gratuitas sin registro [@openmeteo2024]. La variable objetivo —producción horaria— proviene de **PVGIS** (*Photovoltaic Geographical Information System*, JRC de la Comisión Europea) con base de datos satelital NSRDB (*National Solar Radiation Database*), considerado en la literatura como referencia de validación de alta fiabilidad para producción fotovoltaica estimada por modelo físico [@dhimish2025reliability]. Las variables predictoras climáticas provienen de **Open-Meteo** para las mismas coordenadas y el mismo intervalo temporal, siendo estas las mismas variables que el backend del sistema recibe en operación real desde la misma API, eliminando por construcción el desajuste entre entrenamiento y producción.

El conjunto abarca los años 2010 a 2015, alcanzando 52 584 horas tras la unión por marca de tiempo UTC. La variable objetivo se expresa como **factor de capacidad** (valor adimensional entre 0 y 1), definido como el cociente entre la producción horaria y la producción máxima posible; esta representación permite que el mismo modelo sirva para cualquier tamaño de instalación fotovoltaica, al multiplicar la predicción del factor por la capacidad nominal leída en tiempo real desde la base de datos del sistema [@kumar2020microgrid].

### Configuración del modelo y características de entrada

El modelo se construye sobre el algoritmo **Random Forest** [@breiman2001randomforests] disponible en la biblioteca scikit-learn [@pedregosa2011sklearn]. El conjunto de variables predictoras comprende **14 características**, organizadas en tres grupos funcionales.

El primer grupo incluye variables climáticas directas: temperatura del aire a dos metros, humedad relativa, velocidad del viento a diez metros, cobertura nubosa y radiación de onda corta (*shortwave radiation*), esta última la variable física más directamente correlacionada con la producción fotovoltaica [@trull2025folsom].

El segundo grupo, generado mediante la biblioteca **pvlib** [@pvlib2024docs], incorpora cuatro variables derivadas de la física solar para las coordenadas específicas de La Habana: la radiación de cielo despejado (*clearsky GHI*), el índice de claridad (*clearsky index*) como cociente entre radiación real y teórica de cielo despejado, la elevación solar en grados y la irradiancia efectiva atenuada por nubosidad. Estas variables permiten al modelo corregir implícitamente la geometría solar para la latitud de La Habana, sin necesidad de aprenderla desde datos de otra región. A este grupo se añade el **factor de pérdida por temperatura** (*temp_loss_factor*), que modela la reducción de eficiencia de los módulos en torno a 0,4 % por grado Celsius sobre la temperatura de referencia de 25 °C [@dhimish2025reliability].

El tercer grupo corresponde a las variables temporales, codificadas mediante transformaciones cíclicas sobre seno y coseno para la hora del día y el mes del año, evitando las discontinuidades artificiales de una codificación numérica lineal [@almarzooqi2024hybrid].

La partición del conjunto se realiza de forma **cronológica**, entrenando sobre el período 2010–2014 y validando sobre el año 2015, de modo que el modelo predice siempre sobre fechas posteriores a las utilizadas en entrenamiento y no puede acceder implícitamente a información futura. Esta separación cronológica constituye la práctica estándar para series temporales y elimina la fuga temporal del prototipo anterior [@trull2025folsom]. El resultado es una partición de **42 067 muestras** de entrenamiento y **10 517 de prueba**.

### Comparación frente a modelos de referencia

La selección del Random Forest como modelo final se sustenta en una comparación sistemática frente a dos alternativas: regresión lineal como línea base estadística y *HistGradient Boosting* con restricción monótona como representante del conjunto de potenciación por gradiente moderno [@chen2016xgboost; @breiman2001randomforests]. La Figura \ref{fig:comparacion-solar} presenta la comparación de las tres métricas sobre el conjunto de prueba, evaluadas exclusivamente en **horas de luz solar** —condición de filtrado que excluye los registros nocturnos de producción nula, que inflarían artificialmente el R² global al ser triviales de predecir.

![Comparación de modelos de predicción solar (horas de día).](comparacion_modelos_solar.png){#fig:comparacion-solar width=85%}

La Tabla \ref{tbl:comparacion-solar} resume los valores numéricos del conjunto de prueba para las horas diurnas.

| Modelo | R² (día) | nRMSE (día) | nMAE (día) |
|---|---|---|---|
| Regresión Lineal (baseline) | 0,754 | 12,4 % | 8,8 % |
| **Random Forest** (seleccionado) | **0,789** | **11,4 %** | **7,54 %** |
| HistGradient Boosting | 0,785 | 11,6 % | 7,5 % |

: Comparación de modelos — conjunto de prueba, horas de día. nRMSE y nMAE expresados como porcentaje de la capacidad nominal. {#tbl:comparacion-solar}

Los tres modelos convergen hacia valores similares, lo que es interpretable como evidencia de que el límite de precisión alcanzable con estas variables predictoras lo impone la fuente de datos —la diferencia entre la radiación del modelo Open-Meteo y la producción de PVGIS—, no la capacidad del algoritmo. Ante esta situación, el Random Forest se selecciona por ofrecer el menor error absoluto en las horas de día y mayor robustez ante datos ruidosos en comparación con el ensemble lineal [@breiman2001randomforests].

Se realizó adicionalmente un experimento con una **fórmula física híbrida** (cadena PVWatts/pvlib: radiación → componentes directa/difusa → plano del panel → temperatura de celda → potencia DC) y con LightGBM, obteniendo valores de R² de 0,666 y 0,766 respectivamente para las horas de día, inferiores al Random Forest. El experimento confirma que, en este contexto, el modelo estadístico ya ha internalizado la física al entrenarse sobre datos de PVGIS, y la fórmula física independiente no aporta información adicional discriminante [@almarzooqi2024hybrid].

### Métricas obtenidas y análisis del error

El modelo Random Forest seleccionado se evalúa sobre el conjunto de prueba con métricas estándar para tareas de regresión [@pedregosa2011sklearn]. El **R² global** —calculado sobre la totalidad de las horas, incluidas las nocturnas— alcanza el valor de **0,8989**, indicando que el modelo explica aproximadamente el 90 por ciento de la varianza total de la producción. Sin embargo, para la interpretación operativa resulta más relevante el **R² diurno**, evaluado únicamente sobre las horas en que el sol está sobre el horizonte y la predicción tiene utilidad práctica: este valor es de **0,7895**.

El **nRMSE diurno** —error cuadrático medio normalizado por la capacidad nominal del sistema— se sitúa en el **11,4 por ciento**, y el **nMAE diurno** en el **7,54 por ciento**. Estos valores se encuentran dentro del rango reportado por la literatura comparativa para modelos de ensemble sobre datos de series temporales fotovoltaicas con separación cronológica [@leholo2026slrsolar; @taha2025zafarana].

La separación cronológica utilizada para la evaluación —predicción sobre 2015 con entrenamiento hasta 2014— es más restrictiva que una validación cruzada aleatoria y proporciona una estimación conservadora del error real en operación. Un modelo ajustado periódicamente con los datos más recientes disponibles puede mejorar este valor de forma consistente, lo que constituye una línea natural de continuidad del trabajo.

### Importancia de las características

La Figura \ref{fig:importance-solar} presenta el ranking de importancia de características aprendido por el modelo.

![Importancia de características del modelo Random Forest solar (Havana v1).](feature_importance_solar.png){#fig:importance-solar width=85%}

La **irradiancia de onda corta** (*shortwave radiation*) emerge como la variable dominante, seguida por el **índice de claridad** (*clearsky index*) y la **elevación solar**. Esta jerarquía es coherente con los principios físicos del fenómeno fotovoltaico: la potencia entregada es aproximadamente proporcional a la radiación incidente, modulada por la posición del sol en el cielo y por la transparencia de la atmósfera en cada momento [@trull2025folsom]. La concordancia entre el ranking aprendido estadísticamente y el conocimiento físico previo constituye un indicador cualitativo de validez del modelo, adicional a las métricas cuantitativas.

Las variables derivadas de pvlib (clearsky GHI, solar elevation, effective irradiance) ocupan posiciones relevantes en el ranking, lo que justifica su incorporación al conjunto de características y confirma la utilidad del enfoque de ingeniería de características basado en física solar para el problema planteado [@almarzooqi2024hybrid].

### Perfil de producción simulado

La validación se complementa con una demostración cualitativa del comportamiento del modelo bajo escenarios meteorológicos contrastados. La Figura \ref{fig:perfil-diario} presenta el factor de capacidad horario predicho para un día soleado de junio y para un día nublado de noviembre, ambos para las coordenadas de La Habana, con variables meteorológicas calculadas mediante pvlib.

![Perfil de producción diaria simulado — día soleado vs nublado (factor de capacidad, modelo Havana v1).](perfil_produccion_diaria.png){#fig:perfil-diario width=85%}

Los perfiles simulados reproducen el patrón esperado: producción nula en horas nocturnas, ascenso pronunciado desde el amanecer, pico en torno al mediodía solar y descenso simétrico en las horas vespertinas. La atenuación característica del día nublado respecto al día soleado se modela correctamente, lo que confirma que el modelo ha aprendido la interacción entre cobertura nubosa, índice de claridad e irradiancia efectiva. En operación, el factor de capacidad predicho se multiplica por la capacidad instalada total, leída en tiempo real desde los documentos de paneles configurados en la base de datos MongoDB, ajustándose automáticamente a cualquier variación en la instalación sin necesidad de reentrenar el modelo. El siguiente epígrafe aborda la validación del segundo componente analítico del sistema: el subsistema de diagnóstico visual del estado de los paneles.
