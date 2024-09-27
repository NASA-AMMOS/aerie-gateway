import { JSONParser } from '@streamparser/json';

export function parseJSONFile<T>(file?: Express.Multer.File): Promise<T> {
  return new Promise(resolve => {
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
        console.error(e);
      }
    }
  });
}
