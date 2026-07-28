/**
 * 화면 간 생성 결과 전달용 인메모리 스토어.
 * (영구 저장은 src/lib/storage/tickets.ts가 담당하며, 이 스토어는 생성->결과 화면 이동 시에만 쓰인다.)
 */
import { create } from "zustand";
import type { GenerationRequest, GenerationResult } from "../lib/lottery/types";

interface GenerationStoreState {
  lastResult: GenerationResult | null;
  lastRequest: GenerationRequest | null;
  setResult: (request: GenerationRequest, result: GenerationResult) => void;
}

export const useGenerationStore = create<GenerationStoreState>((set) => ({
  lastResult: null,
  lastRequest: null,
  setResult: (request, result) => set({ lastRequest: request, lastResult: result }),
}));
