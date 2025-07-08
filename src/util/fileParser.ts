import { JSONParser } from '@streamparser/json';

export const FILE_PATH = '/app/files';

export function parseJSONFile<T>(file?: Express.Multer.File): Promise<T> {
  return new Promise((resolve, reject) => {
    const jsonParser = new JSONParser({ paths: ['$.*'], stringBufferSize: undefined });
    let finalJSON: any;
    jsonParser.onToken = ({ value }) => {
      if (finalJSON === undefined) {
        if (value === '[') finalJSON = [];
        else if (value === '{') finalJSON = {};
      }
    };
    jsonParser.onValue = ({ parent }) => {
      finalJSON = parent;
    };
    jsonParser.onEnd = () => {
      resolve(finalJSON as T);
    };

    if (file?.buffer) {
      try {
        jsonParser.write(file.buffer);
      } catch (e) {
        let err = e as Error;
        console.error(err);
        if (err.message) err.message = `JSON Parse error: ${err.message}`;
        else err = new Error(`JSON Parse error: ${e}`);
        reject(err);
      }
    } else {
      reject(new Error('invalid JSON file'));
    }
  });
}
