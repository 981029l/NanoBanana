import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import type { ImageData } from "../types";

export const editImageWithGemini = async (
  image: ImageData,
  prompt: string
): Promise<string> => {
  return editMultipleImagesWithGemini([image], prompt);
};

export const editMultipleImagesWithGemini = async (
  images: ImageData[],
  prompt: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    // 构建 parts 数组：所有图片 + 提示词
    const parts = [
      ...images.map((image) => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      })),
      {
        text: prompt,
      },
    ];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts,
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const responseParts = response?.candidates?.[0]?.content?.parts;
    if (!responseParts) {
      throw new Error("Invalid response structure from Gemini API.");
    }

    for (const part of responseParts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }

    throw new Error("No image was generated in the response.");
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      return Promise.reject(
        new Error(`Failed to edit image: ${error.message}`)
      );
    }
    return Promise.reject(
      new Error("An unknown error occurred while editing the image.")
    );
  }
};

// 提示词优化
export const enhancePromptWithGemini = async (
  originalPrompt: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a professional AI art prompt engineer. Rewrite the following user prompt to be more descriptive, artistic, and suitable for high-quality image generation. 
              
              Rules:
              1. Keep the original subject and meaning.
              2. Add details about lighting, texture, composition, and style.
              3. Output ONLY the enhanced prompt text. Do not add "Here is the prompt" or quotes.
              4. IMPORTANT: Output the enhanced prompt in the SAME LANGUAGE as the User prompt. If the user inputs Chinese, you MUST output the enhanced prompt in Chinese.
              
              User prompt: "${originalPrompt}"`,
            },
          ],
        },
      ],
    });

    const enhancedPrompt = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!enhancedPrompt) {
      throw new Error("No text generated");
    }
    return enhancedPrompt.trim();
  } catch (error) {
    console.error("Error enhancing prompt:", error);
    // 如果优化失败，返回原提示词，不阻断流程
    return originalPrompt;
  }
};

// 纯文字生成图片
export const generateImageFromText = async (
  prompt: string,
  aspectRatio?: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 如果指定了比例，添加到提示词中 (Gemini Image 模型通常通过提示词理解构图)
  let finalPrompt = prompt;
  if (aspectRatio) {
    // 将 16:9 转换为描述性语言
    const ratioMap: Record<string, string> = {
      "1:1": "Square (1:1)",
      "16:9": "Wide Cinematic (16:9)",
      "9:16": "Tall Vertical (9:16)",
      "4:3": "Landscape (4:3)",
      "3:4": "Portrait (3:4)",
    };
    
    const ratioDesc = ratioMap[aspectRatio] || aspectRatio;
    // 将比例指令放在最前面，权重最高
    finalPrompt = `Image Aspect Ratio: ${ratioDesc}. ${prompt}`;
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            text: finalPrompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
        // @ts-ignore - 尝试传递 generationConfig，尽管类型定义可能未更新
        generationConfig: aspectRatio ? { aspectRatio: aspectRatio } : undefined,
      },
    });

    const responseParts = response?.candidates?.[0]?.content?.parts;
    if (!responseParts) {
      throw new Error("Invalid response structure from Gemini API.");
    }

    for (const part of responseParts) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }

    throw new Error("No image was generated in the response.");
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      return Promise.reject(
        new Error(`Failed to generate image: ${error.message}`)
      );
    }
    return Promise.reject(
      new Error("An unknown error occurred while generating the image.")
    );
  }
};
