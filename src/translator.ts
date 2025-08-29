import Gio from "gi://Gio";
import Soup from "gi://Soup";
import GLib from "gi://GLib";

type Subtitle = {index: number; start: string; end: string; text: string};

// Model recommendations for subtitle translation tasks
// Based on language capabilities, context handling, and translation quality
export const modelRecommendations: { [key: string]: boolean } = {
  // Highly Recommended (✓) - Excellent multilingual capabilities
  "llama3.2:latest": true,
  "llama3.1:latest": true,
  "llama3:latest": true,
  "qwen2.5:latest": true,
  "qwen2:latest": true,
  "gemma2:latest": true,
  "gemma3n:latest": true,
  "mistral:latest": true,
  "command-r:latest": true,
  "aya:latest": true,
  
  // Not Recommended (✗) - Poor for translation tasks
  "codellama:latest": false,
  "code-llama:latest": false,
  "deepseek-coder:latest": false,
  "magicoder:latest": false,
  "phind-codellama:latest": false,
  "starcoder:latest": false,
  "wizardcoder:latest": false,
  "sqlcoder:latest": false,
  "stable-code:latest": false,
  "codegemma:latest": false,
};

// Function to get recommendation status for a model
export function getModelRecommendation(modelName: string): "recommended" | "not-recommended" | "unknown" {
  // Normalize model name to check against our recommendations
  const normalizedName = modelName.toLowerCase();
  
  // Check exact match first
  if (modelRecommendations.hasOwnProperty(normalizedName)) {
    return modelRecommendations[normalizedName] ? "recommended" : "not-recommended";
  }
  
  // Check for partial matches (e.g., "llama3.2:3b" should match "llama3.2:latest")
  for (const [key, recommended] of Object.entries(modelRecommendations)) {
    const baseKey = key.replace(":latest", "");
    if (normalizedName.startsWith(baseKey)) {
      return recommended ? "recommended" : "not-recommended";
    }
  }
  
  // Check for known coding models that aren't recommended
  const codingKeywords = ["code", "coder", "sql", "programming"];
  if (codingKeywords.some(keyword => normalizedName.includes(keyword))) {
    return "not-recommended";
  }
  
  // Default to unknown for unrecognized models
  return "unknown";
}

function parseSrt(content: string): Subtitle[] {
  const parts = content.split(/\r?\n\r?\n/);
  const subs: Subtitle[] = [];

  for (const part of parts) {
    const lines = part.split(/\r?\n/).filter(Boolean);
    if (lines.length >= 3) {
      const [indexLine, ...rest] = lines as [string, ...string[]];
      const index = Number.parseInt(indexLine, 10);
      const slice = rest as [string, ...string[]];
      const times = slice[0];
      const textLines = slice.slice(1);

      const timeSplit = times.split(" --> ");
      if (timeSplit.length !== 2) continue;
      const [start, end] = timeSplit as [string, string];
      subs.push({index, start, end, text: textLines.join(" ")});
    }
  }

  return subs;
}

function buildSrt(subs: Subtitle[]): string {
  return subs
    .map((s) => `${s.index}\n${s.start} --> ${s.end}\n${s.text}\n`)
    .join("\n");
}

async function callOllama(model: string, prompt: string): Promise<string> {
  const session = new Soup.Session();
  const data = JSON.stringify({model, prompt, stream: false});
  
  // Use 127.0.0.1 instead of localhost for better Flatpak compatibility
  const url = "http://127.0.0.1:11434/api/generate";
  console.log(`Calling Ollama at: ${url} with model: ${model}`);
  
  const message = Soup.Message.new("POST", url);
  const headers = message.get_request_headers();
  headers.append("Content-Type", "application/json");
  
  const bytes = GLib.Bytes.new(new TextEncoder().encode(data));
  message.set_request_body_from_bytes("application/json", bytes);

  return new Promise((resolve, reject) => {
    session.send_async(message, GLib.PRIORITY_DEFAULT, null, (_session: any, result: any) => {
      try {
        const inputStream = session?.send_finish(result);
        if (!inputStream) {
          reject(new Error("Failed to get response from Ollama"));
          return;
        }
        
        // Check HTTP status
        const statusCode = message.get_status();
        console.log(`HTTP Status: ${statusCode}`);
        
        if (statusCode !== 200) {
          reject(new Error(`HTTP error: ${statusCode}`));
          return;
        }

        // Use buffered reading for better compatibility
        const bufferedInputStream = Gio.BufferedInputStream.new(inputStream);
        let responseText = "";
        
        const readNext = () => {
          bufferedInputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (stream: any, result: any) => {
            try {
              const bytes = stream?.read_bytes_finish(result);
              if (bytes && bytes.get_size() > 0) {
                const chunk = new TextDecoder().decode(bytes.get_data());
                responseText += chunk;
                readNext(); // Continue reading
              } else {
                // End of stream, process response
                console.log("Ollama generate response:", responseText);
                
                if (responseText.trim()) {
                  try {
                    const parsed = JSON.parse(responseText);
                    if (parsed && parsed.response) {
                      resolve(parsed.response);
                    } else {
                      resolve(responseText.trim());
                    }
                  } catch (e) {
                    resolve(responseText.trim());
                  }
                } else {
                  reject(new Error("Empty response from Ollama"));
                }
              }
            } catch (e) {
              reject(e);
            }
          });
        };
        
        readNext();
      } catch (e) {
        reject(e);
      }
    });
  });
}

