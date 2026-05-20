# Tesis de Diploma — Gemelo Digital para Microrred Fotovoltaica

**Institución:** CUJAE (Instituto Superior Politécnico José Antonio Echeverría), La Habana, Cuba  
**Autor:** Ruben  
**Año:** 2026

**Título:** Gemelo Digital para una Microrred Fotovoltaica: Monitoreo en Tiempo Real, Predicciones Inteligentes y Análisis de Escenarios de Apagón

---

## Qué es este proyecto

Sistema de gemelo digital para una microrred fotovoltaica. Implementa monitoreo en tiempo real, predicciones de producción energética con horizonte de 24 horas usando Machine Learning, y análisis de escenarios de apagón eléctrico en el contexto cubano.

El software está en la carpeta hermana `../tesis_gemelo_digital/` (Next.js 15, React 19, MongoDB, TypeScript). **Esta carpeta contiene únicamente el documento de tesis escrito en Markdown, compilado a PDF con pandoc + XeLaTeX.**

Para entender el software antes de escribir sobre él, leer primero:
- `../tesis_gemelo_digital/CLAUDE.md` — documentación técnica completa del código
- `../tesis_gemelo_digital/src/lib/` — lógica de negocio (cálculos, predicciones, configuración del sistema)
- `../tesis_gemelo_digital/src/app/api/` — endpoints REST
- `../tesis_gemelo_digital/src/app/components/` — componentes React de la UI
- `../tesis_gemelo_digital/src/types/index.ts` — todas las interfaces TypeScript

**No asumir ni inventar valores concretos del sistema** (capacidades, ubicación, parámetros). Leer el código fuente o preguntar al autor.

---

## Estructura de Directorios

```
Cujae/
├── tesis_gemelo_digital/     ← código fuente del software
└── tesis/                    ← ESTA CARPETA
    ├── README.md             ← este archivo (leer primero)
    ├── COMMANDS.md           ← todos los comandos pandoc/build
    ├── index.md              ← YAML de pandoc + orden de compilación
    ├── referencias.bib       ← único archivo BibTeX de la tesis
    │
    ├── introduccion/
    │   └── introduccion.md
    │
    ├── capitulo1/            ← Marco Teórico y Estado del Arte
    │   ├── introduccion.md
    │   ├── subcapitulo1_marco_teorico.md
    │   ├── subcapitulo2_estado_del_arte.md
    │   └── conclusion.md
    │
    ├── capitulo2/            ← Diseño e Implementación
    │   ├── introduccion.md
    │   ├── subcapitulo1_arquitectura_sistema.md
    │   ├── subcapitulo2_implementacion.md
    │   ├── subcapitulo3_modelos_ml.md
    │   └── conclusion.md
    │
    ├── capitulo3/            ← Validación, Resultados y Análisis
    │   ├── introduccion.md
    │   ├── subcapitulo1_validacion_modelos.md
    │   ├── subcapitulo2_resultados_experimentales.md
    │   ├── subcapitulo3_analisis_escenarios.md
    │   └── conclusion.md
    │
    ├── conclusion/
    │   └── conclusion.md
    │
    ├── extras/
    │   ├── resumen_es.md     ← resumen en español (≤300 palabras)
    │   ├── resumen_en.md     ← abstract en inglés (≤300 palabras)
    │   ├── prologo.md
    │   └── agradecimientos.md
    │
    └── recursos/
        ├── capturas/         ← screenshots del software
        ├── validacion/       ← gráficas de validación de modelos ML
        └── figuras/          ← diagramas de arquitectura, UML, esquemas
```

---

## Contenido de Cada Capítulo

### Capítulo 1 — Marco Teórico y Estado del Arte
Fundamentos teóricos: gemelos digitales, microrredes fotovoltaicas, almacenamiento en baterías, integración climática. Revisión de trabajos previos. Identifica las brechas que justifican esta investigación.

### Capítulo 2 — Diseño e Implementación
Arquitectura del sistema, stack tecnológico, diseño de base de datos, algoritmos de cálculo de producción solar, estrategia de batería, motor de predicciones, modelos de ML. Todo lo que se describe aquí **debe verificarse contra el código real** en `../tesis_gemelo_digital/`.

### Capítulo 3 — Validación, Resultados y Análisis
Validación de modelos contra datos reales, métricas de error, análisis de escenarios de apagón, evaluación de resiliencia energética.

---

## Estructura Interna de Cada Archivo Markdown

Todos los archivos deben seguir **exactamente** este esquema de encabezados. No hay excepciones.

