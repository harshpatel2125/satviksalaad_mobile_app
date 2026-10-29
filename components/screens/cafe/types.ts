import type { CafeMenuData, Orderable } from '@/lib/cafe-order';

export type DietMarks = CafeMenuData['dietMarks'];

export type SetQuantity = (orderable: Orderable, quantity: number) => void;
