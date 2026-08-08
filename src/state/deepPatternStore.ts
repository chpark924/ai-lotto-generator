/**
 * 딥 패턴 탐색 전용 화면 간 상태 전달 스토어.
 * (기존 generationStore.ts와 동일한 목적/패턴 — 인메모리 전용, 영구 저장은 기존
 * src/lib/storage/tickets.ts의 saveTicket()이 그대로 담당한다.)
 */
import { create } from "zustand";
import type { DeepPatternBatch } from "../lib/deepPattern/types";

interface DeepPatternStoreState {
  batch: DeepPatternBatch | null;
  selectedIndex: number;
  setBatch: (batch: DeepPatternBatch) => void;
  selectIndex: (index: number) => void;
}

export const useDeepPatternStore = create<DeepPatternStoreState>((set) => ({
  batch: null,
  selectedIndex: 0,
  setBatch: (batch) => set({ batch, selectedIndex: 0 }),
  selectIndex: (index) => set({ selectedIndex: index }),
}));
