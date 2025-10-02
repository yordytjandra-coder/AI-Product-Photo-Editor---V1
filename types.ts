
export interface ImageFile {
  file: File;
  previewUrl: string;
}

export interface ResultState {
  id: string;
  imageHistory: string[]; // A stack of image data URLs. The latest is at `currentIndex`.
  currentIndex: number;
  refinementPrompt: string; // The text currently in the input box for this card
}

export type HistoryItem = {
  id: string;
  results: ResultState[];
};
