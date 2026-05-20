## Arquitectura del Sistema

### Descripción General de la Arquitectura

[Diagrama y descripción de la arquitectura en tres capas: API, servicios, UI...]

### Stack Tecnológico

A partir de las familias de tecnologías analizadas en el Capítulo 1, se concretó para el presente sistema un conjunto específico de herramientas y versiones. La presente sección documenta cada decisión y la justifica en términos de los criterios académicos discutidos en el marco teórico y en el estado del arte.

#### Capa de presentación y servidor de aplicaciones: Next.js 15 sobre React 19

Como framework *full-stack* se seleccionó **Next.js** en su versión 15, ejecutándose sobre **React** en su versión 19 [@nextjs2024docs; @react2024docs]. Esta elección se sustenta en los criterios discutidos en la Sección 1 del marco teórico relativos al renderizado híbrido: el sistema requiere simultáneamente tiempos de primera carga reducidos —dado que se contempla su uso desde redes con ancho de banda variable propias del entorno cubano— e interactividad sostenida para la actualización continua de las métricas. Next.js 15 aporta, mediante su modelo de App Router, una integración nativa de componentes de servidor (Server Components) y componentes de cliente (Client Components), lo que permite ubicar la carga computacional pesada del lado del servidor sin renunciar a la reactividad de la interfaz. La preferencia por Next.js sobre alternativas equivalentes como Remix o Nuxt obedece a la mayor madurez de su ecosistema en torno a React, a la disponibilidad inmediata de despliegues serverless y al amplio soporte documental disponible, factores que favorecen la mantenibilidad del proyecto.

#### Lenguaje de programación: TypeScript

El sistema se implementa íntegramente en **TypeScript** [@typescript2024docs]. La adopción de un lenguaje con sistema de tipos estático responde a dos consideraciones técnicas: en primer lugar, las interfaces que viajan entre la capa de servicios y la capa de componentes —objetos meteorológicos, configuraciones de paneles, estados de batería, escenarios de apagón— poseen una estructura no trivial cuya consistencia es crítica para la corrección del cálculo energético; en segundo lugar, el tipado estático aporta detección temprana de errores y autocompletado contextual, lo que reduce el tiempo de desarrollo y la probabilidad de regresiones en un proyecto manejado por dos autores. La definición centralizada de tipos en el directorio `src/types/` actúa como contrato compartido entre las capas del sistema.

#### Persistencia: MongoDB

Como sistema gestor de base de datos se seleccionó **MongoDB** [@mongodb2024docs]. La elección entre las tres familias analizadas en el marco teórico se resuelve atendiendo al perfil de los datos del sistema. Los esquemas de paneles y baterías evolucionan a lo largo del ciclo de vida del proyecto a medida que se modelan nuevas características eléctricas, lo que beneficia la flexibilidad documental sobre la rigidez del esquema relacional. El volumen de las lecturas históricas es moderado y se concentra en el horizonte de 24 a 168 horas, por lo que no alcanza la magnitud que justificaría asumir la complejidad operacional de una base de datos de series temporales dedicada. Finalmente, los estudios comparativos recientes posicionan a MongoDB favorablemente frente a otras alternativas documentales en términos de rendimiento de inserción y lectura para cargas mixtas [@carvalho2023nosql]. La integración con el resto del stack se realiza mediante el controlador oficial de MongoDB para Node.js, lo que evita la fricción de capas intermedias de mapeo objeto-documento.

#### Estilo de comunicación: arquitectura híbrida REST + GraphQL

La comunicación entre componentes del sistema adopta una **arquitectura híbrida** que combina los dos estilos discutidos en la Sección 1 del marco teórico, asignando a cada uno el subconjunto de consultas para el que la literatura comparativa lo identifica como más apropiado [@elghazal2025restgraphql; @lawi2021graphqlrest]. Esta decisión refleja una observación frecuente en los sistemas web contemporáneos: la dicotomía entre REST y GraphQL no es excluyente, sino que ambos estilos pueden coexistir como capas complementarias.

La **capa REST** [@fielding2000rest] se materializa en las rutas API nativas de Next.js (`src/app/api/`), que atienden las operaciones simples y de patrón predecible originadas directamente desde el navegador: lectura del estado solar instantáneo, obtención de la previsión meteorológica corriente, autenticación de usuarios y operaciones de configuración de paneles, baterías y programaciones de apagón. Para este conjunto de consultas, la literatura reporta mejor desempeño de REST y menor sobrecarga operacional, lo que justifica su empleo como interfaz de proximidad para la interfaz de usuario.

La **capa GraphQL** se aloja en el servicio Python independiente, construido sobre FastAPI mediante la biblioteca **Strawberry GraphQL** [@strawberry2024docs; @fastapi2024docs] y expuesta en el endpoint `/graphql`. Esta capa atiende las consultas que la literatura identifica como caso de uso natural de GraphQL: agregaciones que combinan en una sola petición datos solares, meteorológicos, predicciones del modelo de aprendizaje automático, estado de baterías y programaciones de apagón —recursos heterogéneos que, expuestos mediante REST, requerirían múltiples llamadas concurrentes con sus consiguientes problemas de *sobrefetching* y *subfetching*. La declaración por parte del cliente de exactamente qué campos requiere de cada entidad reduce además el volumen de bytes transferidos, criterio relevante en escenarios de ancho de banda restringido. El esquema GraphQL del backend expone consultas para datos solares, climáticos, predicciones de producción y consumo, configuraciones del sistema y operaciones CRUD sobre el dominio energético.

Desde el frontend, las consultas GraphQL se emiten mediante **urql** [@urql2024docs], un cliente ligero seleccionado sobre alternativas como Apollo Client por su menor superficie de configuración, su soporte nativo para los hooks de React y su modelo de caché basado en documento, suficiente para los patrones de consulta del sistema.

