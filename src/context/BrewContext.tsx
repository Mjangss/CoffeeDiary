import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { BrewFormState, BrewAction } from "../types";
import { INITIAL_BREW_FORM, METHOD_CONFIG, DEFAULT_CUP_SCORES } from "../constants";

const brewFormReducer = (state: BrewFormState, action: BrewAction): BrewFormState => {
  switch (action.type) {
    case "UPDATE_FIELD":
      return { ...state, [action.field]: action.value };
    
    case "UPDATE_CUP_SCORES":
      return { ...state, cupScores: { ...state.cupScores, ...action.scores } };

    case "RESET_FORM":
      return { 
        ...INITIAL_BREW_FORM, 
        baseClick: METHOD_CONFIG[INITIAL_BREW_FORM.method].baselineClick,
        baseClickInput: METHOD_CONFIG[INITIAL_BREW_FORM.method].baselineClick.toFixed(1)
      };

    case "SET_METHOD": {
      const newBaseline = METHOD_CONFIG[action.method].baselineClick;
      return { 
        ...state, 
        method: action.method, 
        baseClick: newBaseline,
        baseClickInput: newBaseline.toFixed(1),
        switchApplied: action.method === "Espresso" ? false : state.switchApplied
      };
    }

    case "SET_BASE_CLICK":
      return { ...state, baseClick: action.value, baseClickInput: action.value.toFixed(1) };

    case "LOAD_RECORD": {
      const { record, recipes } = action;
      const linkedRecipe = recipes.find(r => r.name === record.recipe);
      return {
        ...state,
        bean: record.bean || "",
        selectedBeanName: record.bean || "",
        method: record.method || "Brew",
        grinder: record.grinder || "Millab M01",
        brewWater: record.brewWater || "평창수",
        brewWaterTemp: record.brewWaterTemp || 92,
        immersionWaterTemp: record.immersionWaterTemp ?? 90,
        filterPaper: record.filterPaper || "하리오 기본",
        dripper: record.dripper || "V60",
        switchApplied: record.method === "Brew" ? (record.switchApplied ?? false) : false,
        roastLevel: record.roastLevel || "중배전",
        cupScores: record.cupScores || DEFAULT_CUP_SCORES,
        restDays: record.restDays || 0,
        brewSec: record.brewSec || 31,
        baseClick: record.baseClick,
        baseClickInput: record.baseClick.toFixed(1),
        memo: record.memo ?? "",
        selectedInventoryId: record.inventoryId || "",
        selectedRecipeId: linkedRecipe?.id || "",
        recipe: record.recipe || "",
        dose: record.dose || 20,
      };
    }

    case "APPLY_RECIPE":
      return {
        ...state,
        selectedRecipeId: action.recipe.id,
        recipe: action.recipe.name,
        dose: action.recipe.dose
      };

    default:
      return state;
  }
};

interface BrewContextType {
  brewForm: BrewFormState;
  dispatch: React.Dispatch<BrewAction>;
}

const BrewContext = createContext<BrewContextType | undefined>(undefined);

export const BrewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [brewForm, dispatch] = useReducer(brewFormReducer, INITIAL_BREW_FORM);

  return (
    <BrewContext.Provider value={{ brewForm, dispatch }}>
      {children}
    </BrewContext.Provider>
  );
};

export const useBrewContext = () => {
  const context = useContext(BrewContext);
  if (context === undefined) {
    throw new Error("useBrewContext must be used within a BrewProvider");
  }
  return context;
};
