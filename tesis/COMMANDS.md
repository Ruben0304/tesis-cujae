# Comandos de Compilación — Tesis Gemelo Digital

Referencia de todos los comandos para compilar, verificar y mantener la tesis.  
**Ejecutar siempre desde la raíz de esta carpeta:** `/Users/ruben/projects/Cujae/tesis/`

---

## Requisitos Previos

```bash
# Verificar que pandoc está instalado
pandoc --version

# Verificar que XeLaTeX está instalado (parte de MacTeX o TeX Live)
xelatex --version

# Instalar pandoc (macOS)
brew install pandoc

# Instalar MacTeX completo (incluye XeLaTeX, bibtex, etc.)
brew install --cask mactex

# Instalar pandoc-citeproc (si no viene incluido con pandoc)
brew install pandoc-citeproc
```

---

## Compilación Principal

### PDF completo (producción)
Genera el PDF final con todos los capítulos en orden correcto.

```bash
pandoc \
  index.md \
  extras/resumen_es.md \
  extras/resumen_en.md \
  extras/prologo.md \
  extras/agradecimientos.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  -o tesis.pdf \
  --pdf-engine=xelatex \
  --bibliography=referencias.bib \
  --citeproc \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango
```

### PDF de un capítulo solo (revisión rápida)
Útil cuando se trabaja en un capítulo específico sin recompilar todo.

```bash
# Solo capítulo 1
pandoc \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  -o draft_capitulo1.pdf \
  --pdf-engine=xelatex \
  --bibliography=referencias.bib \
  --citeproc \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V lang=es

# Solo capítulo 2
pandoc \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  -o draft_capitulo2.pdf \
  --pdf-engine=xelatex \
  --bibliography=referencias.bib \
  --citeproc \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V lang=es

# Solo capítulo 3
pandoc \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  -o draft_capitulo3.pdf \
  --pdf-engine=xelatex \
  --bibliography=referencias.bib \
  --citeproc \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V lang=es
```

---

## Formatos Alternativos de Salida

### Word (.docx) — para revisión del tutor
Algunos tutores prefieren Word para comentarios con control de cambios.

```bash
pandoc \
  index.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  -o tesis_revision.docx \
  --bibliography=referencias.bib \
  --citeproc \
  --toc \
  --number-sections
```

### LaTeX puro (.tex) — para inspección o ajuste manual
Genera el `.tex` intermedio, útil para depurar problemas de formato.

```bash
pandoc \
  index.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  -o tesis.tex \
  --bibliography=referencias.bib \
  --citeproc \
  --toc \
  --number-sections \
  --standalone
```

### HTML — previsualización rápida en navegador
No requiere LaTeX, compilación instantánea.

```bash
pandoc \
  index.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  -o tesis_preview.html \
  --bibliography=referencias.bib \
  --citeproc \
  --toc \
  --number-sections \
  --standalone \
  --self-contained
```

---

## Verificación de Referencias

### Listar todas las claves BibTeX usadas en los .md
```bash
grep -rh '@[a-zA-Z]' --include="*.md" . | grep -oP '(?<=[@{])[a-zA-Z0-9_]+' | sort -u
```

### Listar todas las claves definidas en referencias.bib
```bash
grep -oP '(?<=@\w{1,20}\{)[^,]+' referencias.bib | sort -u
```

### Detectar referencias citadas pero no definidas en .bib
```bash
# Claves usadas en markdown
grep -rh '\[@' --include="*.md" . | grep -oP '(?<=[@])[a-zA-Z0-9_]+' | sort -u > /tmp/usadas.txt

# Claves definidas en .bib
grep -oP '(?<=@\w{1,20}\{)[^,]+' referencias.bib | tr -d ' ' | sort -u > /tmp/definidas.txt

# Diferencia (citadas pero no en .bib)
comm -23 /tmp/usadas.txt /tmp/definidas.txt
```

---

## Conteo de Palabras

### Conteo total de la tesis (sin YAML frontmatter)
```bash
pandoc \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_marco_teorico.md \
  capitulo1/subcapitulo2_estado_del_arte.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_validacion_modelos.md \
  capitulo3/subcapitulo2_resultados_experimentales.md \
  capitulo3/subcapitulo3_analisis_escenarios.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  --to=plain | wc -w
```

### Conteo por capítulo
```bash
echo "=== Introducción ===" && pandoc introduccion/introduccion.md --to=plain | wc -w
echo "=== Capítulo 1 ===" && pandoc capitulo1/*.md --to=plain | wc -w
echo "=== Capítulo 2 ===" && pandoc capitulo2/*.md --to=plain | wc -w
echo "=== Capítulo 3 ===" && pandoc capitulo3/*.md --to=plain | wc -w
echo "=== Conclusión ===" && pandoc conclusion/conclusion.md --to=plain | wc -w
```

---

## Limpieza de Archivos Generados

```bash
# Eliminar PDFs y borradores generados (no elimina .md ni .bib)
rm -f tesis.pdf tesis.tex tesis_revision.docx tesis_preview.html
rm -f draft_capitulo1.pdf draft_capitulo2.pdf draft_capitulo3.pdf
```

---

## Agregar un Nuevo Subcapítulo

Si se añade un archivo `.md` nuevo a un capítulo, actualizar **en este orden**:

1. Crear el archivo en la carpeta del capítulo correspondiente
2. Añadirlo en el lugar correcto en el comando de compilación principal (arriba)
3. Añadirlo también en el comando de compilación de ese capítulo solo
4. Añadirlo también en los comandos de `.docx`, `.tex` y `.html`
5. Añadirlo al orden listado en `index.md`

---

## Notas Importantes

- **Motor PDF:** usar siempre `--pdf-engine=xelatex` (no pdflatex). XeLaTeX soporta UTF-8 y fuentes del sistema, necesario para español con tildes.
- **Citas:** el flag `--citeproc` reemplaza a `--filter pandoc-citeproc` en pandoc 2.11+. Verificar versión con `pandoc --version`.
- **Orden de archivos importa:** pandoc concatena los `.md` en el orden que se pasan. El orden en los comandos de este archivo es el orden definitivo.
- **YAML solo en index.md:** los archivos de capítulos no deben tener bloque YAML `---`. Solo `index.md` lleva el frontmatter con metadatos.
- **Imágenes:** rutas relativas desde la ubicación del archivo `.md` que las referencia, no desde la raíz de la tesis. Ejemplo: desde `capitulo2/subcapitulo1.md` → `../recursos/capturas/dashboard.png`.
