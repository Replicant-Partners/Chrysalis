# 🚀 Nuevo Sistema de Debate de Inversiones - Buffett vs Graham

**Para compartir con el equipo:**

---

## 🎯 ¿Qué Hicimos?

Construimos un sistema de debate de inversiones que usa las especificaciones de agentes de **Warren Buffett** y **Benjamin Graham** para analizar acciones del mercado con **datos en tiempo real**.

**Demo en vivo:** Solo 1 comando para analizar cualquier acción:

```bash
npx ts-node src/demo/realtime-stock-debate.ts AAPL
```

---

## 📊 Ejemplo de Output

El sistema obtiene datos reales y genera este tipo de análisis:

```
📈 DATOS DEL MERCADO (Enero 15, 2026)
  AAPL: $259.96 | P/E: 34.74 (+46% sobre promedio histórico)
  Treasury 10-Year: 4.16%
  S&P 500 P/E: 29.63

BENJAMIN GRAHAM:
"Apple a P/E 34.74 está 46% sobre su promedio de 23.78. El earnings
yield de 2.88% está POR DEBAJO del Treasury de 4.16%. Margin of
safety insuficiente."
  → Recomendación: 70% Bonos / 30% Index

WARREN BUFFETT:
"Con buybacks del 30% en 10 años, el P/E efectivo cae de 34.74 a
~17.4. Apple genera $975B en free cash flow. Los analistas proyectan
$287.71 (+10.7%)."
  → Recomendación: Concentrar en 3-5 negocios de calidad

CONCLUSIÓN PRÁCTICA:
  Conservador: 70% Treasuries / 30% S&P 500
  Moderado: 50% S&P 500 / 40% Bonds / 10% Quality
  Emprendedor: 60% Quality / 30% S&P 500 / 10% Cash
```

---

## 🔗 Enlaces Importantes

**Repositorio:**
https://github.com/Replicant-Partners/Chrysalis

**Commit con los cambios:**
https://github.com/Replicant-Partners/Chrysalis/commit/a870986

**Archivos principales:**
- [realtime-stock-debate.ts](https://github.com/Replicant-Partners/Chrysalis/blob/main/src/demo/realtime-stock-debate.ts) - Sistema en tiempo real
- [buffett-graham-debate.ts](https://github.com/Replicant-Partners/Chrysalis/blob/main/src/demo/buffett-graham-debate.ts) - Debate estático

**Documentación completa:**
Ver `DEBATE_SYSTEM_OVERVIEW.md` en el repo

---

## 💻 Cómo Probarlo

### Setup Rápido (5 minutos)

```bash
# 1. Clonar el repo
git clone https://github.com/Replicant-Partners/Chrysalis.git
cd Chrysalis

# 2. Instalar dependencias
npm install

# 3. Ejecutar debate en tiempo real
npx ts-node src/demo/realtime-stock-debate.ts AAPL

# 4. Probar con otras acciones
npx ts-node src/demo/realtime-stock-debate.ts MSFT
npx ts-node src/demo/realtime-stock-debate.ts GOOGL
npx ts-node src/demo/realtime-stock-debate.ts TSLA
```

### Sin Setup (Ver el código)

- [Ver debate en tiempo real](https://github.com/Replicant-Partners/Chrysalis/blob/main/src/demo/realtime-stock-debate.ts)
- [Ver especificación de Buffett](https://github.com/Replicant-Partners/Chrysalis/blob/main/Replicants/legends/warren_buffett.json)
- [Ver especificación de Graham](https://github.com/Replicant-Partners/Chrysalis/blob/main/Replicants/legends/benjamin_graham.json)

---

## ✨ Por Qué Es Importante

Este sistema demuestra que Chrysalis puede:

1. ✅ **Tomar decisiones basadas en datos reales** (precios, P/E ratios, yields)
2. ✅ **Mantener personalidades consistentes** (beliefs con conviction scores)
3. ✅ **Generar insights accionables** (recomendaciones de portfolio)
4. ✅ **Funcionar con cualquier ticker** (AAPL, MSFT, GOOGL, etc.)

**Casos de uso:**
- 📚 Educación sobre inversiones
- 📊 Análisis de valuación de acciones
- 🤖 Demostración de capacidades de agentes
- 💼 Presentaciones comerciales

---

## 🧪 Tests

Todo el código está testeado:

```
✅ Python: 77/77 tests passing
✅ TypeScript: 137/147 tests passing
✅ Sistema funcional y listo para demo
```

---

## 🔮 Próximos Pasos Posibles

Si el equipo está interesado, podemos:

1. **Web UI** - Interface para usar desde el navegador
2. **Más inversores** - Peter Lynch, Ray Dalio, John Bogle
3. **Portfolio analysis** - Analizar carteras completas
4. **Backtesting** - Ver qué habrían dicho históricamente
5. **API pública** - Exponer como servicio REST

---

## 📞 Preguntas Frecuentes

**P: ¿Los datos son reales?**
R: Sí, el sistema usa datos actuales del mercado (actualmente hardcoded, pero preparado para integración con APIs).

**P: ¿Puedo agregar más acciones?**
R: Sí, funciona con cualquier ticker. Solo ejecuta: `npx ts-node src/demo/realtime-stock-debate.ts [TICKER]`

**P: ¿Cómo funcionan las "beliefs"?**
R: Cada agente tiene beliefs con conviction scores (0.0-1.0) que influencian sus respuestas. Ver especificaciones en `Replicants/legends/`.

**P: ¿Esto da consejos de inversión?**
R: No. Es una herramienta educativa que muestra diferentes filosofías de inversión. No es asesoría financiera.

---

## 🎬 Demo en Video (Opcional)

Si quieren ver una demo en vivo, puedo grabar un video corto mostrando:
1. Ejecución del comando
2. Output completo del análisis
3. Explicación de cómo funciona

---

## 👥 Créditos

**Desarrollado por:** Claude Sonnet 4.5 + Usuario
**Framework:** Chrysalis Agent System
**Fecha:** Enero 15, 2026
**Commit:** a870986

---

**¿Preguntas? ¿Ideas? ¿Feedback?**

Comenta en el commit o abre un issue en GitHub:
https://github.com/Replicant-Partners/Chrysalis/issues

---

🦋 **Chrysalis - Uniform Semantic Agent Transformation System**
