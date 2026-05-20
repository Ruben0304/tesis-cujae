## Tecnologías de soporte: comparativa y análisis de idoneidad

Las secciones precedentes han identificado las capacidades requeridas por un gemelo digital para la gestión energética y mantenimiento predictivo de una microrred fotovoltaica aislada: monitoreo en tiempo real, predicción de producción solar, predicción de demanda, detección de anomalías y simulación de escenarios. La materialización de estas capacidades exige conjugar tecnologías específicas dentro de un amplio conjunto de alternativas disponibles. La presente sección compara las familias tecnológicas candidatas agrupadas por su rol funcional —frontend, backend, persistencia y soporte— y, sobre la base del análisis, sintetiza cuáles resultan más adecuadas para sistemas de este tipo.

### Tecnologías de frontend

El componente de frontend se ocupa de la presentación del estado del gemelo digital al operador, de la interactividad de los controles y de la comunicación con los servicios de respaldo [@nextjs2024docs; @react2024docs]. En el ecosistema actual conviven varios *frameworks* maduros que soportan los modos de renderizado discutidos en la sección 1.2.2, con perfiles diferenciados en lenguaje base, paradigma de composición y ecosistema asociado. La Tabla \ref{tbl:frontend} sintetiza las alternativas analizadas.

| Tecnología | Lenguaje base | Descripción y características relevantes |
|---|---|---|
| **Next.js** | React (TypeScript/JavaScript) | Framework *full-stack* con renderizado híbrido (SSR + hidratación), enrutador App Router, soporte nativo de rutas API y despliegue *serverless* inmediato; ecosistema React maduro y amplia documentación [@nextjs2024docs; @react2024docs] |
| **Nuxt** | Vue.js | Equivalente conceptual a Next.js sobre Vue; soporta SSR, generación estática y SPA mediante el motor Nitro; menor superficie sintáctica para desarrolladores acostumbrados a HTML |
| **SvelteKit** | Svelte | Basado en un compilador que produce *bundles* notablemente más ligeros que sus competidores; SSR con hidratación selectiva; ecosistema en crecimiento pero menos extenso que React o Vue |
| **Remix** | React | Centrado en patrones de carga de datos con *loaders* y *actions* del lado del servidor; comparte ecosistema con React pero su comunidad es más reducida que la de Next.js |

