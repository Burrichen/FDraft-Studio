import type { Condition } from "@fdraft/theme-sdk";
import type { RenderState } from "./types.js";
import { readRuntimeVariable, type RuntimeVariableContext } from "./variables.js";

function compareValues(operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte", actual: string | number | boolean | undefined, expected: string | number | boolean): boolean {
  if (actual === undefined) return false;
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

/** Evaluates a theme's declarative condition against host-supplied state. Never executes theme-supplied code — every branch here is a fixed, enumerable case from the SDK's closed `Condition` union. A missing/undisclosed variable value never throws; it simply makes every comparison false. */
export function evaluateCondition(condition: Condition, state: RenderState, context: RuntimeVariableContext = {}): boolean {
  switch (condition.type) {
    case "always":
      return true;
    case "eventPhase":
      return state.eventPhase === condition.phase;
    case "stateEquals":
      return state.activeImageStates[condition.stateGroupId] === condition.stateId;
    case "compare":
      return compareValues(condition.operator, readRuntimeVariable(condition.variable, state, context), condition.value);
    case "inRange": {
      const actual = readRuntimeVariable(condition.variable, state, context);
      return typeof actual === "number" && actual >= condition.min && actual <= condition.max;
    }
    case "boolean":
      return readRuntimeVariable(condition.variable, state, context) === condition.equals;
    case "and":
      return condition.conditions.every((c) => evaluateCondition(c, state, context));
    case "or":
      return condition.conditions.some((c) => evaluateCondition(c, state, context));
    case "not":
      return !evaluateCondition(condition.condition, state, context);
  }
}
