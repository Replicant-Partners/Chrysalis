# Technology Assessments

This directory contains comprehensive technology evaluations and recommendations for the Chrysalis project.

## Available Assessments

### Canvas & Visual Programming (January 2026)

**Primary Document**: [canvas-visual-programming-assessment.md](canvas-visual-programming-assessment.md)

Comprehensive evaluation of 8 open-source canvas and visual programming libraries:
- ⭐ **React Flow** (Recommended) - Score: 96/100
- ⭐ **Rete.js** (Alternative) - Score: 85/100
- Litegraph.js, Baklava.js, JSONCanvas, Drawflow, Flowy, Custom Implementation

**Implementation Guide**: [react-flow-integration-guide.md](react-flow-integration-guide.md)

**Decision**: Proceed with React Flow for canvas implementation (6-week timeline)

---

## Assessment Methodology

All technology assessments follow this framework:

1. **Establish Evaluation Criteria** - Weighted scoring based on project requirements
2. **Catalog Candidates** - Identify 5-10 relevant technologies
3. **Deep Technical Analysis** - API design, data models, performance, ecosystem
4. **Comparative Matrix** - Scored evaluation against criteria
5. **Recommendations** - Primary choice + ranked alternatives
6. **Architectural Implications** - Integration patterns, migration paths, technical debt

---

## How to Request an Assessment

Technology assessments are conducted when:
- Selecting a major dependency (>100KB impact)
- Choosing between multiple viable options
- Making architectural decisions with long-term implications
- Evaluating replacement for existing technology

**Contact**: Open an issue with the `tech-assessment` label

---

## Assessment History

| Date | Topic | Recommendation | Status |
|------|-------|----------------|--------|
| 2026-01-14 | Canvas & Visual Programming | React Flow | ✅ Approved |

---

**Last Updated**: January 14, 2026