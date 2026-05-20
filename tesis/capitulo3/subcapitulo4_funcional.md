## Validación funcional del software

La validación analítica de los modelos predictivos no agota la verificación del sistema: un modelo de inteligencia artificial puede ser correcto y, sin embargo, integrarse defectuosamente con las funciones de cálculo, los servicios de dominio y las interfaces de presentación que lo exponen al usuario. Este epígrafe describe el segundo nivel de validación, orientado a la corrección del software que materializa el gemelo digital, mediante pruebas unitarias automatizadas sobre las dos capas que componen la implementación: el backend Python y el frontend TypeScript.

### Estrategia de pruebas

La estrategia de pruebas adoptada se ajusta al modelo conocido como pirámide de pruebas, ampliamente aceptado en la práctica contemporánea de ingeniería de software [@pytest2024docs; @vitest2024docs]. En este modelo, el grueso del esfuerzo se concentra en pruebas unitarias rápidas y deterministas, mientras que las pruebas de integración y las pruebas de extremo a extremo se aplican selectivamente sobre los flujos críticos.

El alcance de la validación funcional documentada en el presente trabajo se circunscribe deliberadamente al nivel **unitario**, ejercitado sobre las **funciones puras** de cálculo y los servicios cuyo comportamiento puede verificarse sin dependencias externas como bases de datos o servicios remotos [@pytest2024docs]. Esta delimitación responde a dos consideraciones: las funciones puras concentran la lógica de negocio crítica del sistema —cálculos energéticos, generación de predicciones, ajustes por escenarios de apagón, hash de credenciales—, y su carácter determinista permite verificarlas con baja varianza y alta velocidad de ejecución. Las pruebas de integración con base de datos y las pruebas de extremo a extremo sobre la interfaz web quedan fuera del alcance del presente trabajo, en línea con la práctica habitual en proyectos de pregrado con restricciones de tiempo y de complejidad.

Los marcos seleccionados son **pytest** [@pytest2024docs] para el backend Python y **Vitest** [@vitest2024docs] para el frontend TypeScript. Ambos comparten la filosofía de minimizar el código necesario para expresar una prueba, organizar las pruebas por bloques temáticos y producir reportes legibles sobre el resultado de la ejecución. La elección de Vitest sobre alternativas como Jest se justifica por su mejor integración con el ecosistema Vite, sobre el que se basa el entorno de desarrollo del frontend [@vitest2024docs].

### Pruebas del backend en Python con pytest

El módulo de pruebas del backend totaliza **86 pruebas unitarias** distribuidas en tres archivos, cada uno asociado a un servicio crítico del sistema. La Tabla \ref{tbl:backend-tests} resume la distribución de las pruebas y las funciones cubiertas por cada archivo.

| Archivo                          | Pruebas | Funciones y servicios cubiertos                                    |
|----------------------------------|---------|--------------------------------------------------------------------|
| `test_prediction_service.py`     | 37      | Cálculo de producción horaria, factores de eficiencia, confianza, temperatura horaria estimada, ajuste por apagones |
| `test_analytics.py`              | 18      | Métricas energéticas globales, balance, totales diarios, CO$_2$ evitado, flujos de energía multi-origen |
| `test_user_service.py`           | 31      | Normalización de correos, hashing con *scrypt*, validación de roles, mapeo de documentos de usuario |
| **Total**                        | **86**  |                                                                    |

