import { ContentBlock, TextToken } from "../types";
import * as PDFJS from "pdfjs-dist";

// Set up PDF.js worker - use local worker instead of CDN
PDFJS.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

// Simple EPUB parser (for now, handle text-based EPUBs)
export async function parseEPUB(file: File): Promise<ContentBlock[]> {
  try {
    const text = await file.text();
    const blocks = parseTextIntoBlocks(text);
    return blocks;
  } catch (error) {
    console.error("Error parsing EPUB:", error);
    throw error;
  }
}

export async function parsePDF(file: File): Promise<ContentBlock[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise;
    const contents: ContentBlock[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let currentText = "";
      const items = textContent.items as any[];

      for (const item of items) {
        if ("str" in item) {
          currentText += item.str + " ";
          if ((item as any).hasEOL) {
            const blocks = parseTextIntoBlocks(currentText);
            contents.push(...blocks);
            currentText = "";
          }
        }
      }

      if (currentText.trim()) {
        const blocks = parseTextIntoBlocks(currentText);
        contents.push(...blocks);
      }
    }

    return contents;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw error;
  }
}

export async function parseText(file: File): Promise<ContentBlock[]> {
  try {
    const text = await file.text();
    return parseTextIntoBlocks(text);
  } catch (error) {
    console.error("Error parsing text file:", error);
    throw error;
  }
}

export function tokenizeContent(blocks: ContentBlock[]): TextToken[] {
  const tokens: TextToken[] = [];
  let tokenIndex = 0;

  blocks.forEach((block, blockIndex) => {
    if (block.type === "text") {
      const words = (block.content as string)
        .split(/\s+/)
        .filter((word) => word.length > 0);

      words.forEach((word) => {
        const cleanWord = word.replace(/[^\w]/g, "");
        const punctuation = word.slice(cleanWord.length);

        if (cleanWord.length > 0) {
          const charIndex = Math.floor(cleanWord.length / 2);
          tokens.push({
            word: cleanWord,
            charIndex,
            originalIndex: tokenIndex,
            blockIndex,
            punctuation: punctuation || undefined,
          });
          tokenIndex++;
        }
      });
    }
  });

  return tokens;
}

export function parseTextIntoBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = text.split("\n");
  let currentText = "";

  for (const line of lines) {
    if (line.includes("[IMAGE]") || line.includes("[FIGURE]")) {
      if (currentText.trim()) {
        blocks.push({
          type: "text",
          content: currentText.trim(),
        });
        currentText = "";
      }

      blocks.push({
        type: "image",
        content: {
          url: "placeholder",
          alt: line,
        },
      });

      blocks.push({
        type: "break",
        content: "",
      });
    } else if (line.trim()) {
      currentText += line + " ";
    } else if (currentText.trim()) {
      blocks.push({
        type: "text",
        content: currentText.trim(),
      });
      currentText = "";
      blocks.push({
        type: "break",
        content: "",
      });
    }
  }

  if (currentText.trim()) {
    blocks.push({
      type: "text",
      content: currentText.trim(),
    });
  }

  return blocks.filter((block) => block.type !== "break" || block.content);
}
