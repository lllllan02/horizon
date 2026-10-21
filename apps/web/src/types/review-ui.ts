import type { LibraryDocument } from './library.ts';
import type { ReviewRating, ReviewState } from '../review-model.ts';

export interface ReviewController {
  state: ReviewState | null;
  queue: {
    due: LibraryDocument[];
    fresh: LibraryDocument[];
    scheduled: LibraryDocument[];
    paused: LibraryDocument[];
    recommendations: LibraryDocument[];
  };
  loading: boolean;
  pending: boolean;
  error: string;
  storageLabel: string;
  now: number;
  pendingRating(doc: LibraryDocument): ReviewRating | null;
  refresh(): Promise<void>;
  submit(doc: LibraryDocument, rating: ReviewRating): Promise<boolean>;
  present(doc: LibraryDocument): Promise<boolean>;
  setPaused(doc: LibraryDocument, paused: boolean): Promise<boolean>;
}
