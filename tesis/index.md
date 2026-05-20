---
title: "Gemelo Digital para una Microrred Fotovoltaica: Monitoreo en Tiempo Real, Predicciones Inteligentes y Análisis de Escenarios de Apagón"
subtitle: "Trabajo de Diploma en opción al título de Ingeniero en Ciencias Informáticas"
author:
  - Rubén Hernández Acevedo
  - Fabián Fernández Gálvez
tutors:
  - "Dr.C. Nayma Cepero Pérez"
  - "Ms.C. Ernesto Alberto Álvarez"
institution: "Instituto Superior Politécnico José Antonio Echeverría (CUJAE)"
faculty: "Facultad de Ingeniería Informática"
career: "Ingeniería en Ciencias Informáticas"
city: "La Habana, Cuba"
month: "junio"
date: "2026"
lang: "es"
documentclass: report
classoption:
  - 12pt
  - twoside
  - openright
papersize: letter
geometry:
  - top=2.5cm
  - bottom=2.5cm
  - left=3cm
  - right=2.5cm
linestretch: 1.5
fontsize: 12pt
mainfont: "Arial"
sansfont: "Arial"
monofont: "Menlo"
# Norma CUJAE / estándar tesis ingeniería Cuba:
# Arial 12, interlineado 1.5, texto justificado (default LaTeX),
# márgenes 3cm izq / 2.5cm sup, inf, der.
bibliography: referencias.bib
csl: vancouver.csl
link-citations: true
toc: true
toc-depth: 3
lof: true
lot: true
numbersections: true
header-includes: |
  \usepackage{siunitx}
  \usepackage{booktabs}
  \usepackage{float}
  \usepackage{csquotes}
  \usepackage{enumitem}
  \usepackage{graphicx}
  \usepackage{textcomp}
  \usepackage{longtable}
  \pagestyle{plain}
---

<!--
  ARCHIVO PRINCIPAL DE LA TESIS — solo metadatos pandoc.

  El ORDEN DE COMPILACIÓN definitivo vive en COMMANDS.md.
  No duplicar la lista aquí: si añades un .md nuevo, edita COMMANDS.md
  (regla documentada en README.md, sección "Agregar un Nuevo Subcapítulo").

  La portada CUJAE se inyecta con --include-before-body=extras/portada.tex
  (LaTeX puro; pandoc no genera el layout exigido por la norma).
-->
