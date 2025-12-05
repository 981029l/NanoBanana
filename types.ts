export interface ImageData {
  base64: string;
  mimeType: string;
  dataUrl: string;
}

export interface GenerationHistory {
  id: string;
  originalImage: string; // dataUrl (主图)
  originalImages?: string[]; // 多图模式下的所有原图
  editedImage: string; // dataUrl
  prompt: string;
  timestamp: number;
  isMultiImage?: boolean; // 是否为多图合成
  isTextToImage?: boolean; // 是否为纯文字生成
}