### Archivos `capitulo*/introduccion.md`
```markdown
# Capítulo N: Título del Capítulo

## Introducción al capítulo

Texto...
```

### Archivos `capitulo*/subcapituloN_*.md`
```markdown
## Título de la Sección Principal

### Título de Subsección

Texto...

### Otra Subsección

Texto...
```

### Archivos `capitulo*/conclusion.md`
```markdown
## Conclusiones del Capítulo N

Texto...
```

### `introduccion/introduccion.md` y `conclusion/conclusion.md`
```markdown
# Título (Introducción General / Conclusiones Generales)

## Primera sección

Texto...
```

### `extras/*.md`
```markdown
# Título (Resumen / Abstract / Prólogo / Agradecimientos)

Texto...
```

**Regla crítica de encabezados:**
- `#` (H1): solo en `introduccion.md` de cada capítulo y en los archivos de `introduccion/`, `conclusion/` y `extras/`
- `##` (H2): secciones principales — en todos los demás archivos es el nivel inicial
- `###` (H3): subsecciones
- No usar `####` ni niveles más profundos — pandoc los aplana incorrectamente en LaTeX

**Ningún archivo de capítulo lleva bloque YAML `---` al inicio.** Solo `index.md` tiene frontmatter YAML.

---

## Convenciones de Marcado (usar siempre estas, nunca otras)

### Citas bibliográficas
```markdown
Según Grieves [-@grieves2014digital], el gemelo digital es...
El concepto fue formalizado en [@grieves2014digital].
Múltiples autores coinciden [@ref1; @ref2; @ref3].
```
Todas las claves deben existir en `referencias.bib`. Ver sección de verificación en `COMMANDS.md`.

### Figuras
```markdown
![Descripción de la figura.](../recursos/capturas/nombre_imagen.png){width=80%}
```
- Ruta **relativa al archivo `.md` que la referencia**, no a la raíz de `tesis/`
- Siempre incluir `{width=XX%}` para control de tamaño en LaTeX
- Siempre terminar la descripción con punto

### Tablas
```markdown
| Columna A | Columna B | Columna C |
|-----------|-----------|-----------|
| valor     | valor     | valor     |

: Título de la tabla. {#tbl:etiqueta}
```
Para tablas que requieren formato complejo usar LaTeX directo en el `.md`:
```latex
\begin{table}[h]
\centering
\caption{Título}
...
\end{table}
```

### Ecuaciones
Inline: `$símbolo$` o `$fórmula$`

Bloque numerado:
```markdown
$$
P = \frac{G \cdot A \cdot \eta}{1000}
$$ {#eq:etiqueta}
```

### Bloques de código fuente
````markdown
```typescript
const ejemplo = true;
```
````
Siempre especificar el lenguaje (`typescript`, `python`, `bash`, `json`, etc.).

### Énfasis
- **Negrita** `**texto**`: términos técnicos la primera vez que aparecen, nombres de componentes del sistema
- *Cursiva* `*texto*`: títulos de obras, palabras en otro idioma, énfasis suave
- No mezclar `__doble_guión__` ni `_guión_simple_` — usar solo `**` y `*`

### Listas
Usar `-` para listas no ordenadas (nunca `*` ni `+`). Usar `1.` para listas ordenadas.

### Referencias cruzadas internas
```markdown
Como se muestra en la Figura \ref{fig:etiqueta}...
Ver la Tabla \ref{tbl:etiqueta}...
La ecuación \ref{eq:etiqueta} describe...
```

---

## Reglas para Agentes

1. **Leer el código antes de escribir sobre él.** Los valores concretos del sistema (parámetros, algoritmos, métricas) están en `../tesis_gemelo_digital/src/lib/`. No inventar ni suponer.

2. **Respetar la estructura de encabezados.** Un subcapítulo nunca abre con `#`. Un `introduccion.md` de capítulo siempre abre con `#`. Ver la sección anterior.

3. **No crear archivos `.bib` adicionales.** Todo va en `referencias.bib`.

4. **No renombrar archivos existentes** sin actualizar `index.md` y `COMMANDS.md` simultáneamente.

5. **Las imágenes van en `recursos/`** según tipo. La ruta en el markdown es relativa al `.md` que la usa.

6. **Al añadir un subcapítulo nuevo**: crear el archivo → añadirlo en `index.md` → añadirlo en todos los comandos de `COMMANDS.md`. En ese orden.

7. **Idioma:** cuerpo de la tesis en español formal. Solo `extras/resumen_en.md` en inglés.

8. **Para compilar:** ver `COMMANDS.md`. No improvisar flags de pandoc.
