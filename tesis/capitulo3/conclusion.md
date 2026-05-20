## Conclusiones parciales {.unnumbered}

La validación desarrollada en el presente capítulo permite extraer las siguientes conclusiones, que sustentan la afirmación de cumplimiento de los objetivos de la investigación:

1. La estrategia de validación adoptada combina tres niveles complementarios —analítico, funcional y operativo— que cubren conjuntamente la corrección de los modelos predictivos, la calidad del software que los expone y la pertinencia del sistema completo en condiciones reales. Esta integración multinivel resulta indispensable para sustentar la utilidad operativa de un gemelo digital, ya que ningún nivel aislado agota la verificación del sistema.

2. El subsistema de predicción de la producción solar, basado en Random Forest, alcanza un coeficiente de determinación de 0,8543 y un error absoluto medio equivalente al tres por ciento de la capacidad de referencia del dataset, valores competitivos con los reportados por la literatura comparativa internacional para horizontes intradía. La importancia de variables aprendida por el modelo es coherente con los principios físicos del fenómeno, lo que refuerza cualitativamente la validez de la solución.

3. El subsistema de diagnóstico visual del estado de los paneles, basado en una red convolucional MobileNetV2 entrenada por transferencia, alcanza una precisión del 84,21 por ciento y un AUC-ROC de 0,8373. La calibración del umbral de decisión prioriza la fiabilidad de las alertas sobre la cobertura exhaustiva, opción coherente con el paradigma del mantenimiento basado en condición discutido en el Capítulo 1.

4. El software que materializa el gemelo digital se verifica mediante 163 pruebas unitarias automatizadas distribuidas entre el backend Python y el frontend TypeScript, que cubren la totalidad de las funciones puras críticas de cálculo, predicción, generación de alertas y autenticación. La estrategia adoptada concentra el esfuerzo en pruebas deterministas de alta velocidad, en línea con las prácticas habituales de la ingeniería de software contemporánea.

5. La operación del sistema completo sobre la microrred fotovoltaica de la CUJAE confirma que las decisiones de diseño documentadas en el Capítulo 2 se sostienen en condiciones reales y que la propiedad de transferibilidad geográfica del paradigma se materializa mediante la configuración por datos en la base documental, sin requerir modificaciones al código fuente para su despliegue en otros emplazamientos. Esta propiedad valida la vocación de aplicabilidad general del trabajo propuesto.
