import { GoogleGenAI, Modality } from "@google/genai";

// --- Helper Functions ---

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// --- API Service ---

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable is not set.");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
}


export const generatePhotos = async (
    productPhoto: File,
    modelPhoto: File | null,
    referencePhoto: File | null,
    theme: string,
    customTheme: string,
    additionalCommands: string
): Promise<string[]> => {
    const aiInstance = getAi();
    const finalTheme = theme === 'None' ? customTheme : theme;
    
    const productPart = await fileToGenerativePart(productPhoto);

    // Case 2: Reference Photo is provided (generates 1 image)
    if (referencePhoto) {
        let prompt = `Generate 1 product photo that matches the style of the reference photo. The logo, text, shape, and product color must not be altered.`;
        if (finalTheme) prompt += ` The theme should be: ${finalTheme}.`;
        if (additionalCommands) prompt += ` Additional instructions: ${additionalCommands}.`;

        const referencePart = await fileToGenerativePart(referencePhoto);

        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [productPart, referencePart, { text: prompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            return [`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`];
        }
        return [];
    }

    // Common generation logic for model and product photos (generates 4 images)
    const generationPromises = [];
    const numberOfImages = 4;

    let basePrompt: string;
    let parts: any[];

    if (modelPhoto) {
        // Case 1: Model Photo is provided
        basePrompt = `Generate a professional photo of the provided model holding or wearing the product. Add supporting props to make the photo more appealing. It is absolutely crucial that the model's face remains consistent and unchanged from the source photo. Do not alter the facial features. Create a unique variation with a different body pose, facial expression, lighting, composition, or camera angle.`;
        const modelPart = await fileToGenerativePart(modelPhoto);
        parts = [productPart, modelPart];
    } else {
        // Case 3: Only Product Photo
        basePrompt = `Generate a professional variation of the product in the image with different lighting, composition, and camera angles. Add supporting props to make the product photo more appealing.`;
        parts = [productPart];
    }
    
    let fullPrompt = basePrompt;
    if (finalTheme) fullPrompt += ` The theme should be: ${finalTheme}.`;
    if (additionalCommands) fullPrompt += ` Additional instructions: ${additionalCommands}.`;

    for (let i = 0; i < numberOfImages; i++) {
        generationPromises.push(aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [...parts, { text: fullPrompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        }));
    }

    const responses = await Promise.all(generationPromises);
    const imageUrls = responses.map(response => {
        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        return null;
    }).filter((url): url is string => url !== null);
    
    return imageUrls;
};

export const refineImage = async (
    base64ImageData: string,
    command: string
): Promise<string> => {
    const aiInstance = getAi();
    const mimeType = base64ImageData.substring(base64ImageData.indexOf(":") + 1, base64ImageData.indexOf(";"));
    const data = base64ImageData.split(',')[1];
    
    const imagePart = { inlineData: { data, mimeType } };
    const textPart = { text: command };

    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    const resultPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (resultPart?.inlineData) {
        return `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
    }
    throw new Error("Failed to refine image.");
};