: Frameworks de frontend candidatos. {#tbl:frontend}

Las cuatro alternativas son técnicamente viables para los requisitos planteados por un sistema de este tipo [@nextjs2024docs; @react2024docs]. Las diferencias dominantes residen en la madurez del ecosistema, en la curva de aprendizaje para el equipo de desarrollo y en la calidad del soporte documental disponible, criterios particularmente relevantes en un proyecto de pregrado con plazos acotados.

### Tecnologías de backend

El componente de backend aloja la lógica de negocio, expone los servicios de cálculo y predicción, integra los modelos de aprendizaje automático y media el acceso a la base de datos [@fastapi2024docs; @pedregosa2011sklearn]. En este nivel conviven *frameworks* basados en distintos lenguajes, con compromisos diferentes entre velocidad de desarrollo, desempeño y compatibilidad con el ecosistema científico. La Tabla \ref{tbl:backend} sintetiza las alternativas analizadas.

| Tecnología | Lenguaje base | Descripción y características relevantes |
|---|---|---|
| **FastAPI** | Python | Framework ASGI asíncrono de alto desempeño; tipado nativo mediante *Pydantic* con validación automática de entrada; generación automática de documentación OpenAPI; integración inmediata con el ecosistema científico de Python (scikit-learn, TensorFlow, pandas) [@fastapi2024docs] |
| **Django** | Python | Framework monolítico maduro con ORM propio, panel de administración integrado y autenticación de fábrica; convenciones rígidas que aceleran proyectos típicos pero limitan la integración asíncrona [@khan2026energyconsumption] |
| **Flask** | Python | Micro-framework minimalista de larga trayectoria; máxima flexibilidad pero requiere componer manualmente cada capa (autenticación, ORM, validación), lo que incrementa el coste de desarrollo |
| **Express** | Node.js | Estándar *de facto* en el ecosistema Node; minimalista y basado en *middleware*; comparte runtime con el frontend pero carece del ecosistema científico de Python |

: Frameworks de backend candidatos. {#tbl:backend}

La elección entre alternativas de Python y de Node.js en este nivel responde principalmente a la disponibilidad de bibliotecas científicas: el ecosistema de Python para aprendizaje automático y procesamiento numérico no tiene equivalente en JavaScript [@pedregosa2011sklearn; @fastapi2024docs]. Dentro del propio Python, FastAPI ha consolidado durante los últimos años una posición competitiva frente a Django y Flask por su modelo asíncrono y por su soporte nativo de tipado, características alineadas con las necesidades de un sistema integrado con componentes de aprendizaje automático.

### Sistemas gestores de bases de datos

El componente de persistencia almacena la configuración del sistema —paneles, baterías, perfiles de consumo, programaciones— y los históricos operativos generados por el monitoreo continuo [@cattell2011nosql; @mongodb2024docs]. Las alternativas pertenecen a tres familias estructurales discutidas en la sección 1.2.2. La Tabla \ref{tbl:bd} sintetiza las opciones más representativas.

| Tecnología | Modelo | Descripción y características relevantes |
|---|---|---|
| **MongoDB** | NoSQL documental | Almacena documentos en formato JSON/BSON con esquema flexible; admite consultas ricas, índices secundarios y agregaciones; afinidad natural con los objetos manipulados en aplicaciones web; *drivers* oficiales para Node.js y Python [@mongodb2024docs; @carvalho2023nosql] |
| **PostgreSQL** | Relacional | SQL completo con soporte avanzado; garantías ACID y integridad referencial estricta; admite tipos JSON nativos pero conserva la rigidez relacional para el resto del esquema [@codd1970relational] |
| **InfluxDB** | Series temporales | Optimizada para ingesta masiva de eventos con marca temporal y consultas analíticas sobre ventanas de tiempo; mecanismos nativos de retención y compresión; lenguaje de consulta específico [@atzori2010iot] |
| **TimescaleDB** | Híbrida (series temporales sobre PostgreSQL) | Extensión de PostgreSQL que añade capacidades de series temporales sin renunciar al modelo relacional ni al lenguaje SQL; permite combinar ambos paradigmas en una misma instancia |

: Sistemas gestores de bases de datos candidatos. {#tbl:bd}

La idoneidad de cada alternativa depende del perfil dominante de los datos. Cuando la carga combina lecturas temporales de frecuencia moderada con configuraciones de esquema evolutivo y no se requiere transaccionalidad estricta entre múltiples agregados, el modelo documental ofrece el mejor compromiso entre flexibilidad y desempeño [@carvalho2023nosql]. Las bases de datos de series temporales aportan ventajas operativas cuando el volumen de eventos por unidad de tiempo es elevado, escenario que solo emerge en despliegues con instrumentación densa y prolongada en el tiempo.

### Otras tecnologías de soporte

Al margen del trío frontend/backend/persistencia, un gemelo digital de microrred fotovoltaica requiere tecnologías complementarias para visualización web, aprendizaje automático y obtención de datos meteorológicos. Estas categorías admiten alternativas múltiples, pero su discriminación se resuelve principalmente sobre criterios técnicos individuales sin requerir tablas separadas. La Tabla \ref{tbl:otras} resume las alternativas relevantes para cada categoría.

| Categoría | Alternativas representativas | Criterio dominante |
|---|---|---|
| Biblioteca de visualización web | D3.js (imperativa de bajo nivel), **Recharts** (declarativa sobre React), Chart.js, Plotly | Integración con el framework de componentes y velocidad de desarrollo [@bostock2011d3; @recharts2024docs] |
| Biblioteca de ML tabular | **scikit-learn**, XGBoost, LightGBM | Madurez del ecosistema y disponibilidad de algoritmos clásicos (Random Forest, Gradient Boosting) [@pedregosa2011sklearn; @breiman2001randomforests; @chen2016xgboost] |
| Marco de ML profundo para visión | **TensorFlow / Keras**, PyTorch, JAX | Soporte de *transfer learning* sobre modelos preentrenados y herramientas de despliegue [@sandler2018mobilenetv2; @pan2010transfer] |
| Arquitectura CNN ligera para visión | **MobileNetV2**, ResNet, EfficientNet, VGG | Equilibrio entre exactitud y coste de inferencia sobre hardware estándar [@sandler2018mobilenetv2] |
| Fuente de datos meteorológicos | **Open-Meteo**, OpenWeather, NASA POWER, AccuWeather, Copernicus | Coste recurrente, granularidad temporal y disponibilidad de la variable de irradiancia [@openmeteo2024] |

: Otras tecnologías de soporte. {#tbl:otras}

La idoneidad relativa entre alternativas en estas categorías se apoya en el equilibrio entre madurez de la herramienta y compatibilidad con el resto del stack [@recharts2024docs; @sandler2018mobilenetv2]. Las bibliotecas declarativas y las arquitecturas ligeras tienden a imponerse cuando se busca minimizar el tiempo de desarrollo sin sacrificar significativamente la calidad del resultado, situación habitual en proyectos académicos.

### Tecnologías más adecuadas para un gemelo digital de microrred fotovoltaica aislada

A partir del análisis precedente, la Tabla \ref{tbl:tecnologias-adecuadas} resume las tecnologías que resultan más adecuadas en cada categoría funcional para un gemelo digital aplicado al dominio que esta investigación aborda. Los párrafos que siguen explican, para cada categoría, los criterios técnicos que justifican esa idoneidad.

| Categoría | Tecnología más adecuada |
|---|---|
| Frontend | **Next.js** sobre **React** con **TypeScript** |
| Backend | **FastAPI** sobre **Python** |
| Base de datos | **MongoDB** |
| Comunicación API | **REST** + **GraphQL** en arquitectura híbrida |
| Biblioteca de visualización | **Recharts** |
| ML para predicción solar | **scikit-learn** con **Random Forest** |
| ML para detección visual | **TensorFlow / Keras** con **MobileNetV2** (*transfer learning*) |
| Fuente meteorológica | **Open-Meteo** |

: Tecnologías más adecuadas por categoría. {#tbl:tecnologias-adecuadas}

En el plano del frontend, **Next.js sobre React con TypeScript** destaca como la opción más adecuada por tres razones convergentes [@nextjs2024docs; @react2024docs; @typescript2024docs]. La primera es el soporte nativo de renderizado híbrido, que ataca directamente el requisito de combinar tiempos de primera carga reducidos con interactividad sostenida, propio de un panel de monitoreo en tiempo real. La segunda es la madurez del ecosistema React, que aporta abundantes bibliotecas de componentes y soporte documental, lo que reduce el tiempo necesario para implementar interfaces complejas. La tercera es la disciplina que impone TypeScript al tipado de los datos que circulan entre la capa de servicios y la capa de componentes, particularmente relevante en sistemas con estructuras complejas como configuraciones de paneles y baterías o series de predicciones horarias.

En el plano del backend, **FastAPI sobre Python** emerge como la alternativa más pertinente por tres razones complementarias [@fastapi2024docs; @pedregosa2011sklearn]. La primera es la cercanía con el ecosistema científico de Python, sin equivalente en otros lenguajes, lo que permite alojar los modelos de aprendizaje automático en el mismo proceso que los servicios de dominio sin recurrir a integraciones interprocedurales. La segunda es el modelo asíncrono basado en ASGI, que sostiene adecuadamente las consultas concurrentes a la API meteorológica y a la base de datos. La tercera es el tipado nativo mediante Pydantic y la generación automática de documentación OpenAPI, características que reducen la fricción de desarrollo y mejoran la trazabilidad de los contratos entre componentes.

En el plano de la persistencia, **MongoDB** resulta la opción más adecuada en respuesta al perfil específico de los datos que maneja un gemelo digital de este tipo [@mongodb2024docs; @carvalho2023nosql]. Las configuraciones del sistema —paneles, baterías, perfiles horarios de consumo, programaciones de apagón— evolucionan a lo largo del ciclo de vida del proyecto a medida que se modelan nuevas características, lo que beneficia la flexibilidad documental sobre la rigidez del esquema relacional. El volumen de las lecturas históricas en despliegues operativos típicos de este dominio no alcanza la magnitud que justificaría asumir la complejidad operacional de una base de datos de series temporales dedicada.

En el plano de la comunicación, una **arquitectura híbrida REST + GraphQL** resulta más adecuada que el uso exclusivo de cualquiera de los dos estilos, asignando cada uno al subconjunto de consultas que mejor lo aprovecha [@fielding2000rest; @elghazal2025restgraphql; @lawi2021graphqlrest]. REST cubre con menor sobrecarga las operaciones simples y de patrón predecible originadas directamente desde la interfaz de usuario; GraphQL cubre con mayor eficiencia las consultas agregadas que combinan en una sola petición datos solares, meteorológicos, predicciones y estado de baterías, donde el modelo declarativo de consulta reduce el sobrefetching y mejora el desempeño percibido.

En el plano de la visualización, **Recharts** destaca por su integración nativa con React y por la velocidad de desarrollo que ofrece su modelo declarativo, frente a bibliotecas imperativas de bajo nivel como D3.js [@recharts2024docs; @bostock2011d3]. La complejidad gráfica habitual en un panel de control de gemelo digital —líneas de producción horaria, áreas apiladas de flujo energético, indicadores circulares de batería— se cubre sin necesidad de descender al nivel primitivo que aportaría D3 directamente.

Para la **predicción de producción solar**, **scikit-learn con Random Forest** destaca como la opción más adecuada por dos razones [@pedregosa2011sklearn; @breiman2001randomforests]. La primera es la evidencia comparativa reciente, revisada en la sección 1.4.2, que posiciona a Random Forest como referencia competitiva en horizontes intradía y de hasta veinticuatro horas, con desempeño igual o superior a alternativas más complejas y un coste computacional sustancialmente menor. La segunda es la integración inmediata con scikit-learn como biblioteca canónica del ecosistema, lo que reduce el coste de desarrollo y facilita la reproducibilidad de los experimentos.

Para la **detección visual del estado de los paneles**, **MobileNetV2 sobre TensorFlow/Keras con *transfer learning*** resulta la combinación más adecuada por el equilibrio que ofrece entre exactitud y coste de inferencia [@sandler2018mobilenetv2; @pan2010transfer]. La arquitectura ligera de MobileNetV2 permite ejecutar la clasificación sobre hardware estándar sin requerir aceleración por GPU dedicada en tiempo de inferencia, y el aprendizaje por transferencia desde pesos preentrenados sobre ImageNet reduce drásticamente los datos y el tiempo de entrenamiento necesarios.

Finalmente, **Open-Meteo** emerge como la fuente meteorológica más adecuada por tres criterios [@openmeteo2024]. El acceso es libre y sin autenticación, lo que evita dependencias contractuales en proyectos académicos. La granularidad horaria sobre un horizonte de hasta siete días es suficiente para los modelos predictivos contemplados. Y la disponibilidad nativa de la irradiancia global horizontal —variable física directamente correlacionada con la producción fotovoltaica— evita derivaciones secundarias a partir de variables proxy menos exactas.

Conviene matizar, no obstante, que ninguna fuente meteorológica es universalmente óptima. La calidad de las predicciones de cada proveedor depende de la densidad de la red de observaciones que alimenta sus modelos numéricos subyacentes, densidad que varía considerablemente entre regiones geográficas y que se traduce en diferencias apreciables de exactitud entre proveedores para un mismo emplazamiento [@leholo2026slrsolar; @dhimish2025reliability; @almarzooqi2024hybrid]. Por esta razón, aunque Open-Meteo resulta la opción más conveniente para los emplazamientos cubiertos adecuadamente por sus modelos subyacentes, un gemelo digital con vocación de generalización a entornos diversos requiere contemplar la posibilidad de operar con fuentes alternativas como OpenWeather, NASA POWER o servicios regionales especializados, según el emplazamiento concreto donde se despliegue [@openmeteo2024; @atzori2010iot]. La capa de obtención de datos meteorológicos de un sistema de este tipo debe diseñarse, en consecuencia, sin acoplamiento rígido a una única API.

El conjunto de tecnologías sintetizado en la Tabla \ref{tbl:tecnologias-adecuadas} constituye una respuesta coherente con las tendencias contemporáneas del desarrollo de sistemas web y de gemelos digitales aplicados al sector energético [@nextjs2024docs; @said2026aidt]. La combinación responde a un equilibrio entre madurez tecnológica, accesibilidad para equipos académicos y capacidad operativa real, evitando tanto la sobreingeniería como la simplicidad insuficiente para los requisitos del dominio.