#### Bibliotecas de interfaz y visualización

Para los estilos se adoptó **Tailwind CSS** [@tailwind2024docs] siguiendo un enfoque *utility-first*: la composición de la interfaz mediante clases atómicas predefinidas elimina la necesidad de mantener hojas de estilo paralelas al código de componentes, mejora la coherencia visual del sistema y reduce el tamaño del CSS final mediante eliminación automática de clases no utilizadas en tiempo de compilación.

Para la visualización de las series energéticas se seleccionó **Recharts** [@recharts2024docs]. Recharts es una biblioteca declarativa de alto nivel construida sobre React y SVG, alineada con los criterios discutidos en la sección 2.X del estado del arte: aporta una velocidad de desarrollo notablemente superior a la de bibliotecas imperativas de bajo nivel como D3 puro, sin sacrificar el control compositivo necesario para los gráficos que requiere el sistema (líneas de producción de 24 horas, áreas apiladas de flujo energético, indicadores circulares de batería). Su elección sobre alternativas como Chart.js obedece a la mejor integración con el modelo de componentes de React.

#### Integración meteorológica: Open-Meteo

Como fuente de variables climáticas operacionales se integró la API **Open-Meteo** [@openmeteo2024]. La elección obedece a tres criterios: acceso gratuito y sin autenticación, lo que evita dependencias contractuales en un proyecto académico; granularidad horaria sobre un horizonte de hasta siete días, suficiente para los modelos predictivos contemplados; y disponibilidad nativa de la variable de irradiancia global horizontal, indispensable para los cálculos físicos de producción solar. El sistema implementa un mecanismo de respaldo basado en datos sintéticos generados con perfiles gaussianos calibrados para condiciones típicas de La Habana, que permite la operación continua del gemelo digital ante interrupciones temporales del servicio externo.

#### Servicio backend Python: FastAPI y biblioteca de aprendizaje automático

El sistema incorpora un servicio Python independiente que aloja la lógica de dominio compleja, los modelos de aprendizaje automático y el esquema GraphQL descrito en el apartado anterior. Como framework HTTP de este servicio se seleccionó **FastAPI** [@fastapi2024docs] sobre alternativas como Flask o Django, atendiendo a tres criterios técnicos: el soporte nativo de tipado y validación mediante Pydantic, su generación automática de documentación OpenAPI, y su modelo asíncrono basado en ASGI, que se integra eficientemente con la capa GraphQL de Strawberry.

La separación de este backend del servidor de aplicaciones Next.js obedece a dos consideraciones arquitectónicas. En primer lugar, el ecosistema científico de Python para tareas de modelado predictivo no tiene equivalente en el ecosistema JavaScript, lo que aconseja aislar el aprendizaje automático en su entorno natural. En segundo lugar, el desacoplamiento permite reentrenar y desplegar los modelos sin recompilar la aplicación web principal, lo que reduce el tiempo de iteración durante la fase experimental.

Como biblioteca de aprendizaje automático se adoptó **scikit-learn** [@pedregosa2011sklearn]. La preferencia por scikit-learn frente a TensorFlow o PyTorch se justifica por el algoritmo seleccionado —Random Forest, según la discusión desarrollada en la Sección de Modelos de Machine Learning del presente capítulo—, cuyo entrenamiento e inferencia se resuelven eficientemente en CPU sin requerir la maquinaria de aprendizaje profundo. Esta elección concreta tecnologías sobre los criterios establecidos en la Sección sobre paradigmas de aprendizaje automático del Capítulo 1, donde se documentó la competitividad de los métodos de ensemble frente a alternativas más complejas en horizontes intradía y de 24 horas [@roga2025dnn; @taha2025zafarana].

#### Síntesis del stack

La Tabla \ref{tbl:stack} resume las tecnologías concretas seleccionadas y las versiones desplegadas en el sistema.

| Componente                | Tecnología                    | Versión   | Rol en el sistema                         |
|---------------------------|-------------------------------|-----------|-------------------------------------------|
| Framework web full-stack  | Next.js                       | 15.5.4    | Capa de presentación y rutas API          |
| Biblioteca de UI          | React                         | 19.1.0    | Componentes de interfaz                   |
| Lenguaje                  | TypeScript                    | 5.x       | Tipado estático del frontend y servicios  |
| Base de datos             | MongoDB                       | 6.20      | Persistencia documental                   |
| Estilos                   | Tailwind CSS                  | 4.x       | Sistema de diseño *utility-first*         |
| Visualización             | Recharts                      | 3.2.1     | Gráficos de series energéticas            |
| Cliente GraphQL           | urql                          | 5.0.1     | Consumo del endpoint GraphQL desde React  |
| API meteorológica         | Open-Meteo                    | —         | Fuente operacional de datos climáticos    |
| Lenguaje de backend ML    | Python                        | 3.x       | Lógica de negocio y modelos predictivos   |
| Servidor backend          | FastAPI                       | 0.115.4   | Servicio HTTP del backend Python          |
| Servidor GraphQL          | Strawberry GraphQL            | 0.245.0   | Esquema y resolvers GraphQL sobre FastAPI |
| Biblioteca de ML          | scikit-learn                  | 1.5.2     | Random Forest para predicción solar       |

: Stack tecnológico del sistema. {#tbl:stack}

### Diseño de la Base de Datos

[Colecciones MongoDB: usuarios, paneles, baterías, apagones — esquemas...]

### Capa de APIs del Sistema

[Endpoints REST de Next.js (`src/app/api/`), esquema GraphQL de Strawberry expuesto en `/graphql`, autenticación JWT, manejo de errores y validación de entrada...]
