import { expect, test } from '@jest/globals';
import * as path from 'path';
import { validateFeatureSchema } from '../src/utils';

test('validateSchema', async () => {
    const exampleRepos = path.join(__dirname, 'examples');

    {
        // VALID
        const result = await validateFeatureSchema(path.join(exampleRepos, 'simple', 'src', 'color'));
        expect(result).toBe(true);
    }

    {
        // VALID
        const result = await validateFeatureSchema(path.join(exampleRepos, 'simple', 'src', 'hello'));
        expect(result).toBe(true);
    }

    {
        // WRONG: 'installAfter' should be changed to 'installsAfter'
        const result = await validateFeatureSchema(path.join(exampleRepos, 'invalid', 'src', 'invalidPropertyName'));
        expect(result).toBe(false);
    }

    {
        // WRONG: 'installsAfter' value should be an array, but is an object
        const result = await validateFeatureSchema(path.join(exampleRepos, 'invalid', 'src', 'invalidPropertyValue'));
        expect(result).toBe(false);
    }

    {
        // WRONG: missing required 'id' property
        const result = await validateFeatureSchema(path.join(exampleRepos, 'invalid', 'src', 'missingProperty'));
        expect(result).toBe(false);
    }
});