: Distribución de pruebas unitarias en el backend Python. {#tbl:backend-tests}

Las pruebas de `test_prediction_service.py` constituyen el conjunto más extenso y abordan el corazón analítico del backend [@pytest2024docs]. Verifican que el cálculo de producción horaria responde correctamente a los factores de eficiencia esperados según la hora del día (potencia nula antes de las 6 y después de las 19 horas, factor unitario en el pico solar entre las 12 y las 14, decrecimiento simétrico hacia las horas extremas del día), que el cálculo de la confianza de predicción combina adecuadamente las variables meteorológicas, y que los ajustes por escenarios de apagón modifican la producción y el consumo previstos en los porcentajes documentados en el Capítulo 2.

Las pruebas de `test_analytics.py` cubren las funciones que producen las métricas globales del sistema mostradas al usuario: balance energético instantáneo, producción y consumo acumulados diariamente, dióxido de carbono evitado en función de la producción solar acumulada, y la distribución del flujo de energía entre los cinco caminos posibles (de generación a carga, a batería, a la red; de batería a carga; de red a carga). Cada escenario relevante —generación superior al consumo, déficit, batería llena, batería vacía— se verifica mediante un caso de prueba específico.

Las pruebas de `test_user_service.py` se concentran en el subsistema de autenticación, abarcando la normalización de correos a su forma canónica, el comportamiento del esquema de hashing basado en *scrypt* —cuya correcta implementación es crítica para la seguridad de las credenciales—, y la validación de los roles admitidos por el sistema. La cobertura de esta funcionalidad mediante pruebas automatizadas reduce el riesgo de regresiones en un dominio especialmente sensible.

### Pruebas del frontend en TypeScript con Vitest

El módulo de pruebas del frontend totaliza **77 pruebas unitarias** distribuidas en dos archivos, dedicados a las funciones puras de cálculo y de generación de predicciones del lado del cliente. La Tabla \ref{tbl:frontend-tests} resume la distribución.

| Archivo                       | Pruebas | Funciones cubiertas                                                |
|-------------------------------|---------|--------------------------------------------------------------------|
| `calculations.test.ts`        | 48      | Métricas del sistema, flujo de energía, eficiencia, producción teórica, retorno de inversión, estrategia de batería, Performance Ratio |
| `predictions.test.ts`         | 29      | Generación de predicciones horarias, integración con escenarios de apagón, generación de alertas |
| **Total**                     | **77**  |                                                                    |

: Distribución de pruebas unitarias en el frontend TypeScript. {#tbl:frontend-tests}

Las pruebas de `calculations.test.ts` verifican siete grupos de funciones puras [@vitest2024docs]. El cálculo de métricas del sistema —producción acumulada, consumo acumulado, balance, dióxido de carbono evitado— se prueba sobre históricos de tamaño y contenido controlado. La función que distribuye la energía entre los cinco caminos posibles del sistema se prueba sistemáticamente sobre todos los escenarios de equilibrio entre generación, consumo y nivel de batería. El cálculo del Performance Ratio según la norma IEC 61724-1 se prueba sobre valores de referencia con resultado esperado conocido. La estrategia de batería —decisión entre carga, descarga y reposo— se prueba sobre todos los puntos de transición del algoritmo documentado en el Capítulo 2.

Las pruebas de `predictions.test.ts` cubren la generación de la serie de predicciones horarias para las próximas 24 horas, su integración con los escenarios de apagón configurados por el usuario, y la generación de alertas categorizadas por severidad cuando los indicadores rebasan los umbrales operativos. La verificación incluye casos en los que el apagón se solapa parcialmente con el horizonte de predicción, situación que el algoritmo debe tratar específicamente.

### Cobertura y síntesis

Considerando ambos conjuntos, el sistema acumula **163 pruebas unitarias automatizadas** que ejecutan en una fracción de segundo y verifican la totalidad de las funciones puras críticas del backend y del frontend. La organización por archivos por dominio (predicción, analítica, autenticación, cálculos, predicciones) facilita la lectura del reporte de ejecución y la localización de fallos cuando una prueba falla.

Las limitaciones de la estrategia adoptada son explícitas. La validación no cubre el comportamiento del sistema bajo cargas concurrentes, ni las pruebas de extremo a extremo sobre la interfaz web, ni las pruebas de integración con la base de datos MongoDB. La cobertura del comportamiento ante fallos de las API externas (notablemente Open-Meteo) tampoco se verifica de manera automatizada, aunque el código contiene mecanismos de respaldo descritos en el Capítulo 2. Estas limitaciones se contemplan en el capítulo de Recomendaciones como vías de continuidad del trabajo. Una vez validados los modelos analíticos y el software que los expone, el siguiente epígrafe documenta la prueba operativa del sistema sobre la microrred CUJAE.
