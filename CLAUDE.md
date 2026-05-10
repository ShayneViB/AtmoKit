# AtmoKit - AI Coding Guidelines

This document outlines the behavioral rules for AI coding agents working on the AtmoKit project. It is inspired by the `CLAUDE.md` from `forrestchang/andrej-karpathy-skills` and Andrej Karpathy's observations on LLM coding pitfalls.

## 1. Think Before Coding (谋而后动)
*   **Don't assume:** If you are unsure about specific air quality evaluation formulas, thresholds (e.g., GB 3095-2026), or the project structure, ASK for clarification or clearly state your assumptions before writing code. Do not silently guess domain-specific logic.
*   **Surface Trade-offs:** When suggesting an architecture or UI solution, present the trade-offs (e.g., performance vs. development speed).

## 2. Simplicity First (极简至上)
*   **Minimum Code:** Write the absolute minimum amount of code necessary to solve the problem.
*   **No Speculative Features:** Do not add "flexibility", "defensive code" for impossible scenarios, or features that were not explicitly requested.
*   **Avoid Over-engineering:** Do not introduce complex state management or deep component abstractions unless strictly necessary. Leverage existing dependencies (`recharts`, `xlsx`, `papaparse`) directly and simply.

## 3. Surgical Changes (精准修改)
*   **Touch Only What You Must:** Limit your edits strictly to the files and lines relevant to the task.
*   **No Unrelated Refactoring:** Do not reformat, reorganize, or "clean up" adjacent code that you are not directly modifying. Avoid formatting-only commits.

## 4. Goal-Driven Execution (目标导向)
*   **Verifiable Goals:** Transform open-ended tasks into verifiable, objective goals.
*   **Verification:** Since the project currently does not have an automated testing framework (like Jest/Vitest), verify logic changes (e.g., in `src/utils/statistics.js`) via explicit console logging or manual UI checks. Define what "success" looks like before implementing.

## 5. Project-Specific Context (AtmoKit)
*   **Tech Stack:** React 19, Vite, Recharts.
*   **Domain:** Air Quality Forecasting and Evaluation (面向气象/环保预报员的业务系统).
*   **Standards Requirement:** Precision is critical. All index calculations and evaluations must strictly adhere to the provided environmental standards (e.g., 2026版国家技术规范、不同阶段的权重和阈值).