export class TranslationCancellation {
  private _cancelled = false;
  
  cancel() {
    this._cancelled = true;
  }
  
  get isCancelled() {
    return this._cancelled;
  }
}

export async function translateSrtFile(
  filePath: string,
  targetLanguage: string,
  model: string,
  onProgress?: (done: number, total: number) => void,
  cancellation?: TranslationCancellation,
): Promise<string> {
  const file = Gio.File.new_for_path(filePath);
  const [, contents] = file.load_contents(null);
  const content = new TextDecoder().decode(contents);
  const subs = parseSrt(content);

  const total = subs.length;
  const translated: Subtitle[] = [];

  for (const [i, s] of subs.entries()) {
    if (cancellation?.isCancelled) {
      throw new Error("Translation was cancelled");
    }
    const prompt = `Translate the following subtitle text to ${targetLanguage} without changing timing. Respond with only the translated text: ${s.text}`;
    const out = await callOllama(model, prompt);
    translated.push({index: s.index, start: s.start, end: s.end, text: out.trim()});
    onProgress?.(i + 1, total);
  }

  return buildSrt(translated);
}

export async function listInstalledModels(): Promise<Array<{name: string; size?: string}>> {
  const session = new Soup.Session();
  // Try both localhost and 127.0.0.1 - Flatpak might have issues with localhost
  const urls = ["http://127.0.0.1:11434/api/tags", "http://localhost:11434/api/tags"];
  
  for (const url of urls) {
    console.log(`Trying to connect to: ${url}`);
    const message = Soup.Message.new("GET", url);

    const result = await new Promise<Array<{name: string; size?: string}>>((resolve) => {
      session.send_async(message, GLib.PRIORITY_DEFAULT, null, (_session: any, result: any) => {
        try {
          const inputStream = session?.send_finish(result);
          if (!inputStream) {
            console.error(`Failed to get input stream from ${url}`);
            resolve([]);
            return;
          }
          
          // Check HTTP status
          const statusCode = message.get_status();
          console.log(`HTTP Status for ${url}: ${statusCode}`);
          
          if (statusCode !== 200) {
            console.error(`HTTP error: ${statusCode}`);
            resolve([]);
            return;
          }

                  // Use a simpler approach to read the response
        const bufferedInputStream = Gio.BufferedInputStream.new(inputStream);
        
        const readAllData = () => {
          let responseText = "";
          
          const readNext = () => {
            bufferedInputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (stream: any, result: any) => {
              try {
                const bytes = stream?.read_bytes_finish(result);
                if (bytes && bytes.get_size() > 0) {
                  const chunk = new TextDecoder().decode(bytes.get_data());
                  responseText += chunk;
                  readNext(); // Continue reading
                } else {
                  // End of stream, process the complete response
                  console.log(`Complete Ollama response from ${url}:`, responseText);
                  
                  if (responseText.trim()) {
                    try {
                      const parsed = JSON.parse(responseText);
                      console.log(`Parsed response:`, parsed);
                      
                      if (parsed && parsed.models) {
                        const models = parsed.models.map((m: any) => {
                          const model: {name: string; size?: string} = {
                            name: (m.name ?? m.model ?? m) as string,
                          };
                          if (m.size) {
                            model.size = `${Math.round(m.size / (1024 * 1024 * 1024))}GB`;
                          }
                          return model;
                        });
                        console.log(`Mapped models:`, models);
                        resolve(models);
                      } else if (Array.isArray(parsed)) {
                        const models = parsed.map((m: any) => {
                          const model: {name: string; size?: string} = {
                            name: (m.name ?? m.model ?? m) as string,
                          };
                          if (m.size) {
                            model.size = `${Math.round(m.size / (1024 * 1024 * 1024))}GB`;
                          }
                          return model;
                        });
                        console.log(`Mapped array models:`, models);
                        resolve(models);
                      } else {
                        console.error("Unexpected response format:", parsed);
                        resolve([]);
                      }
                    } catch (e) {
                      console.error("Error parsing JSON:", e, "Response:", responseText);
                      resolve([]);
                    }
                  } else {
                    console.error(`Empty response from ${url}`);
                    resolve([]);
                  }
                }
              } catch (e) {
                console.error("Error reading chunk:", e);
                resolve([]);
              }
            });
          };
          
          readNext();
        };
        
        readAllData();
        } catch (e) {
          console.error(`Error connecting to ${url}:`, e);
          resolve([]);
        }
      });
    });
    
    if (result.length > 0) {
      return result;
    }
  }
  
  return [];
}




